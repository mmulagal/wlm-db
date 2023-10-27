
export interface DatabaseHostItem {
    id: string;
    name: string;
    databaseHostname?: string;
    status: string;
    topology: {
        region: string;
        serverType: string;
        serverMode: string;
        fileSystemType: string;
        fsxFilesystemId: string;
        ec2Details: Array<object>
    };
    protection: {
        isAwsBackUpEnabled: boolean;
        isFsxOntapSnapshotsEnabled: boolean;
        isSqlNativeEnabled: boolean;
    };
    performance: {
        latency: number;
        assessment: string;
    };
    performanceText?: string;
    protectionText?: string;
    storage: {
        size: number;
        used: number;
        spaceSavings: number;
        spaceSavingsPercent: number;
    };
    storageSavingsText?: string;
    estimatedUsageCost: {
        compute: number;
        storage: number;
        connectivity: number;
        others: number;
    };
    totalCost?: string;
}

export interface DatabaseJobsItem {
    id: string;
    name: string;
    databaseHostname?: string;
    status: string;
    metadata: {
        region: string;
        serverType: string;
        serverMode: string;
        fileSystemType: string;
    };
    topology?: {
        region: string;
        serverType: string;
        serverMode: string;
        fileSystemType: string;
    };
}

export interface JobsSummaryRes {
    success: number;
    failed: number;
    initializing: number;
    totalJobs?: number;
    successPercent?: number;
    failedPercent?: number;
    initializingPercent?: number;
}

export interface StatusRes {
    isActive: boolean;
}

export interface AggregatedHostsCountRes {
    totalDatabases: number;
    totalHosts: number;
    totalUpHosts: number;
    totalInitializingHosts: number;
    totalDownHosts: number;
    totalFailedHosts: number;
}

export interface AggregatedProtectionDbCountRes {
    protectedDb: number;
    unprotectedDb: number;
    protectedPercent: number;
    unprotectedPercent: number;
    awsBackupDb: number;
    fsxOntapSnapshotsDb: number;
    sqlServerBackupDb: number;
}

export interface AggregatedStorageSavingsRes {
    storageConsumes: string;
    storageSavings: string;
    storageSavingsPercent: number;
}

export interface AggregatedCostsRes {
    storageCost: number;
    computeCost: number;
    connectivityCost: number;
    otherCost: number;
    totalCost: number;
    storageCostPercent: number;
    computeCostPercent: number;
    connectivityCostPercent: number;
    otherCostPercent: number;
}

export interface DatabaseHostsEntities {
    getDatabaseHosts: {
        databaseHostsData: DatabaseHostItem[] | null;
        databaseHostsLoading: false;
        databaseHostsError: null;
    };
    getDatabaseJobs: {
        databaseJobsData: DatabaseJobsItem[] | null;
        databaseJobsLoading: false;
        databaseJobsError: null;
    };
    getJobsSummary: {
        jobsSummaryData: JobsSummaryRes | null;
        jobsSummaryLoading: false;
        jobsSummaryError: null;
    };
    getStatus: {
        statusData: StatusRes | null;
        statusLoading: false;
        statusError: null;
    };
    databaseHostsList: null;
    aggregatedHostsCount: AggregatedHostsCountRes | null;
    aggregatedProtectionDbCount: AggregatedProtectionDbCountRes | null;
    aggregatedStorageSavings: AggregatedStorageSavingsRes | null;
    aggregatedCosts: AggregatedCostsRes | null;
}

export interface TemplateRes {
    cliCommand: string;
    template: string;
    url: string;
}
