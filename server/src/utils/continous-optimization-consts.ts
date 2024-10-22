import config from 'config';

enum AssessmentCategories {
    STORAGE = 'storage',
    COMPUTE = 'compute'
}

enum AssessmentTriggeredBy {
    SYSTEM = 'system',
    USER = 'user'
}

enum AssessmentStatus {
    OPTIMIZED = 'optimized',
    NOT_OPTIMIZED = 'not-optimized',
    UNDER_PROVISIONED = 'under-provisioned',
    OVER_PROVISIONED = 'over-provisioned'
}

enum AwsWellArchitecturedPillars {
    PERFORMANCE_EFFICIENCY = 'Performance efficiency',
    RELIABILITY = 'Reliability',
    COST_OPTIMIZATION = 'Cost optimization',
    OPERATIONAL_EXCELLENCE = 'Operational excellence',
    SECURITY = 'Security'
}

// Redis
const REDIS_URL = process.env.REDIS_ENDPOINT || config.get('redis.endpoint') || '127.0.0.1:6379';

enum OptimizeStorageVolumeConfigs {
    THIN_PROVISIONING = 'thin-provision',
    AUTOSIZE = 'autosize',
    AUTOSIZE_MODE = 'autosize-mode',
    FRACTIONAL_RESERVE = 'fractional-reserve',
    SNAPSHOT_COPY_RESERVE = 'snapshot-copy-reserve',
    SNAPSHOT_AUTO_DELETE = 'snapshot-autodelete',
    SPACE_MANAGEMENT = 'space-mgmt-try-first',
    TIERING_MINIMUM_COOLING_DAYS = 'tiering-min-cooling-days',
    TIERING_POLICY = 'tiering-policy'
}

enum OptimizeStorageLunConfigs {
    SPACE_RESERVATION = 'space-reservation-enabled',
    SPACE_ALLOCATION = 'space-allocation-allocated'
}

const DRIFT_ASSESSMENT_QUEUE = 'driftAssessmentQueue';

const OptimizeStorageVolumeApiData = {
    THIN_PROVISIONING: {
        api: '/private/cli/volume',
        body: { 'space-guarantee': 'none' }
    },
    AUTOSIZE: {
        api: '/private/cli/volume',
        body: { 'autosize-mode': 'grow' }
    },
    AUTOSIZE_MODE: {
        api: '/private/cli/volume',
        body: { 'autosize-mode': 'grow' }
    },
    FRACTIONAL_RESERVE: {
        api: '/private/cli/volume',
        body: { 'fractional-reserve': '0' }
    },
    SNAPSHOT_COPY_RESERVE: {
        api: '/private/cli/volume',
        body: { 'percent-snapshot-space': '0' }
    },
    SNAPSHOT_AUTO_DELETE: {
        api: '/private/cli/volume/snapshot/autodelete',
        body: { 'snapshot-auto-delete': 'true' }
    },
    TIERING_MINIMUM_COOLING_DAYS: {
        api: '/private/cli/volume',
        body: { 'tiering-minimum-cooling-days': '7' }
    },
    TIERING_POLICY: {
        api: '/private/cli/volume',
        body: { 'tiering-policy': 'snapshot-only' }
    }
};

const OptimizeStorageLunApiData = {
    SPACE_RESERVATION: {
        api: '/private/cli/lun',
        body: { 'space-reserve': 'enabled' }
    },
    SPACE_ALLOCATION: {
        api: '/private/cli/volume',
        body: { 'space-allocation': 'enabled' }
    }
};

interface OptimizeStorageRequestParams {
    configurationName: string;
    objectsToOptimize: string[];
}

interface OptimizeInstanceParams {
    accountId: string;
    credentialsId: string;
    region: string;
    databaseHostId: string;
    databaseInstanceId: string;
    volumeoptimizationTargets?: OptimizeStorageRequestParams[];
    lunoptimizationTargets?: OptimizeStorageRequestParams[];
}

export {
    AssessmentCategories,
    AssessmentTriggeredBy,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    REDIS_URL,
    OptimizeStorageVolumeConfigs,
    OptimizeStorageLunConfigs,
    OptimizeStorageVolumeApiData,
    OptimizeStorageLunApiData,
    OptimizeInstanceParams,
    DRIFT_ASSESSMENT_QUEUE
};
