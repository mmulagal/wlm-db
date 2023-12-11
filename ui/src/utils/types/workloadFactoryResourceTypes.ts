export interface WorkloadFactoryResourceEntities {
    resourceLoading: boolean;
    resourceDetails: WorkloadFactoryResourceDetails;
    databaseListLoading: boolean;
    databaseList: WorkloadFactoryDatabaseItem[];
}

export interface WorkloadFactoryResourceDetails {
    id: string;
    name: string;
    status: string;
    databaseCount: number;
    operatingSystem: string;
    serverEdition: string;
    serverVersion: string;
    clusterName: string;
    activeConnections: number;
    creationDate: number;
    topology: {
        awsAccount: string;
        region: string;
        serverType: string;
        serverInstallationMode: string;
        fileSystemType: string;
        fsxFilesystemId: string;
        fileSystemStatus: string;
        fileSystemStorageCapacity: string;
        fileSystemThroughputCapacity: string;
        vpcId: string;
        keyPairName: string;
        ec2Details: Array<{
            id: string;
            name: string;
            instanceType: string;
            ebsVolumeId: string;
            vpcID: string;
            availabilityZone: string;
            subnetId: string;
        }>;
        activeDirectoryDetails: {
            name: string;
            address: string;
        };
    };

    protection: {
        isAwsBackUpEnabled: boolean;
        isFsxOntapSnapshotsEnabled: boolean;
        isSqlNativeEnabled: boolean;
    };

    performance: {
        latency: {
            current: number;
            assessment: string;
            read: number;
            write: number;
        };
        iops: {
            current: number;
            read: number;
            write: number;
        };
        throughput: {
            current: number;
            read: number;
            write: number;
        };
    };

    storage: {
        size: number;
        used: number;
        spaceSavings: number;
        spaceSavingsPercent: number;
    };

    estimatedUsageCost: {
        compute: number;
        storage: number;
        connectivity: number;
        others: number;
    };

    resourceUtilization: {
        cpu: {
            percentUsed: string;
            used: string;
            total: string;
            remaining: string;
        };
        disk: {
            percentUsed: string;
            used: string;
            total: string;
            remaining: string;
        };
        memory: {
            percentUsed: string;
            used: string;
            total: string;
            remaining: string;
        };
    };
}

export interface WorkloadFactoryDatabaseItem {
    id: string;
    name: string;
    status: string;
    size: number;
    type: string;
    isProtected: boolean;
}
