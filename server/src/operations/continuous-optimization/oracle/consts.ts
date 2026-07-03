import { OptimizeStorageConfigs } from '../../../utils/continous-optimization-consts';
import { ConfigDetailType } from '../../../routes/types/continuous-optimization.types';
import { OracleSysFileTypes } from '../../workloads/oracle/common-types';

const NETAPP_HOST_UTILITIES_RELATIVE_PATH = `${process.cwd()}/resources/oracle/packages/NetApp_Linux_Host_Utilities_8.0.rpm`;

interface PerHostJobMetadata {
    optimizationType: string;
    resourceId: string;
    databases: Array<string>;
}

interface OracleJobMetadata {
    hostsToOptimize: Array<PerHostJobMetadata>;
}

interface TcpOptionResult {
    enabled: boolean;
    persisted?: boolean;
    error: string | null;
    'already-optimized'?: boolean;
}

interface TcpFeatures {
    'tcp-timestamps': TcpOptionResult;
    'tcp-sack': TcpOptionResult;
    'tcp-window-scaling': TcpOptionResult;
}

interface TcpOptimizationResponse {
    'tcp-features': TcpFeatures;
    'already-optimized': boolean;
    error?: string;
}

interface GenericOptimizationResponse {
    status: 'optimized' | 'failed' | 'optimized-offline' | 'restart-required';
    error?: string;
}

interface InstallHostUtilitiesResponse extends GenericOptimizationResponse {
    'os-version': string;
}

interface KernelTcpSlotOptimiseResponse {
    status: 'optimized' | 'failed' | 'partial' | 'optimized-offline';
    'sunrpc-options': {
        [key: string]: {
            expected: string;
            actual: string;
        };
    };
    error?: string;
}

const LINUX_LOG_DIRECTORY = '/var/log/netapp/wlmdb';

const oracleSpecialStorageConfigNames = [
    OptimizeStorageConfigs.TIERING_POLICY,
    OptimizeStorageConfigs.TIERING_MINIMUM_COOLING_DAYS,
    OptimizeStorageConfigs.COMPRESSION,
    OptimizeStorageConfigs.DEDUPLICATION,
    OptimizeStorageConfigs.COMPACTION,
    OptimizeStorageConfigs.NFS_ROOTONLY,
    OptimizeStorageConfigs.EXPORT_POLICY
];

const ORACLE_COMPUTE_DRIFT_RESPONSE_KEYS = [
    'transparentHugepages',
    'tcpAdvancedOptions',
    'filesystemsIoOptions',
    'multiblockReadcount'
] as const;

// User-facing labels for Oracle system file types, used in volume layout drift messages.
// FRA is intentionally folded into "archive logs" since it is treated as part of the archive
// placement assessment (archiveFraLogVolumes merges archive and FRA volumes).
const ORACLE_FILE_TYPE_LABELS: Record<OracleSysFileTypes, string> = {
    [OracleSysFileTypes.CONTROL_FILES]: 'control files',
    [OracleSysFileTypes.DATA_FILES]: 'data files',
    [OracleSysFileTypes.REDO_LOGS]: 'redo logs',
    [OracleSysFileTypes.ARCHIVE_LOGS]: 'archive logs',
    [OracleSysFileTypes.TEMP_FILES]: 'temp files',
    [OracleSysFileTypes.FRA]: 'archive logs'
};

// Display order used when listing file-type labels so messages are deterministic.
const ORACLE_FILE_TYPE_LABEL_ORDER: OracleSysFileTypes[] = [
    OracleSysFileTypes.CONTROL_FILES,
    OracleSysFileTypes.DATA_FILES,
    OracleSysFileTypes.REDO_LOGS,
    OracleSysFileTypes.ARCHIVE_LOGS,
    OracleSysFileTypes.FRA,
    OracleSysFileTypes.TEMP_FILES
];

/** Per-volume-type targets for combined storage-efficiency and tiering drift evaluation. */
const TIERING_POLICY_RECOMMENDATIONS = {
    'data-control-files': 'none',
    'log-files': 'none',
    'archive-log-files': 'auto'
} as const;

const COMPRESSION_RECOMMENDATIONS = {
    'log-files': 'none',
    others: 'adaptive'
} as const;

const DEDUPLICATION_RECOMMENDATIONS: { 'log-files': string[]; others: string[] } = {
    'log-files': ['none'],
    others: ['inline', 'both']
};

const COMPACTION_RECOMMENDATIONS = {
    'log-files': 'none',
    others: 'enabled'
} as const;

/**
 * Maps combined sub-parameter display names to volume-record property keys for evaluateOne.
 * Needed because golden-config components use UI names (`compression`) while assessment logic
 * reads ONTAP fields (`compressionType`). Source: components[].parameter in golden-config.ts.
 */
const COMBINED_SUB_PARAMETER_TO_PROPERTY: Record<string, string> = {
    compression: 'compressionType',
    deduplication: 'deduplication',
    compaction: 'compaction',
    'tiering-policy': 'tieringPolicy',
    'tiering-min-cooling-days': 'tieringMinCoolingDays'
};

// Per-sub-parameter recommended overrides for combined drift rows (storage-efficiencies,
// tiering-tco-optimization). Populates configDetails.recommendedByDataCategory on assessment output.
type CombinedConfigDetailOverrides = Pick<
    ConfigDetailType,
    'recommended' | 'recommendedByDataCategory' | 'recommendedNote'
>;

// Lookup table keyed by sub-parameter name for a given combined golden-config id.
type CombinedVolumeConfigDetails = Record<string, CombinedConfigDetailOverrides>;

// Per-sub-parameter compression/dedup/compaction targets for the storage-efficiencies combined entry.
const STORAGE_EFFICIENCIES_CONFIG_DETAILS: CombinedVolumeConfigDetails = {
    compression: {
        recommended: '',
        recommendedByDataCategory: {
            'log-files': COMPRESSION_RECOMMENDATIONS['log-files'],
            'non-log-files': COMPRESSION_RECOMMENDATIONS.others,
            mixed: COMPRESSION_RECOMMENDATIONS['log-files']
        }
    },
    deduplication: {
        recommended: '',
        recommendedByDataCategory: {
            'log-files': DEDUPLICATION_RECOMMENDATIONS['log-files'][0],
            'non-log-files': DEDUPLICATION_RECOMMENDATIONS.others[0],
            mixed: DEDUPLICATION_RECOMMENDATIONS['log-files'][0]
        },
        recommendedNote: '`both` is also acceptable for non-log-files volumes'
    },
    compaction: {
        recommended: '',
        recommendedByDataCategory: {
            'log-files': COMPACTION_RECOMMENDATIONS['log-files'],
            'non-log-files': COMPACTION_RECOMMENDATIONS.others,
            mixed: COMPACTION_RECOMMENDATIONS['log-files']
        }
    }
};

// Per-sub-parameter tiering targets for the tiering-tco-optimization combined drift entry.
const TIERING_TCO_OPTIMIZATION_CONFIG_DETAILS: CombinedVolumeConfigDetails = {
    'tiering-policy': {
        recommended: '',
        recommendedByDataCategory: {
            'data-control-files': TIERING_POLICY_RECOMMENDATIONS['data-control-files'],
            'log-files': TIERING_POLICY_RECOMMENDATIONS['log-files'],
            'archive-log-files': TIERING_POLICY_RECOMMENDATIONS['archive-log-files'],
            mixed: TIERING_POLICY_RECOMMENDATIONS['log-files']
        }
    },
    'tiering-min-cooling-days': {
        recommended: '',
        recommendedByDataCategory: {
            'archive-log-files': '2'
        },
        recommendedNote: '14 when FRA is enabled and RMAN compression is disabled; not assessed on non-archive volumes'
    }
};

// Golden-config ids handled in the appended combined block of getVolumeConfigDrift (skipped by the legacy map loop).
const COMBINED_VOLUME_CONFIG_IDS = ['storage-efficiencies', 'tiering-tco-optimization'] as const;

const getArchiveLogTieringMinCoolingDaysRecommendation = (
    isArchiveLogVolume: boolean,
    fraEnabled?: string,
    rmanCompressionEnabled?: string
) => (isArchiveLogVolume && fraEnabled === 'yes' && rmanCompressionEnabled === 'no' ? '14' : '2');

export {
    NETAPP_HOST_UTILITIES_RELATIVE_PATH,
    OracleJobMetadata,
    TcpOptimizationResponse,
    TcpFeatures,
    InstallHostUtilitiesResponse,
    KernelTcpSlotOptimiseResponse,
    GenericOptimizationResponse,
    LINUX_LOG_DIRECTORY,
    oracleSpecialStorageConfigNames,
    ORACLE_COMPUTE_DRIFT_RESPONSE_KEYS,
    ORACLE_FILE_TYPE_LABELS,
    ORACLE_FILE_TYPE_LABEL_ORDER,
    TIERING_POLICY_RECOMMENDATIONS,
    COMPRESSION_RECOMMENDATIONS,
    DEDUPLICATION_RECOMMENDATIONS,
    COMPACTION_RECOMMENDATIONS,
    STORAGE_EFFICIENCIES_CONFIG_DETAILS,
    TIERING_TCO_OPTIMIZATION_CONFIG_DETAILS,
    COMBINED_VOLUME_CONFIG_IDS,
    COMBINED_SUB_PARAMETER_TO_PROPERTY,
    getArchiveLogTieringMinCoolingDaysRecommendation
};
