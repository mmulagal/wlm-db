
export interface DatabaseHostItem {
    id: string;
    name: string;
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
    storage: {
        allocated: number;
        used: number;
        savings: number;
    };
    estimatedUsageCost: {
        compute: number;
        storage: number;
        connectivity: number;
        others: number;
    }
}

export interface DatabaseJobsItem {
    id: string;
    name: string;
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
    success: string;
    failed: string;
    initializing: string;
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
    },
    getJobsSummary: {
        jobsSummaryData: JobsSummaryRes | null,
        jobsSummaryLoading: false,
        jobsSummaryError: null
    },
    databaseHostsList: null
}
