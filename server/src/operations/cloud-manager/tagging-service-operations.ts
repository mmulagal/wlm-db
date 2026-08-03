import { DATABASE_TYPE } from '@prisma/client';
import { groupBy, isEqual, uniqBy, uniqWith } from 'lodash-es';
import { callWlmHosts } from '../../lib/cloud-manager/tagging-service';
import getLogger from '../../utils/logger';
import { TAGGING_SERVICE_API_TYPES, TaggingServiceCacheParams } from '../../utils/consts';
import { getRedisConnection, isRedisConnected } from '../../utils/utils';

const logger = getLogger();

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

interface WorkloadEntry {
    workload: string;
    category?: string;
    confidence?: number;
}

interface FsxEc2Ref {
    instanceId: string;
    region?: string;
    vpcId?: string;
    operatingSystem?: string;
    workloads?: WorkloadEntry[];
}

interface FsxLun {
    id: string;
    lunUuid: string;
    lunName: string;
    ec2?: FsxEc2Ref[];
    workloads?: WorkloadEntry[];
}

interface FsxVolume {
    id: string;
    fsxVolumeId: string;
    volumeUuid: string;
    volumeName: string;
    luns: FsxLun[];
    ec2?: FsxEc2Ref[];
    workloads?: WorkloadEntry[];
    attachedDirectly?: boolean;
}

interface FsxItem {
    id: string;
    fileSystemId: string;
    region: string;
    volumes: FsxVolume[];
}

interface TaggingServiceEc2Host {
    instanceId: string;
    instanceType?: string;
    platform?: string;
    platformDetails?: string;
    architecture?: string;
    state?: string;
    imageId?: string;
    privateIp?: string;
    privateDnsName?: string;
    vpcId?: string;
    region?: string;
    tags?: { Key?: string; Value?: string }[];
    iamInstanceProfile?: { arn?: string };
    blockDeviceMappings?: { ebs?: { volumeId?: string } }[];
    workloads?: { workload: string }[];
}

interface Ec2WithStorage {
    instanceId: string;
    region?: string;
    vpcId?: string;
    operatingSystem?: string;
    workloadTypes: DATABASE_TYPE[];
    workloads: WorkloadEntry[];
    fsxs: FsxItem[];
}

type Ec2FsxRelationship = { ec2s: Ec2WithStorage[] };

interface Attachment {
    fsx: FsxItem;
    volume: FsxVolume;
    lun?: FsxLun;
    ref: FsxEc2Ref;
}

function toDatabaseType(workload: string): DATABASE_TYPE | undefined {
    const normalized = workload.toLowerCase();
    if (normalized.includes('sql server')) {
        return DATABASE_TYPE.mssql;
    }
    if (normalized.includes('oracle')) {
        return DATABASE_TYPE.oracle;
    }
    return undefined;
}

// Flattens the FSx -> volume -> (direct EC2 refs | LUN -> EC2 refs) tree into one flat
// list, with one entry per fsx/volume/lun?/ec2-ref path.
function collectAttachments(fsxs: FsxItem[]): Attachment[] {
    return fsxs.flatMap(fsx =>
        (fsx.volumes ?? []).flatMap(volume => [
            ...(volume.ec2 ?? []).map(ref => ({ fsx, volume, ref })),
            ...(volume.luns ?? []).flatMap(lun => (lun.ec2 ?? []).map(ref => ({ fsx, volume, lun, ref })))
        ])
    );
}

// Re-nests a flat, EC2-scoped slice of attachments back into a deduplicated
// FSx -> volume -> LUN tree.
function rebuildFsxTree(attachments: Attachment[]): FsxItem[] {
    return Object.values(groupBy(attachments, ({ fsx }) => fsx.id)).map(fsxItems => {
        const { id, fileSystemId, region } = fsxItems[0].fsx;
        const volumes: FsxVolume[] = Object.values(groupBy(fsxItems, ({ volume }) => volume.id)).map(volItems => {
            const { id: volumeId, fsxVolumeId, volumeUuid, volumeName } = volItems[0].volume;
            return {
                id: volumeId,
                fsxVolumeId,
                volumeUuid,
                volumeName,
                attachedDirectly: volItems.some(({ lun }) => !lun),
                luns: uniqBy(
                    volItems.flatMap(({ lun }) =>
                        lun ? [{ id: lun.id, lunUuid: lun.lunUuid, lunName: lun.lunName }] : []
                    ),
                    'id'
                )
            };
        });
        return { id, fileSystemId, region, volumes };
    });
}

// Gathers workload tags from the ec2-ref, volume, and LUN layers of a flat attachment
// slice, keeping only tags that classify to a known database type and deduplicating them.
function collectDatabaseWorkloads(items: Attachment[]): WorkloadEntry[] {
    const raw = items.flatMap(({ ref, volume, lun }) => [
        ...(ref.workloads ?? []),
        ...(volume.workloads ?? []),
        ...(lun?.workloads ?? [])
    ]);
    return uniqWith(
        raw.filter(({ workload }) => toDatabaseType(workload) !== undefined),
        isEqual
    );
}

async function withTaggingServiceCache<T>(
    accountId: string,
    credentialsId: string,
    region: string,
    kind: TAGGING_SERVICE_API_TYPES,
    cacheParams?: TaggingServiceCacheParams
): Promise<T> {
    logger.info('Looking up tagging service cache', { accountId, credentialsId, region, kind, cacheParams });

    const cacheKey = `tagging-service:${kind}:${accountId}:${credentialsId}:${region}`;
    const redisClient = getRedisConnection();
    const canUseRedis = isRedisConnected(redisClient);

    if (cacheParams?.useCache && canUseRedis) {
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                logger.info('Tagging service cache hit', { cacheKey });
                return JSON.parse(cached) as T;
            }
        } catch (error) {
            logger.warn('Error reading tagging service cache', {
                accountId,
                credentialsId,
                region,
                kind,
                cacheKey,
                error
            });
        }
    }

    const response = await callWlmHosts<T>(accountId, credentialsId, region, kind);

    if (canUseRedis) {
        try {
            await redisClient.set(cacheKey, JSON.stringify(response), 'PX', FOUR_HOURS_MS);
        } catch (error) {
            logger.warn('Error writing tagging service cache', {
                accountId,
                credentialsId,
                region,
                kind,
                cacheKey,
                error
            });
        }
    }

    return response;
}

/**
 * Inverts the FSx-centric tagging-service model into an EC2-centric view,
 * keeping only EC2 instances that run a recognized database workload (SQL Server
 * or Oracle) and have at least one FSx attachment.
 *
 * **Why it exists**
 * The WLM tagging service returns data organised around FSx file systems:
 *   FSx → volumes → (direct EC2 refs | LUNs → EC2 refs)
 * The storage-assessment pipeline needs the inverse: for each EC2, which FSx
 * volumes/LUNs is it using and what database workloads are tagged on it?
 * This function performs that inversion and drives subsequent ONTAP data
 * collection in `ontap-proxy-collector`.
 *
 * **Example** — output for one Windows SQL Server host with an AOAG data/log volume pair:
 * {
 *   "ec2s": [
 *     {
 *       "instanceId": "i-07a29eb681ba37679",
 *       "region": "ap-southeast-1",
 *       "vpcId": "vpc-84b3afe6",
 *       "operatingSystem": "windows",
 *       "workloadTypes": ["mssql"],
 *       "workloads": [
 *         { "workload": "SQL Server", "category": "Database", "confidence": 92 }
 *       ],
 *       "fsxs": [
 *         {
 *           "id": "fs-0f32f6c69fb7e40ac",
 *           "fileSystemId": "fs-0f32f6c69fb7e40ac",
 *           "region": "ap-southeast-1",
 *           "volumes": [
 *             {
 *               "id": "fsvol-0177538ff92902e77",
 *               "fsxVolumeId": "fsvol-0177538ff92902e77",
 *               "volumeUuid": "886296a3-4392-11f1-bc3b-5390d7156a06",
 *               "volumeName": "wlmdb_sqldata_1777443197",
 *               "attachedDirectly": false,
 *               "luns": [
 *                 { "id": "9b70a844-8a8c-419b-b6ab-02cb1bdac969", "lunUuid": "9b70a844-8a8c-419b-b6ab-02cb1bdac969", "lunName": "/vol/wlmdb_sqldata_1777443197/sqldata" }
 *               ]
 *             },
 *             {
 *               "id": "fsvol-01813dffc3c56ae09",
 *               "fsxVolumeId": "fsvol-01813dffc3c56ae09",
 *               "volumeUuid": "886740a5-4392-11f1-bc3b-5390d7156a06",
 *               "volumeName": "wlmdb_sqllog_1777443197",
 *               "attachedDirectly": false,
 *               "luns": [
 *                 { "id": "99f9d53e-3601-4056-a805-3a9c80007c54", "lunUuid": "99f9d53e-3601-4056-a805-3a9c80007c54", "lunName": "/vol/wlmdb_sqllog_1777443197/sqllog" }
 *               ]
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 * Note: real `workloads` entries may carry extra service-specific fields (e.g. `reasoning`,
 * `evidence`) beyond the declared `WorkloadEntry` shape; those are omitted above for brevity.
 */
async function buildEc2FsxRelationship(
    accountId: string,
    credentialsId: string,
    region: string,
    cacheParams?: TaggingServiceCacheParams
): Promise<Ec2FsxRelationship> {
    logger.info('Building EC2-FSx relationship using tagging service apis ', { accountId, region, cacheParams });

    const { fsxs = [] } = await withTaggingServiceCache<{ fsxs?: FsxItem[] }>(
        accountId,
        credentialsId,
        region,
        TAGGING_SERVICE_API_TYPES.FSXS,
        cacheParams
    );
    logger.debug('Retrieved FSx entries from tagging service', { accountId, region, fsxCount: fsxs.length });

    const attachments = collectAttachments(fsxs);
    logger.debug('Collected EC2-volume-LUN attachments', { accountId, region, attachmentCount: attachments.length });

    const ec2s = Object.entries(groupBy(attachments, ({ ref }) => ref.instanceId))
        .map(([instanceId, items]) => {
            const refs = items.map(({ ref }) => ref);
            const workloads = collectDatabaseWorkloads(items);
            return {
                instanceId,
                region: refs.find(r => r.region)?.region,
                vpcId: refs.find(r => r.vpcId)?.vpcId,
                operatingSystem: refs.find(r => r.operatingSystem)?.operatingSystem,
                workloads,
                workloadTypes: [
                    ...new Set(
                        workloads
                            .map(({ workload }) => toDatabaseType(workload))
                            .filter((x): x is DATABASE_TYPE => x !== undefined)
                    )
                ],
                fsxs: rebuildFsxTree(items)
            };
        })
        .filter(({ workloads, fsxs: f }) => workloads.length > 0 && f.length > 0);

    logger.info('Built EC2-FSx relationship using tagging service apis ', {
        accountId,
        region,
        ec2Count: ec2s.length,
        ec2Ids: ec2s.map(({ instanceId }) => instanceId)
    });

    return { ec2s };
}

/**
 * Fetches the tagging-service EC2 inventory (`wlm-hosts/ec2s`) for an account/region.
 * Used by the discover flow to supplement SSM/EC2-describe based discovery with
 * instances the tagging service already knows about (see `discoverEc2Instances`).
 */
async function fetchTaggingServiceEc2Hosts(
    accountId: string,
    credentialsId: string,
    region: string,
    cacheParams?: TaggingServiceCacheParams
): Promise<TaggingServiceEc2Host[]> {
    logger.info('Fetching EC2 hosts from tagging service', { accountId, credentialsId, region, cacheParams });
    const { hosts = [] } = await withTaggingServiceCache<{ hosts?: TaggingServiceEc2Host[] }>(
        accountId,
        credentialsId,
        region,
        TAGGING_SERVICE_API_TYPES.EC2S,
        cacheParams
    );
    const databaseHosts = hosts.filter(({ workloads }) =>
        workloads?.some(({ workload }) => {
            const normalized = workload.toLowerCase();
            return (
                normalized.includes('oracle') || normalized.includes('sql server') || normalized.includes('postgresql')
            );
        })
    );
    logger.debug('Retrieved EC2 hosts from tagging service', { accountId, region, hostCount: databaseHosts.length });
    return databaseHosts;
}

export {
    buildEc2FsxRelationship,
    Ec2FsxRelationship,
    Ec2WithStorage,
    FsxItem,
    FsxVolume,
    FsxLun,
    fetchTaggingServiceEc2Hosts,
    TaggingServiceEc2Host
};
