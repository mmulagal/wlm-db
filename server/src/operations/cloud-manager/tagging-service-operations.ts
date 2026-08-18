import { DATABASE_TYPE } from '@prisma/client';
import {
    callWlmHostsGraphql,
    EC2_DATABASE_INSTANCES_QUERY,
    EC2_STORAGE_ORACLE_MSSQL_QUERY
} from '../../lib/cloud-manager/tagging-service';
import getLogger from '../../utils/logger';
import { LINUX, STORAGE_PROTOCOLS, TaggingServiceCacheParams, WINDOWS } from '../../utils/consts';
import { getRedisConnection, isRedisConnected } from '../../utils/utils';

const logger = getLogger();

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

interface WorkloadEntry {
    workload: string;
    category?: string;
    confidence?: number;
    isPrimary?: boolean;
}

interface GraphqlRelationship {
    computeId: string;
    storageId: string;
    storageType: string;
}

interface GraphqlEc2Instance {
    instanceId: string;
    region?: string;
    vpcId?: string;
    platform?: string | null;
    workloads?: WorkloadEntry[];
}

interface GraphqlFsxVolume {
    volumeId: string;
    fileSystemId: string;
    ontapUuid: string;
    name: string;
    region: string;
    workloads?: WorkloadEntry[];
}

interface GraphqlOntapVolume {
    uuid: string;
    workloads?: WorkloadEntry[];
}

interface GraphqlOntapLun {
    uuid: string;
    name: string;
    fileSystemId: string;
    volumeName: string;
    workloads?: WorkloadEntry[];
}

interface Ec2StorageGraphData {
    relationships?: GraphqlRelationship[];
    ec2Instances?: GraphqlEc2Instance[];
    fsxVolumes?: GraphqlFsxVolume[];
    ontapVolumes?: GraphqlOntapVolume[];
    ontapLuns?: GraphqlOntapLun[];
}

interface FsxLun {
    id: string;
    lunUuid: string;
    lunName: string;
}

interface FsxVolume {
    id: string;
    fsxVolumeId: string;
    volumeUuid: string;
    volumeName: string;
    luns?: FsxLun[];
    protocol?: string;
    attachedDirectly?: boolean;
}

interface FsxItem {
    id: string;
    fileSystemId: string;
    region: string;
    volumes: FsxVolume[];
}

interface GraphqlEc2DatabaseInstance {
    instanceId: string;
    instanceType?: string;
    platform?: string | null;
    platformDetails?: string;
    usageOperation?: string;
    privateIpAddress?: string;
    privateDnsName?: string;
    vpcId?: string;
    subnetId?: string;
    rootDeviceName?: string;
    rootDeviceType?: string;
    placement?: {
        availabilityZone?: string;
        availabilityZoneId?: string;
        affinity?: string | null;
        groupId?: string | null;
        groupName?: string;
        hostId?: string | null;
        hostResourceGroupArn?: string | null;
        partitionNumber?: number | null;
        spreadDomain?: string | null;
        tenancy?: string;
    };
    iamInstanceProfile?: { arn?: string; id?: string };
    blockDeviceMappings?: {
        deviceName?: string;
        ebs?: {
            volumeId?: string;
            status?: string;
            attachTime?: string;
            deleteOnTermination?: boolean;
            volumeOwnerId?: string | null;
            ebsCardIndex?: number;
            associatedResource?: string | null;
        };
    }[];
    workloads?: WorkloadEntry[];
}

type Ec2DatabaseInstancesGraphData = { ec2Instances?: GraphqlEc2DatabaseInstance[] };

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

interface VolumeDraft {
    fsxVolumeId: string;
    volumeUuid: string;
    volumeName: string;
    fileSystemId: string;
    region: string;
    attachedDirectly: boolean;
    luns: Map<string, string>;
}

interface Ec2Draft {
    volumes: Map<string, VolumeDraft>;
    storageWorkloads: WorkloadEntry[];
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

// Keeps only database workloads (SQL Server / Oracle) and drops duplicates.
function dedupeDatabaseWorkloads(workloads: WorkloadEntry[]): WorkloadEntry[] {
    const byKey = new Map<string, WorkloadEntry>();
    for (const { workload, category, confidence, isPrimary } of workloads) {
        if (toDatabaseType(workload) !== undefined) {
            const key = `${workload}::${category}::${confidence}::${isPrimary}`;
            if (!byKey.has(key)) {
                byKey.set(key, { workload, category, confidence, isPrimary });
            }
        }
    }
    return [...byKey.values()];
}

async function withTaggingServiceCache<T>(
    accountId: string,
    credentialsId: string,
    region: string,
    resource: string,
    query: string,
    cacheParams?: TaggingServiceCacheParams
): Promise<T> {
    logger.info('Looking up tagging service cache', { accountId, credentialsId, region, resource, cacheParams });

    const cacheKey = `tagging-service:${resource}:${accountId}:${credentialsId}:${region}`;
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
                resource,
                cacheKey,
                error
            });
        }
    }

    const response = await callWlmHostsGraphql<T>(accountId, credentialsId, region, query);

    if (canUseRedis) {
        try {
            await redisClient.set(cacheKey, JSON.stringify(response), 'PX', FOUR_HOURS_MS);
        } catch (error) {
            logger.warn('Error writing tagging service cache', {
                accountId,
                credentialsId,
                region,
                resource,
                cacheKey,
                error
            });
        }
    }

    return response;
}

// Attaches a volume (directly or through a LUN) to an EC2 draft; repeated relationships are
// collapsed by the per-EC2 volume map and the per-volume LUN map.
function attachStorage(
    drafts: Map<string, Ec2Draft>,
    instanceId: string,
    volume: GraphqlFsxVolume,
    workloads: WorkloadEntry[],
    lun?: GraphqlOntapLun
) {
    const draft = drafts.get(instanceId) ?? { volumes: new Map<string, VolumeDraft>(), storageWorkloads: [] };
    drafts.set(instanceId, draft);

    const volumeDraft = draft.volumes.get(volume.ontapUuid) ?? {
        fsxVolumeId: volume.volumeId,
        volumeUuid: volume.ontapUuid,
        volumeName: volume.name,
        fileSystemId: volume.fileSystemId,
        region: volume.region,
        attachedDirectly: false,
        luns: new Map<string, string>()
    };
    draft.volumes.set(volume.ontapUuid, volumeDraft);

    if (lun) {
        volumeDraft.luns.set(lun.uuid, lun.name);
    } else {
        volumeDraft.attachedDirectly = true;
    }

    draft.storageWorkloads.push(...workloads);
}

function toFsxItems(volumes: Map<string, VolumeDraft>): FsxItem[] {
    const fsxByFileSystem = new Map<string, FsxItem>();
    for (const {
        fsxVolumeId,
        volumeUuid,
        volumeName,
        fileSystemId,
        region,
        attachedDirectly,
        luns
    } of volumes.values()) {
        const fsx = fsxByFileSystem.get(fileSystemId) ?? { id: fileSystemId, fileSystemId, region, volumes: [] };
        fsxByFileSystem.set(fileSystemId, fsx);
        fsx.volumes.push({
            id: fsxVolumeId,
            fsxVolumeId,
            volumeUuid,
            volumeName,
            attachedDirectly,
            protocol: luns.size > 0 ? STORAGE_PROTOCOLS.ISCSI : STORAGE_PROTOCOLS.NFS,
            ...(luns.size > 0 && {
                luns: [...luns.entries()].map(([lunUuid, lunName]) => ({ id: lunUuid, lunUuid, lunName }))
            })
        });
    }
    return [...fsxByFileSystem.values()];
}

/**
 * Builds an EC2-centric view of FSx for ONTAP storage from the wlm-hosts GraphQL API,
 * keeping only EC2 instances that run a database workload (SQL Server or Oracle) and
 * have at least one resolved FSx attachment. Drives ONTAP data collection in
 * `ontap-proxy-collector`.
 *
 * The GraphQL response is flat: `relationships` link an EC2 (`computeId`) to storage
 * (`storageId`) that is either an ONTAP volume (`storageId` = `fsxVolumes.ontapUuid`) or
 * an ONTAP LUN (`storageId` = `ontapLuns.uuid`, whose parent FSx volume is matched by
 * `fileSystemId` + `volumeName`). The per-EC2 volume/LUN maps naturally dedupe repeats.
 */
async function buildEc2FsxRelationship(
    accountId: string,
    credentialsId: string,
    region: string,
    cacheParams?: TaggingServiceCacheParams
): Promise<Ec2FsxRelationship> {
    logger.info('Building EC2-FSx relationship using tagging service apis ', { accountId, region, cacheParams });

    const {
        relationships = [],
        ec2Instances = [],
        fsxVolumes = [],
        ontapVolumes = [],
        ontapLuns = []
    } = await withTaggingServiceCache<Ec2StorageGraphData>(
        accountId,
        credentialsId,
        region,
        'ec2-storage',
        EC2_STORAGE_ORACLE_MSSQL_QUERY,
        cacheParams
    );

    const ec2ById = new Map(ec2Instances.map(ec2 => [ec2.instanceId, ec2]));
    const fsxByOntapUuid = new Map(fsxVolumes.map(volume => [volume.ontapUuid, volume]));
    const fsxByFileSystemAndName = new Map(
        fsxVolumes.map(volume => [`${volume.fileSystemId}::${volume.name}`, volume])
    );
    const ontapWorkloadsByUuid = new Map(ontapVolumes.map(volume => [volume.uuid, volume.workloads]));
    const lunByUuid = new Map(ontapLuns.map(lun => [lun.uuid, lun]));

    const draftByEc2 = new Map<string, Ec2Draft>();

    for (const { computeId, storageId, storageType } of relationships) {
        if (ec2ById.has(computeId)) {
            if (storageType === 'ontap_volumes') {
                const volume = fsxByOntapUuid.get(storageId);
                if (volume) {
                    const workloads = [...(volume.workloads ?? []), ...(ontapWorkloadsByUuid.get(storageId) ?? [])];
                    attachStorage(draftByEc2, computeId, volume, workloads);
                }
            } else if (storageType === 'ontap_luns') {
                const lun = lunByUuid.get(storageId);
                const volume = lun && fsxByFileSystemAndName.get(`${lun.fileSystemId}::${lun.volumeName}`);
                if (lun && volume) {
                    attachStorage(draftByEc2, computeId, volume, lun.workloads ?? [], lun);
                }
            }
        }
    }

    const ec2s: Ec2WithStorage[] = [];
    for (const [instanceId, { volumes, storageWorkloads }] of draftByEc2) {
        const { region: ec2Region, vpcId, platform, workloads: ec2Workloads } = ec2ById.get(instanceId)!;
        const workloads = dedupeDatabaseWorkloads([...(ec2Workloads ?? []), ...storageWorkloads]);
        const fsxs = toFsxItems(volumes);
        if (workloads.length > 0 && fsxs.length > 0) {
            ec2s.push({
                instanceId,
                region: ec2Region,
                vpcId,
                // EC2 reports `platform` only for Windows instances; everything else is Linux.
                operatingSystem: platform?.toLowerCase() === WINDOWS ? WINDOWS : LINUX,
                workloads,
                workloadTypes: [
                    ...new Set(
                        workloads
                            .map(({ workload }) => toDatabaseType(workload))
                            .filter((type): type is DATABASE_TYPE => type !== undefined)
                    )
                ],
                fsxs
            });
        }
    }

    logger.info('Built EC2-FSx relationship using tagging service apis ', {
        accountId,
        region,
        ec2Count: ec2s.length,
        ec2Ids: ec2s.map(({ instanceId }) => instanceId)
    });

    return { ec2s };
}

/**
 * Fetches the tagging-service EC2 database inventory for an account/region.
 * Used by the discover flow to supplement SSM/EC2-describe based discovery with
 * instances the tagging service already knows about (see `discoverEc2Instances`).
 */
async function fetchTaggingServiceEc2Hosts(
    accountId: string,
    credentialsId: string,
    region: string,
    cacheParams?: TaggingServiceCacheParams
): Promise<GraphqlEc2DatabaseInstance[]> {
    logger.info('Fetching EC2 hosts from tagging service', { accountId, credentialsId, region, cacheParams });
    const { ec2Instances = [] } = await withTaggingServiceCache<Ec2DatabaseInstancesGraphData>(
        accountId,
        credentialsId,
        region,
        'ec2-database-instances',
        EC2_DATABASE_INSTANCES_QUERY,
        cacheParams
    );
    const databaseHosts = ec2Instances.filter(({ workloads }) => workloads && workloads.length > 0);
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
    GraphqlEc2DatabaseInstance
};
