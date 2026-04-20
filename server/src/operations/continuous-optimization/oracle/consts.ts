import { OptimizeStorageConfigs } from '../../../utils/continous-optimization-consts';

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
    ORACLE_COMPUTE_DRIFT_RESPONSE_KEYS
};
