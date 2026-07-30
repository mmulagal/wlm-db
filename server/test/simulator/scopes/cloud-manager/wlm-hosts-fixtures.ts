import { createHash } from 'crypto';
import { FsxItem, FsxVolume } from '../../../../src/operations/cloud-manager/tagging-service-operations';
import { registerDefaultProxyGetResponse } from './proxy-forwarder-scope';

// Reuse the general-purpose "canonical demo FSx id" already used by other FSx-related mocks
// (e.g. demoMockdata.ts, FSx DescribeFileSystems fixtures) so this stays consistent.
const FILE_SYSTEM_ID = 'fs-0d5efc3057c4f12cb';

type WorkloadType = 'mssql' | 'oracle';

interface FsxnHost {
    ec2InstanceId: string;
    vpcId: string;
    workloadType: WorkloadType;
    operatingSystem: string;
    /** SQL Server instance names / Oracle instance ids running on this EC2. */
    instanceNames: string[];
}

// The 13 FSXN-backed hosts from `demoInventoryData.ts` (8 MSSQL, 5 Oracle) - every host whose
// `storage` entries use `type: 'FSXN'`. Adding a row here automatically gets ONTAP fixtures via
// buildFsxItemForRegion()/ALL_ONTAP_VOLUME_RECORDS/ALL_ONTAP_LUN_RECORDS below.
const FSXN_HOSTS: FsxnHost[] = [
    {
        ec2InstanceId: 'i-b0a57935835ddfce4',
        vpcId: 'vpc-84b3afe6',
        workloadType: 'mssql',
        operatingSystem: 'windows',
        instanceNames: ['PreProd-BusinessIntelligence', 'MSSQLSERVER']
    },
    {
        ec2InstanceId: 'i-0c1d2e3f4a5b6c701',
        vpcId: 'vpc-84b3afe6',
        workloadType: 'mssql',
        operatingSystem: 'windows',
        instanceNames: ['PROD-MarketingCampaigns', 'PROD-SupplierManagement', 'PROD-ProductCatalog', 'MSSQLSERVER']
    },
    {
        ec2InstanceId: 'i-0c1d2e3f4a5b6c702',
        vpcId: 'vpc-84b3afe6',
        workloadType: 'mssql',
        operatingSystem: 'windows',
        instanceNames: ['DEV-SalesAnalytics', 'DEV-ProjectManagement', 'MSSQLSERVER']
    },
    {
        ec2InstanceId: 'i-fe881ebd880a3e61f',
        vpcId: 'vpc-84b3afe6',
        workloadType: 'mssql',
        operatingSystem: 'windows',
        instanceNames: ['MSSQLSERVER', 'UAT-QualityControl']
    },
    {
        ec2InstanceId: 'i-0a1b2c3d4e5f6a0a1',
        vpcId: 'vpc-84b3afe6',
        workloadType: 'mssql',
        operatingSystem: 'windows',
        instanceNames: ['MSSQLSERVER']
    },
    {
        ec2InstanceId: 'i-0a1b2c3d4e5f6a0a2',
        vpcId: 'vpc-84b3afe6',
        workloadType: 'mssql',
        operatingSystem: 'windows',
        instanceNames: ['MSSQLSERVER']
    },
    {
        ec2InstanceId: 'i-0b2c3d4e5f6a7b8c1',
        vpcId: 'vpc-84b3afe6',
        workloadType: 'mssql',
        operatingSystem: 'windows',
        instanceNames: ['MSSQLSERVER']
    },
    {
        ec2InstanceId: 'i-0b2c3d4e5f6a7b8c2',
        vpcId: 'vpc-84b3afe6',
        workloadType: 'mssql',
        operatingSystem: 'windows',
        instanceNames: ['MSSQLSERVER']
    },
    {
        ec2InstanceId: 'i-25694686',
        vpcId: 'vpc-0100cefdf732ef9e9',
        workloadType: 'oracle',
        operatingSystem: 'linux',
        instanceNames: ['oracleasm']
    },
    {
        ec2InstanceId: 'i-37030647',
        vpcId: 'vpc-0100cefdf732ef9e9',
        workloadType: 'oracle',
        operatingSystem: 'linux',
        instanceNames: ['oracle']
    },
    {
        ec2InstanceId: 'i-5520fe41798c75632',
        vpcId: 'vpc-0100cefdf732ef9e9',
        workloadType: 'oracle',
        operatingSystem: 'linux',
        instanceNames: ['oracle-dev']
    },
    {
        ec2InstanceId: 'i-0123456789abcdef0',
        vpcId: 'vpc-075ecf35aaafc2a4f',
        workloadType: 'oracle',
        operatingSystem: 'linux',
        instanceNames: ['dataguard-primary']
    },
    {
        ec2InstanceId: 'i-0123456789abcdef1',
        vpcId: 'vpc-075ecf35aaafc2a4f',
        workloadType: 'oracle',
        operatingSystem: 'linux',
        instanceNames: ['dataguard-standby']
    }
];

function sha256(seed: string): string {
    return createHash('sha256').update(seed).digest('hex');
}

/** Deterministic UUID (v4-shaped, not spec-random) derived from `seed`, so re-runs are stable. */
function deterministicUuid(seed: string): string {
    const hex = sha256(seed);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function deterministicAwsId(prefix: string, seed: string): string {
    return `${prefix}-${sha256(seed).slice(0, 17)}`;
}

type VolumePart = 'data' | 'log';

interface InstanceVolume {
    ec2InstanceId: string;
    fsxVolumeId: string;
    volumeUuid: string;
    volumeName: string;
    lunUuid: string;
    lunName: string;
}

// One data + one log/redo volume (each with a single LUN) per named SQL Server instance / Oracle
// instance, independent of region so the plain ONTAP record arrays below can reuse the same ids.
function buildInstanceVolumes(): InstanceVolume[] {
    return FSXN_HOSTS.flatMap(({ ec2InstanceId, workloadType }) => {
        const namePrefix = workloadType === 'mssql' ? 'sql' : 'ora';
        return FSXN_HOSTS.find(h => h.ec2InstanceId === ec2InstanceId)!.instanceNames.flatMap(instanceName =>
            (['data', 'log'] as VolumePart[]).map(part => {
                const seed = `${ec2InstanceId}|${instanceName}|${part}`;
                const suffix = sha256(seed).slice(0, 10);
                const volumeName = `wlmdb_${namePrefix}${part}_${suffix}`;
                return {
                    ec2InstanceId,
                    fsxVolumeId: deterministicAwsId('fsvol', seed),
                    volumeUuid: deterministicUuid(seed),
                    volumeName,
                    lunUuid: deterministicUuid(`${seed}|lun`),
                    lunName: `/vol/${volumeName}/${part === 'data' ? 'data' : 'log'}`
                };
            })
        );
    });
}

const INSTANCE_VOLUMES = buildInstanceVolumes();

function buildFsxItemForRegion(region: string): FsxItem {
    const hostByInstanceId = new Map(FSXN_HOSTS.map(host => [host.ec2InstanceId, host]));
    const volumes: FsxVolume[] = INSTANCE_VOLUMES.map(
        ({ ec2InstanceId, fsxVolumeId, volumeUuid, volumeName, lunUuid, lunName }) => {
            const host = hostByInstanceId.get(ec2InstanceId)!;
            const ec2 = [
                {
                    instanceId: ec2InstanceId,
                    region,
                    vpcId: host.vpcId,
                    operatingSystem: host.operatingSystem,
                    workloads: [
                        {
                            workload: host.workloadType === 'mssql' ? 'SQL Server' : 'Oracle',
                            category: 'Database',
                            confidence: 92
                        }
                    ]
                }
            ];
            return {
                id: fsxVolumeId,
                fsxVolumeId,
                volumeUuid,
                volumeName,
                luns: [{ id: lunUuid, lunUuid, lunName, ec2 }]
            };
        }
    );
    return { id: FILE_SYSTEM_ID, fileSystemId: FILE_SYSTEM_ID, region, volumes };
}

function osTypeFor(ec2InstanceId: string): string {
    return FSXN_HOSTS.find(h => h.ec2InstanceId === ec2InstanceId)?.workloadType === 'mssql' ? 'windows' : 'linux';
}

// Shaped for the ONTAP REST mock: field selections match VOLUME_FIELDS/LUN_FIELDS in
// ontap-proxy-collector.ts. ontap-proxy-collector filters these client-side by the UUIDs actually
// attached to the requesting EC2, so it's safe to register this whole set under one fileSystemId.
const ALL_ONTAP_VOLUME_RECORDS = INSTANCE_VOLUMES.map(({ volumeUuid, volumeName }) => ({
    name: volumeName,
    uuid: volumeUuid,
    svm: { name: 'wlmdb_svm', uuid: deterministicUuid(`svm|${volumeUuid}`) },
    nas: { path: `/${volumeName}` },
    autosize: { mode: 'grow' },
    space: { fractional_reserve: 0, snapshot: { reserve_percent: 0, autodelete: { enabled: true } } },
    snapshot_policy: { name: 'default' },
    tiering: { policy: 'auto', min_cooling_days: 7 },
    guarantee: { honored: true, type: 'volume' },
    efficiency: {
        compression: 'true',
        compression_type: 'inline',
        compaction: 'true',
        dedupe: 'true',
        storage_efficiency_mode: 'default'
    }
}));

const ALL_ONTAP_LUN_RECORDS = INSTANCE_VOLUMES.map(({ ec2InstanceId, lunUuid, lunName }) => ({
    name: lunName,
    uuid: lunUuid,
    os_type: osTypeFor(ec2InstanceId),
    space: { guarantee: { requested: false }, scsi_thin_provisioning_support_enabled: true }
}));

function registerOntapDefaults(): void {
    registerDefaultProxyGetResponse({
        targetId: FILE_SYSTEM_ID,
        ontapPath: 'api/storage/volumes',
        body: { records: ALL_ONTAP_VOLUME_RECORDS, num_records: ALL_ONTAP_VOLUME_RECORDS.length }
    });
    registerDefaultProxyGetResponse({
        targetId: FILE_SYSTEM_ID,
        ontapPath: 'api/storage/luns',
        body: { records: ALL_ONTAP_LUN_RECORDS, num_records: ALL_ONTAP_LUN_RECORDS.length }
    });
    registerDefaultProxyGetResponse({
        targetId: FILE_SYSTEM_ID,
        ontapPath: 'api/private/cli/volume',
        body: {
            records: INSTANCE_VOLUMES.map(({ volumeName }) => ({ volume: volumeName, space_mgmt_try_first: true })),
            num_records: INSTANCE_VOLUMES.length
        }
    });
    registerDefaultProxyGetResponse({
        targetId: FILE_SYSTEM_ID,
        ontapPath: 'api/private/cli/volume/show-footprint',
        body: {
            records: INSTANCE_VOLUMES.map(({ volumeName }) => ({
                volume: volumeName,
                volume_blocks_footprint_bin0_percent: 42
            })),
            num_records: INSTANCE_VOLUMES.length
        }
    });
    registerDefaultProxyGetResponse({
        targetId: FILE_SYSTEM_ID,
        ontapPath: 'api/storage/aggregates',
        body: {
            records: [
                {
                    space: {
                        block_storage: { size: 10995116277760, used: 3298534883328, available: 7696581394432 }
                    }
                }
            ],
            num_records: 1
        }
    });
}

registerOntapDefaults();

export { FILE_SYSTEM_ID, buildFsxItemForRegion, ALL_ONTAP_VOLUME_RECORDS, ALL_ONTAP_LUN_RECORDS };
