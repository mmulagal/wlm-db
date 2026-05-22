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
        serverInstallationMode?: string;
    };
    protection: {
        isAwsBackupEnabled: {
            fsxn: boolean;
            fsxw: boolean;
            ebs: boolean;
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
        fsxn?: {
            size?: number;
            used?: number;
            spaceSavings?: number;
            spaceSavingsPercent?: number;
            protocol?: Array<string>;
        };
        fsxw?: {
            size?: number;
            used?: number;
            spaceSavings?: number;
            spaceSavingsPercent?: number;
        };
        ebs?: {
            size?: number;
            used?: number;
            spaceSavings?: number;
            spaceSavingsPercent?: number;
        };
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
    warning?: number;
    totalJobs?: number;
    completedPercent?: number;
    failedPercent?: number;
    inProgressPercent?: number;
    warningPercent?: number;
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
    totalInstances: number;
    managedDatabases: number;
    managedInstances: number;
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
    dismissPageLanding: string;
    enableFilter: boolean;
    selectedRowsForOptimize: Array<string> | any;
    selectedRowsForDismiss: Array<string> | any;
    selectedRowsForOptimizeInnerPage: Array<string> | any;
    selectedTab: string;
    aggregatedHostsCount: AggregatedHostsCountRes | null;
    aggregatedPgSqlHostsCount: AggregatedHostsCountRes | null;
    aggregatedOracleHostsCount: AggregatedHostsCountRes | null;
    aggregatedProtectionDbCount: AggregatedProtectionDbCountRes | null;
    aggregatedStorageSavings: AggregatedStorageSavingsRes | null;
    aggregatedPgsqlStorageSavings: AggregatedStorageSavingsRes | null;
    aggregatedCosts: AggregatedCostsRes | null;
    selectedConfig: string;
    selectedConfigSummary: {
        optimizationScore: string;
        dismissedInstances: number;
        optimizedInstances: number;
        notOptimizedInstances: number;
        severity: string;
        configState: string;
        totalInstances: number;
        tooltipText: string;
    };
    selectedAssessmentRow: any;
    sandboxAgeRange: {
        from: string;
        range: string;
    };
    potentialSavingsValues: {
        loading: boolean;
        totalEbsCost: number;
        fsxwCost: number;
        fsxnCost: number;
        totalFsxnCostForEbsHost: number;
        fsxnCostForFsxwHost: number;
        savings: number;
        savingsPercent: number;
        noSavings: boolean;
        oracleEbsCost: number;
        oracleFsxnCostForEbsHost: number;
        mssqlEbsCost: number;
        mssqlFsxnCostForEbsHost: number;
    };
}

export interface TemplateRes {
    cliCommand: string;
    template: string;
    url: string;
}
