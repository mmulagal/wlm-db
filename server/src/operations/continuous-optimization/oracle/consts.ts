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

export {
    NETAPP_HOST_UTILITIES_RELATIVE_PATH,
    OracleJobMetadata,
    TcpOptimizationResponse,
    TcpFeatures,
    KernelTcpSlotOptimiseResponse
};
