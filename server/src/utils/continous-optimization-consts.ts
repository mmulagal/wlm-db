import config from 'config';
import { WLMDB } from './consts';

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
    HIGH_AVAILABILITY = 'high-availability'
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

const NUMASTATIC = 'NUMAStatic';

// Redis
const REDIS_URL = process.env.REDIS_ENDPOINT || config.get('redis.endpoint') || '127.0.0.1:6379';

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
    MOST_RECENT_SNAPSHOT_TIMESTAMP = 'most-recent-snapshot-timestamp'
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
    SPACE_ALLOCATION = 'space allocation'
}

enum OptimizeOperatingSystemParams {
    MPIO_POLICY = 'mpio-load-balance-policy',
    MPIO_SESSIONS = 'mpio-iscsi-count',
    MPIO_ENABLE = 'mpio-enabled',
    MPIO_TIMEOUT = 'mpio-timeout'
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
    AWS_BACKUP = 'aws-backup'
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
    CLONE = 'clone'
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
    THIN_PROVISIONING: {
        api: '/private/cli/volume',
        body: { 'space-guarantee': 'none' },
        type: VOLUME
    },
    AUTOSIZE: {
        api: '/private/cli/volume',
        body: { 'autosize-mode': 'grow' },
        type: VOLUME
    },
    AUTOSIZE_MODE: {
        api: '/private/cli/volume',
        body: { 'autosize-mode': 'grow' },
        type: VOLUME
    },
    FRACTIONAL_RESERVE: {
        api: '/private/cli/volume',
        body: { 'fractional-reserve': '0' },
        type: VOLUME
    },
    SNAPSHOT_COPY_RESERVE: {
        api: '/private/cli/volume',
        body: { 'percent-snapshot-space': '0' },
        type: VOLUME
    },
    SNAPSHOT_AUTO_DELETE: {
        api: '/private/cli/volume/snapshot/autodelete',
        body: { enabled: 'true' },
        type: VOLUME
    },
    TIERING_MINIMUM_COOLING_DAYS: {
        api: '/private/cli/volume',
        body: { 'tiering-policy': 'snapshot-only', 'tiering-minimum-cooling-days': '7' },
        type: VOLUME
    },
    TIERING_POLICY: {
        api: '/private/cli/volume',
        body: { 'tiering-policy': 'snapshot-only' },
        type: VOLUME
    },
    SPACE_RESERVATION: {
        api: '/private/cli/lun',
        body: { 'space-reserve': 'enabled' },
        type: LUN
    },
    SPACE_ALLOCATION: {
        api: '/private/cli/lun',
        body: { 'space-allocation': 'enabled' },
        type: LUN
    }
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

const QUERY_PARAMS = {
    volume: 'volume',
    lun: 'path'
};

const STORAGE_OPTIMIZE_JOB_PARAM = {
    volume: 'volumes',
    lun: 'LUN paths'
};

const REDIS_SCHEMA = process.env.REDIS_SCHEME || 'redis';

const TEST_CONNECTION_COMMAND =
    'Test-Connection -ComputerName "www.catalog.update.microsoft.com" | Select-Object -ExpandProperty Scope | ConvertTo-Json';

// ONPREM CONTINUOUS OPTIMIZATION
const SQLSERVER_DATA_COLLECTOR_SCRIPT_PATH = `${WLMDB}/scripts/SQLServer-Data-Collector.zip`;
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
    SQL_INSTANCE: 'SQL instance'
};

const VALID_MPIO_LB_POLICIES = ['RR', 'RRWS'];

const STORAGE_ASSESMENT_CONFIGS_MAP = {
    sizing: ['performance-tier', 'tempdb-drive-size', 'log-drive-size', 'headroom'],
    layout: ['tempdb-files-location', 'data-files-location', 'log-files-location']
};

const STORAGE_CONFIGURATION_ASSESMENT_MAP = {
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

const ASSESSMENT_CONFIGS = {
    compute: 'compute-rightsizing',
    license: 'sql-license',
    hostOsPatch: 'host-os-patch',
    maxDOP: 'maxdop',
    mssqlPatch: 'mssql-patch',
    rssConfig: 'rss-config',
    snapshotPolicy: 'snapshot-policy',
    crr: 'crr',
    awsBackup: 'scheduled-fsx-for-ontap-backups',
    clone: 'clone-management'
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
    'storage',
    'maxdop',
    'mssql-patch',
    'mapped-ontap-volumes',
    'clone',
    'snapshot-policy',
    'crr'
];

const HOST_LEVEL_CONFIGURATIONS = [
    'license',
    'host-os-patch',
    'rss-config',
    'compute-rightsizing',
    'scheduled-fsx-for-ontap-backups'
];

const DEFAULT_MPIO_TIMEOUT = 60; // seconds

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
    OptimizeStorageApiData,
    OptimizeStorageParams,
    DRIFT_ASSESSMENT_QUEUE,
    VOLUME,
    LUN,
    QUERY_PARAMS,
    REDIS_SCHEMA,
    OptimizeOperatingSystemParams,
    TEST_CONNECTION_COMMAND,
    SQLSERVER_DATA_COLLECTOR_SCRIPT_PATH,
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
    STORAGE_ASSESMENT_CONFIGS_MAP,
    DISMISS_DEACTIVATION_REASON,
    DISMISS_STATUS,
    DISMISS_UPDATE_STATUS,
    INSTANCE_LEVEL_CONFIGURATIONS,
    HOST_LEVEL_CONFIGURATIONS,
    STORAGE_CONFIGURATION_ASSESMENT_MAP,
    DISMISS_STATUS_ENUM,
    DEFAULT_MPIO_TIMEOUT
};
