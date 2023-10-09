
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

export interface DatabaseHostsEntities {
    getDatabaseHosts: {
        databaseHostsData: { items?: DatabaseHostItem[] } | null;
        databaseHostsLoading: false;
        databaseHostsError: null;
    };
}
