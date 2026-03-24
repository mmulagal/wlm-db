import config from 'config';
import { Static, Type } from 'typebox';
import { RESOURCESTYPE, WLMDB } from './consts';
import { DatabaseInstanceMetadata } from './common-types';

enum AssessmentCategories {
    STORAGE = 'storage',
    COMPUTE = 'compute',
    LICENSE = 'license',
    HOST_OS_PATCH = 'host-os-patch',
    RSS_CONFIG = 'rss-config',
    MAXDOP = 'maxdop',
    MSSQL_PATCH = 'mssql-patch',
    MAPPED_ONTAP_VOLUMES = 'mapped-ontap-volumes',
    CLONE = 'clone',
    SNAPSHOT_POLICY = 'snapshot-policy',
    AWS_BACKUP = 'aws-backup',
    CRR = 'crr',
    HIGH_AVAILABILITY = 'high-availability',
    MTU_ALIGNMENT = 'mtu-alignment',
    ORACLE_SECURITY_PATCH = 'oracle-security-patch'
}

enum AssessmentCategoriesOracle {
    STORAGE = 'storage',
    MAPPED_ONTAP_VOLUMES = 'mapped-ontap-volumes',
    HOST_OS_PATCH = 'host-os-patch',
    CRR = 'crr',
    SNAPCENTER_SNAPSHOT = 'snapcenter-snapshot',
    ORACLE_SECURITY_PATCH = 'oracle-security-patch'
}

enum AssessmentTriggeredBy {
    SYSTEM = 'system',
    USER = 'user'
}

enum AssessmentStatus {
    OPTIMIZED = 'optimized',
    NOT_OPTIMIZED = 'not-optimized',
    UNDER_PROVISIONED = 'under-provisioned',
    OVER_PROVISIONED = 'over-provisioned',
    ANALYZING = 'analyzing'
}

enum AwsWellArchitecturedPillars {
    PERFORMANCE_EFFICIENCY = 'Performance efficiency',
    RELIABILITY = 'Reliability',
    COST_OPTIMIZATION = 'Cost optimization',
    OPERATIONAL_EXCELLENCE = 'Operational excellence',
    SECURITY = 'Security',
    COST_EFFICIENCY = 'Cost efficiency'
}

const VOLUME = 'volume';
const LUN = 'lun';
const VSERVER = 'vserver';

const NUMASTATIC = 'NUMAStatic';

// Redis
const REDIS_URL = process.env.REDIS_ENDPOINT || config.get('redis.endpoint') || '127.0.0.1:6379';

enum OptimizeOracleTypes {
    STORAGE_CONFIGURATION = 'storage-configuration',
    STORAGE_LAYOUT = 'storage-layout',
    STORAGE_OPERATING_SYSTEM = 'storage-operating-system',
    STORAGE_SIZING = 'storage-sizing'
}

const OracleOptimizeJobDescriptions = {
    [OptimizeOracleTypes.STORAGE_CONFIGURATION]: 'Fix Oracle Storage Configuration',
    [OptimizeOracleTypes.STORAGE_LAYOUT]: 'Fix Oracle Storage Layout',
    [OptimizeOracleTypes.STORAGE_OPERATING_SYSTEM]: 'Fix Oracle Storage Operating System',
    [OptimizeOracleTypes.STORAGE_SIZING]: 'Fix Oracle Storage Sizing'
};

enum OptimizeOracleiSCSIStorageOperatingSystem {
    TCP_OPTIONS = 'tcp-advanced-options',
    MULTIPATH_ENABLE = 'multipath-io',
    HOST_UTILITIES = 'host-utilities',
    THP_DISABLE = 'transparent-hugepages',
    ISCSI_REPLACEMENT_TIMEOUT = 'iscsi-replacement-timeout',
    MULTIPATH_IO_SESSIONS = 'multipath-io-sessions',
    FILESYSTEM_IO_OPTIONS = 'filesystems-io-options',
    MULTIPATH_CONFIGURATION = 'multipath-configuration',
    MULTIPATH_FRIENDLY_NAMES = 'multipath-friendly-names',
    MULTIBLOCK_READCOUNT = 'multiblock-readcount',
    ORACLE_AFD_LOGICAL_BLOCK_SIZE = 'afd-logical-block-size',
    ORACLE_ASM_LOGICAL_BLOCK_SIZE = 'asmlib-logical-block-size'
}

enum OptimizeOracleNFSStorageOperatingSystem {
    KERNEL_PARAMETERS = 'kernel-parameters',
    NFS_MOUNT_OPTIONS_DATABASEFILES = 'nfs-mount-options-databasefiles',
    NFS_MOUNT_OPTIONS_ADRHOME = 'nfs-mount-options-adrhome',
    NFSV4_DOMAIN_NAME = 'nfsv4-domain-name',
    NFS_CACHING_OPTIONS = 'nfs-caching-options'
}

enum OptimizeOracleStorageSizing {
    HEADROOM = 'headroom'
}

enum OptimizeStorageConfigs {
    THIN_PROVISIONING = 'thin-provision',
    AUTOSIZE = 'autosize',
    AUTOSIZE_MODE = 'autosize-mode',
    FRACTIONAL_RESERVE = 'fractional-reserve',
    SNAPSHOT_COPY_RESERVE = 'snapshot-copy-reserve',
    SNAPSHOT_AUTO_DELETE = 'snapshot-autodelete',
    SNAPSHOT_POLICY = 'snapshot-policy',
    SPACE_MANAGEMENT = 'space-mgmt-try-first',
    TIERING_MINIMUM_COOLING_DAYS = 'tiering-min-cooling-days',
    TIERING_POLICY = 'tiering-policy',
    SPACE_RESERVATION = 'space-reservation-enabled',
    SPACE_ALLOCATION = 'space-allocation-allocated',
    MOST_RECENT_SNAPSHOT_TIMESTAMP = 'most-recent-snapshot-timestamp',
    COMPRESSION = 'compression',
    DEDUPLICATION = 'deduplication',
    COMPACTION = 'compaction',
    ARCHIVE_LOG_LAYOUT = 'archivelog-dg-lun-layout',
    FRA_LAYOUT = 'fra-dg-lun-layout',
    REDO_LOG_LAYOUT = 'redolog-dg-lun-layout',
    DATA_LAYOUT = 'data-dg-lun-layout',
    NFS_ROOTONLY = 'nfs-rootonly',
    EXPORT_POLICY = 'export-policy'
}

enum OptimizeStorageConfigsJobNames {
    THIN_PROVISIONING = 'thin provisioning',
    AUTOSIZE = 'autosize',
    AUTOSIZE_MODE = 'autosize-mode',
    FRACTIONAL_RESERVE = 'fractional reserve',
    SNAPSHOT_COPY_RESERVE = 'snapshot copy reserve',
    SNAPSHOT_AUTO_DELETE = 'snapshot autodelete',
    SPACE_MANAGEMENT = 'space management',
    TIERING_MINIMUM_COOLING_DAYS = 'tiering minimum cooling days',
    TIERING_POLICY = 'tiering policy',
    SPACE_RESERVATION = 'space reservation enabled',
    SPACE_ALLOCATION = 'space allocation',
    COMPRESSION = 'compression',
    DEDUPLICATION = 'deduplication',
    COMPACTION = 'compaction',
    NFS_ROOTONLY = 'nfs rootonly',
    EXPORT_POLICY = 'binaries export policy'
}

enum OptimizeOperatingSystemParams {
    MPIO_POLICY = 'mpio-load-balance-policy',
    MPIO_SESSIONS = 'mpio-iscsi-count',
    MPIO_ENABLE = 'mpio-enabled',
    MPIO_TIMEOUT = 'mpio-timeout'
}

enum OptimizeHighAvailabilityParams {
    SHARED_STORAGE = 'shared-storage',
    HEARTBEAT_SETTINGS = 'heartbeat-settings',
    CLUSTER_QUORUM = 'cluster-quorum',
    SQLSERVER_SERVICE = 'sqlServer-service'
}

enum OptimizeStorageTierParams {
    STORAGE_TIER = 'storage-tier'
}

enum OptimizeComputeParams {
    COMPUTE = 'compute',
    RSS_CONFIG = 'rss-config'
}

enum OptimizeComputeJobNames {
    'rss-config' = 'Network adapter configuration',
    compute = 'Compute'
}

enum OPTIMIZE_SIZING_CONFIGS {
    HEADROOM = 'headroom',
    LOG_DRIVE_SIZE = 'log-drive-size',
    TEMPDB_DRIVE_SIZE = 'tempdb-drive-size'
}

enum OPTIMIZE_RESILIENCY_CONFIGS {
    SNAPSHOT_POLICY = 'snapshot-policy',
    AWS_BACKUP = 'aws-backup',
    HIGH_AVAILABILITY = 'high-availability'
}

enum OptimizeMaxDopParams {
    MAX_DOP = 'max-dop'
}

enum OptimizeCloneParams {
    CLONE = 'clone'
}

enum OPTIMIZATION_CATEGORIES {
    STORAGE_TIER = 'storage-tier',
    STORAGE_SIZING = 'storage-sizing',
    OPERATING_SYSTEM = 'operating-system',
    COMPUTE = 'compute',
    MAXDOP = 'max-dop',
    RSS_CONFIG = 'rss-config',
    CLONE = 'clone',
    MTU_ALIGNMENT = 'mtu-alignment'
}

enum DISMISS_STATUS_ENUM {
    DISMISSED = 'DISMISSED',
    POSTPONED = 'POSTPONED',
    ACTIVE = 'ACTIVE'
}

const DRIFT_ASSESSMENT_QUEUE = 'WLMDB-AssessmentQueue';
const SEVERITY = {
    CRITICAL: 'critical',
    WARNING: 'warning'
};

const OptimizeStorageApiData = {
    THIN_PROVISIONING: () => ({
        api: '/private/cli/volume',
        body: { 'space-guarantee': 'none' },
        type: VOLUME
    }),
    AUTOSIZE: () => ({
        api: '/private/cli/volume',
        body: { 'autosize-mode': 'grow' },
        type: VOLUME
    }),
    AUTOSIZE_MODE: () => ({
        api: '/private/cli/volume',
        body: { 'autosize-mode': 'grow' },
        type: VOLUME
    }),
    FRACTIONAL_RESERVE: () => ({
        api: '/private/cli/volume',
        body: { 'fractional-reserve': '0' },
        type: VOLUME
    }),
    SNAPSHOT_POLICY: () => ({
        api: '/private/cli/volume',
        body: { snapshot_policy: 'none' },
        type: VOLUME
    }),
    SNAPSHOT_COPY_RESERVE: () => ({
        api: '/private/cli/volume',
        body: { 'percent-snapshot-space': '0' },
        type: VOLUME
    }),
    SNAPSHOT_AUTO_DELETE: () => ({
        api: '/private/cli/volume/snapshot/autodelete',
        body: { enabled: 'true' },
        type: VOLUME
    }),
    TIERING_MINIMUM_COOLING_DAYS: (value?: string, tieringPolicy?: string) => ({
        api: '/private/cli/volume',
        body: { 'tiering-policy': tieringPolicy || 'snapshot-only', 'tiering-minimum-cooling-days': value || '7' },
        type: VOLUME
    }),
    TIERING_POLICY: (value?: string) => ({
        api: '/private/cli/volume',
        body: { 'tiering-policy': value || 'snapshot-only' },
        type: VOLUME
    }),

    COMPRESSION: (value?: string) => ({
        api: value === 'none' ? '/storage/volumes' : '/private/cli/volume/efficiency',
        body:
            value === 'none'
                ? { efficiency: { state: 'disabled' } }
                : { inline_compression: 'true', compression: 'true' }, // using storage/volumes causes an error while setting compression_type to 'adaptive'
        type: VOLUME
    }),
    DEDUPLICATION: (value?: string) => ({
        api: '/storage/volumes',
        body: value === 'none' ? { efficiency: { state: 'disabled' } } : { efficiency: { dedupe: 'inline' } },
        type: VOLUME
    }),
    COMPACTION: (value?: string) => ({
        api: '/storage/volumes',
        body: value === 'none' ? { efficiency: { state: 'disabled' } } : { efficiency: { compaction: 'inline' } },
        type: VOLUME
    }),
    SPACE_RESERVATION: () => ({
        api: '/private/cli/lun',
        body: { 'space-reserve': 'enabled' },
        type: LUN
    }),
    SPACE_ALLOCATION: () => ({
        api: '/private/cli/lun',
        body: { 'space-allocation': 'enabled' },
        type: LUN
    }),
    SPACE_MANAGEMENT: () => ({
        api: '/private/cli/volume',
        body: { space_mgmt_try_first: 'volume_grow' },
        type: VOLUME
    }),
    NFS_ROOTONLY: () => ({
        api: '/private/cli/vserver/nfs',
        body: { 'nfs-rootonly': 'disabled' },
        type: VSERVER
    }),
    EXPORT_POLICY: (value?: string) => ({
        api: '/storage/volumes',
        body: { nas: { export_policy: { name: value } } },
        type: VOLUME
    })
};

interface OptimizeStorageRequestParams {
    configurationName: string;
    objectsToOptimize: string[];
}

interface OptimizeStorageParams {
    accountId: string;
    credentialsId: string;
    region: string;
    databaseHostId: string;
    databaseInstanceId: string;
    optimizationTargets: OptimizeStorageRequestParams[];
}

const OptimizeStorageRequestParams = Type.Object({
    configurationName: Type.String({ enum: Object.values(OptimizeStorageConfigs) }),
    objectsToOptimize: Type.Array(Type.String({ minLength: 1 }))
});
type OptimizeStorageRequestParamsType = Static<typeof OptimizeStorageRequestParams>;

interface OptimizeStorageAttributeParams {
    accountId: string;
    region: string;
    credentialsId: string;
    fsxId: string;
    activeNodeInstanceId: string;
    parentJobId: string;
    optimizationTargets: OptimizeStorageRequestParamsType[];
    optimizationConfigs: Record<string, any>;
    apiRequestData: typeof OptimizeStorageApiData;
    svmName: string;
    serverNameWithHostName: string;
    resourceType: RESOURCESTYPE;
}

interface OptimizeStorageOperationParams {
    accountId: string;
    region: string;
    credentialsId: string;
    awsAccountId: string;
    fsxId: string;
    activeNodeInstanceId: string;
    parentJobId: string;
    serverNameWithHostName: string;
    instanceId: string;
    databaseHostId: string;
    databaseType: string;
    instanceName: string;
    sqlAuthEnabled: boolean;
    svmName: string;
    optimizationTargets: OptimizeStorageRequestParamsType[];
    instanceMetadata?: DatabaseInstanceMetadata;
    volumeTypeMap?: Map<string, string[]>;
}

const QUERY_PARAMS = {
    volume: 'volume',
    lun: 'path',
    vserver: 'vserver'
};

const STORAGE_OPTIMIZE_JOB_PARAM = {
    volume: 'volumes',
    lun: 'LUN paths',
    vserver: 'vserver'
};

const REDIS_SCHEMA = process.env.REDIS_SCHEME || 'redis';

const TEST_CONNECTION_COMMAND =
    'Test-Connection -ComputerName "www.catalog.update.microsoft.com" | Select-Object -ExpandProperty Scope | ConvertTo-Json';

// ONPREM CONTINUOUS OPTIMIZATION
const SQLSERVER_DATA_COLLECTOR_SCRIPT_PATH = `${WLMDB}/scripts/SQLServer-Data-Collector.zip`;
const ORACLE_DATA_COLLECTOR_SCRIPT_PATH = `${WLMDB}/oracle/Oracle-Data-Collector.zip`;
const REPORTING_BUCKET = process.env.S3_BUCKET_NAME ?? (config.get('reporting.bucket-name') as string);

const NETWORK_PERF = {
    UP_TO_10: 'upTo10',
    ABOVE_10: 'above10'
};

const ONPREM_TCO_CREDENTIALS_ID = 'ONPREM_TCO_CREDENTIALS_ID';

const ASSESSMENT_RESOURCE_TYPE = {
    VOLUME: 'Volume',
    FILE_SYSTEM: 'File system (FSx for ONTAP)',
    DRIVE: 'Drive',
    DATABASE: 'Database',
    INSTANCE: 'EC2 instance',
    NETWORK_ADAPTER: 'Network Adapter',
    LUN: 'Lun',
    SQL_INSTANCE: 'SQL instance',
    NETWORK_INTERFACE: 'Network Interface',
    DISK_GROUP: 'Disk Group',
    STORAGE_MULTIPATH: 'Storage multipath'
};

const VALID_MPIO_LB_POLICIES = ['RR', 'RRWS'];

const HIGH_AVAILABILITY = [
    'shared-storage',
    'heartbeat-settings',
    'cluster-quorum',
    'sqlServer-service',
    'drive-letter'
];

const MSSQL_STORAGE_ASSESSMENT_CONFIGS_MAP = {
    sizing: ['performance-tier', 'tempdb-drive-size', 'log-drive-size', 'headroom'],
    layout: ['tempdb-files-location', 'data-files-location', 'log-files-location']
};

const ORACLE_STORAGE_ASSESSMENT_CONFIGS_MAP = {
    sizing: ['headroom', 'swap-space'],
    layout: [
        'archive-placement',
        'datafiles-placement',
        'controlfiles-placement',
        'redologs-placement',
        'templogs-placement',
        'oracle-binary-placement',
        'data-dg-lun-layout',
        'redolog-dg-lun-layout',
        'fra-dg-lun-layout',
        'archivelog-dg-lun-layout'
    ]
};

const MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP = {
    volumes: [
        'thin-provision',
        'autosize',
        'autosize-mode',
        'fractional-reserve',
        'snapshot-copy-reserve',
        'snapshot-autodelete',
        'space-mgmt-try-first',
        'tiering-policy',
        'tiering-min-cooling-days'
    ],
    luns: ['os-type', 'space-reservation-enabled', 'space-allocation-allocated'],
    os: ['mpio-enabled', 'mpio-iscsi-count', 'mpio-load-balance-policy', 'ntfs-allocation-unit-size', 'mpio-timeout']
};

const ORACLE_ISCSI_SPECIFIC_LAYOUT_CONFIGS = [
    'data-dg-lun-layout',
    'redolog-dg-lun-layout',
    'fra-dg-lun-layout',
    'archivelog-dg-lun-layout'
];

const ORACLE_ASM_STORAGE_CONFIGURATION_ASSESSMENT_MAP = {
    os: ['asm-setup', 'asm-external-redundancy', 'afd-logical-block-size', 'asmlib-logical-block-size'] // only ASM related OS configs for ISCSI
};

const ORACLE_STORAGE_LAYOUT_CONFIGS_MAP = {
    layout: [
        'archive-placement',
        'datafiles-placement',
        'controlfiles-placement',
        'redologs-placement',
        'templogs-placement',
        'oracle-binary-placement', // till here common for ISCSI and NFS
        'data-dg-lun-layout',
        'redolog-dg-lun-layout',
        'fra-dg-lun-layout',
        'archivelog-dg-lun-layout' // these are for iscsi and ASM only
    ]
};

const ORACLE_NFS_STORAGE_CONFIGURATION_ASSESSMENT_MAP = {
    volumes: ['nfs-rootonly', 'export-policy'],
    os: [
        'kernel-parameters',
        'nfs-mount-options-databasefiles',
        'nfs-mount-options-adrhome',
        'nfsv4-domain-name',
        'nfs-caching-options',
        'dnfs-enabled',
        'dnfs-consistent-ip-resolution',
        'dnfs-configuration-file',
        'dnfs-no-shared-cache'
    ]
};

const ORACLE_ISCSI_STORAGE_CONFIGURATION_ASSESSMENT_MAP = {
    os: [
        'multipath-io',
        'host-utilities',
        'multipath-io-sessions',
        'transparent-hugepages',
        'iscsi-replacement-timeout',
        'multipath-friendly-names',
        'tcp-advanced-options',
        'filesystems-io-options',
        'multiblock-readcount',
        'multipath-configuration'
    ]
};

const ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP = {
    volumes: [
        'thin-provision',
        'autosize',
        'autosize-mode',
        'fractional-reserve',
        'snapshot-policy',
        'snapshot-copy-reserve',
        'snapshot-autodelete',
        'space-mgmt-try-first',
        'tiering-policy',
        'tiering-min-cooling-days',
        'compression',
        'deduplication',
        'compaction',
        ...ORACLE_NFS_STORAGE_CONFIGURATION_ASSESSMENT_MAP.volumes
    ],
    luns: ['os-type', 'space-reservation-enabled', 'space-allocation-allocated'],
    os: [
        ...ORACLE_ISCSI_STORAGE_CONFIGURATION_ASSESSMENT_MAP.os,
        ...ORACLE_NFS_STORAGE_CONFIGURATION_ASSESSMENT_MAP.os,
        ...ORACLE_ASM_STORAGE_CONFIGURATION_ASSESSMENT_MAP.os
    ]
};

const ASSESSMENT_CONFIGS = {
    compute: 'compute-rightsizing',
    license: 'sql-license',
    hostOsPatch: 'host-os-patch',
    maxDOP: 'maxdop',
    mssqlPatch: 'mssql-patch',
    rssConfig: 'rss-config',
    snapshotPolicy: 'snapshot-policy',
    crr: 'crr',
    awsBackup: 'backup-configuration',
    clone: 'clone-management',
    mtuAlignment: 'mtu-alignment',
    snapcenterSnapshot: 'snapcenter-snapshot',
    highAvailability: {
        heartbeatSettings: 'heartbeat-settings',
        clusterQuorum: 'cluster-quorum',
        sharedStorage: 'shared-storage',
        sqlserverService: 'sqlServer-service',
        driveLetter: 'drive-letter'
    }
};

const DISMISS_STATUS = {
    DISMISSED: 'DISMISSED',
    POSTPONED: 'POSTPONED',
    ACTIVE: 'ACTIVE',
    ACTIVATING: 'ACTIVATING'
};

const DISMISS_DEACTIVATION_REASON = {
    USER: 'USER',
    EXPIRED: 'EXPIRED'
};

const DISMISS_UPDATE_STATUS = {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    PARTIAL: 'PARTIAL'
};

const INSTANCE_LEVEL_CONFIGURATIONS = [
    // Common instance-level configurations
    'storage',
    'maxdop',
    'mssql-patch',
    'mapped-ontap-volumes',
    'clone',
    'crr',
    'shared-storage',
    'sqlServer-service',
    'drive-letter',
    // Expand MSSQL storage configuration assessment map
    ...MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP.volumes,
    ...MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP.luns,
    ...MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP.os,
    // Expand MSSQL storage assessment configs map
    ...MSSQL_STORAGE_ASSESSMENT_CONFIGS_MAP.sizing,
    ...MSSQL_STORAGE_ASSESSMENT_CONFIGS_MAP.layout,
    // Expand Oracle storage configuration assessment map
    ...ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP.volumes,
    ...ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP.luns,
    ...ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP.os,
    // Expand Oracle storage assessment configs map
    ...ORACLE_STORAGE_ASSESSMENT_CONFIGS_MAP.sizing,
    'clone-management',
    'snapcenter-snapshot',
    // Oracle layout configurations
    'archive-placement',
    'datafiles-placement',
    'controlfiles-placement',
    'redologs-placement',
    'templogs-placement',
    'oracle-binary-placement',
    'data-dg-lun-layout',
    'redolog-dg-lun-layout',
    'fra-dg-lun-layout',
    'archivelog-dg-lun-layout',
    // Oracle-ISCSI-specific configurations
    ...ORACLE_ASM_STORAGE_CONFIGURATION_ASSESSMENT_MAP.os
];

const HOST_LEVEL_CONFIGURATIONS = [
    'sql-license',
    'host-os-patch',
    'rss-config',
    'compute-rightsizing',
    'backup-configuration',
    'mtu-alignment',
    'heartbeat-settings',
    'cluster-quorum'
];

const DEFAULT_MPIO_TIMEOUT = 60; // seconds

const DEFAULT_FSX_MTU_VALUE = 9001;

const MIN_OPTIMIZED_HEADROOM_PERCENTAGE = {
    ORACLE: 20,
    MSSQL: 35
};

export {
    AssessmentCategories,
    AssessmentTriggeredBy,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    REDIS_URL,
    OptimizeStorageConfigs,
    OptimizeStorageConfigsJobNames,
    OPTIMIZE_SIZING_CONFIGS,
    SEVERITY,
    OptimizeStorageParams,
    DRIFT_ASSESSMENT_QUEUE,
    VOLUME,
    LUN,
    QUERY_PARAMS,
    REDIS_SCHEMA,
    OptimizeOperatingSystemParams,
    TEST_CONNECTION_COMMAND,
    SQLSERVER_DATA_COLLECTOR_SCRIPT_PATH,
    ORACLE_DATA_COLLECTOR_SCRIPT_PATH,
    REPORTING_BUCKET,
    STORAGE_OPTIMIZE_JOB_PARAM,
    NUMASTATIC,
    OptimizeStorageTierParams,
    OptimizeComputeParams,
    NETWORK_PERF,
    ONPREM_TCO_CREDENTIALS_ID,
    OPTIMIZATION_CATEGORIES,
    OptimizeMaxDopParams,
    ASSESSMENT_RESOURCE_TYPE,
    OPTIMIZE_RESILIENCY_CONFIGS,
    VALID_MPIO_LB_POLICIES,
    OptimizeComputeJobNames,
    OptimizeCloneParams,
    ASSESSMENT_CONFIGS,
    MSSQL_STORAGE_ASSESSMENT_CONFIGS_MAP,
    ORACLE_STORAGE_ASSESSMENT_CONFIGS_MAP,
    DISMISS_DEACTIVATION_REASON,
    DISMISS_STATUS,
    DISMISS_UPDATE_STATUS,
    INSTANCE_LEVEL_CONFIGURATIONS,
    HOST_LEVEL_CONFIGURATIONS,
    MSSQL_STORAGE_CONFIGURATION_ASSESSMENT_MAP,
    ORACLE_STORAGE_CONFIGURATION_ASSESSMENT_MAP,
    HIGH_AVAILABILITY,
    DISMISS_STATUS_ENUM,
    DEFAULT_MPIO_TIMEOUT,
    OptimizeHighAvailabilityParams,
    AssessmentCategoriesOracle,
    DEFAULT_FSX_MTU_VALUE,
    OptimizeStorageApiData,
    ORACLE_STORAGE_LAYOUT_CONFIGS_MAP,
    ORACLE_ISCSI_SPECIFIC_LAYOUT_CONFIGS,
    OptimizeStorageAttributeParams,
    OptimizeStorageOperationParams,
    OptimizeStorageRequestParamsType,
    OptimizeStorageRequestParams,
    OptimizeOracleTypes,
    OptimizeOracleiSCSIStorageOperatingSystem,
    OracleOptimizeJobDescriptions,
    ORACLE_NFS_STORAGE_CONFIGURATION_ASSESSMENT_MAP,
    OptimizeOracleNFSStorageOperatingSystem,
    ORACLE_ASM_STORAGE_CONFIGURATION_ASSESSMENT_MAP,
    MIN_OPTIMIZED_HEADROOM_PERCENTAGE,
    OptimizeOracleStorageSizing
};
