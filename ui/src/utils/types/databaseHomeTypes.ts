export interface DatabaseHostItem {
    id: string;
    type?: string;
    name: string;
    databaseHostname?: string;
    status: string;
    databaseCount?: number;
    topology: {
        region: string;
        serverType: string;
        serverMode: string;
        fileSystemType: string;
        fileSystemId: string;
        vpcId?: string;
        ec2Details: Array<Ec2Details>;
    };
    protection: {
        isAwsBackUpEnabled: {
            fsxn: boolean,
            fsxw: boolean,
            ebs: false 
        };
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
    };
    storageSavingsText?: string;
    estimatedUsageCost: {
        compute: number;
        storage: {
            fsxn?: number;
            fsxw?: number;
            ebs?: number;
        };
        connectivity: number;
        others: number;
        estimationType: string;
    };
    totalCost?: string;
}

export interface Ec2Details {
    id?: string;
    name?: string;
    ebsVolumeId?: string;
}

export interface DatabaseJobsItem {
    id: string;
    type?: string;
    name: string;
    databaseHostname?: string;
    status: string;
    databaseCount?: number;
    metadata: {
        region: string;
        serverType: string;
        serverMode: string;
        fileSystemType: string;
        vpcId?: string;
    };
    topology?: {
        region: string;
        serverType: string;
        serverMode: string;
        fileSystemType: string;
        vpcId?: string;
    };
}

export interface JobsSummaryRes {
    completed?: number;
    failed?: number;
    inProgress?: number;
    totalJobs?: number;
    completedPercent?: number;
    failedPercent?: number;
    inProgressPercent?: number;
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
    requireBillingPerm: boolean;
}

export interface DatabaseHostsEntities {
    selectedTab: string;
    getDatabaseHosts: {
        databaseHostsData: DatabaseHostItem[] | null;
        databaseHostsLoading: false;
        databaseHostsError: null;
    };
    getJobsSummary: {
        jobsSummaryData: JobsSummaryRes | null;
        jobsSummaryLoading: false;
        jobsSummaryError: null;
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
