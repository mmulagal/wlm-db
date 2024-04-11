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
    databaseServer: {
        operatingSystem: string;
        serverEdition: string;
        serverVersion: string;
        nodeNames: Array<string>;
        activeConnections: number;
        creationDate: string;
        clusterName: string;
        activeNode: string;
    };
    topology: {
        awsAccount: string;
        region: string;
        serverType: string;
        serverInstallationMode: string;
        fileSystemName: string;
        fileSystemDeploymentMode: string;
        fileSystemType: string;
        fileSystemId: string;
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
        isAwsBackupEnabled: {
            fsxn?: boolean;
            fsxw?: boolean;
            ebs?: boolean;
        };
        isFsxOntapSnapshotsEnabled: boolean;
        isSqlNativeEnabled: boolean;
    };

    performance: {
        rwMetrics: {
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
    };

    storage: {
        fsxn?: {
            size?: number;
            used?: number;
            spaceSavings?: number;
            spaceSavingsPercent?: number;
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

    estimatedUsageCost: {
        compute: number;
        storage: {
            fsxn?: number;
            fsxw?: number;
            ebs?: number;
        };
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
    protection?: {
        isAwsBackupEnabled: {
            fsxn: boolean;
            fsxw: boolean;
            ebs: boolean;
        };
        isFsxOntapSnapshotsEnabled: boolean;
        isSqlNativeEnabled: boolean;
    };
}
