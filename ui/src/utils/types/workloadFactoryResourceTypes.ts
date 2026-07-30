export interface InstanceDetailsData {
    databaseInstanceName: string;
    fsxId: string;
    ec2InstanceId: string;
}

// Add a placeholder type for DatabaseInstanceTopology if not imported from elsewhere
export interface DatabaseInstanceTopology {
    serverType: string;
    serverInstallationMode: string;
    fileSystemType: string;
    fileSystemId: string;
    fileSystemName: string;
    fileSystemDeploymentMode: string;
    fileSystemStatus: string;
    fileSystemStorageCapacity: number;
    fileSystemThroughputCapacity: number;
    fileSystemStorageType: string;
    fsxLinkExists?: boolean;
    fsxLinksCount?: number;
    storageSummary: {
        volumes: Array<{
            id: string;
            name: string;
            luns: Array<{
                id: string;
                name: string;
            }>;
        }>;
        totalVolumes: number;
        totalLuns: number;
    };
}

export interface WorkloadFactoryResourceEntities {
    imageDataUrl: string;
    instanceDetailsData: InstanceDetailsData;
    sqlServerUserName: string;
    credentialUpdateSsmArn: string;
    passwordResetLoading: boolean;
    resourceLoading: boolean;
    // eslint-disable-next-line no-use-before-define
    resourceDetails: WorkloadFactoryResourceDetails;
    databaseListLoading: boolean;
    // eslint-disable-next-line no-use-before-define
    databaseList: WorkloadFactoryDatabaseItem[];
    replicaDatabasesMap: Record<string, WorkloadFactoryDatabaseItem[]>;
    replicaDatabasesLoading: boolean;
    selectedResourceId: string;
    selectedDatabaseInstance: string;
    selectedDatabaseInstanceName: string;
    selectedResourceCredId: any;
    selectedResourceRegionId: any;
    selectedHostname: string;
    isResourceRefresh: boolean;
    sqlServerPasswords: any;
    selectedAuthenticationType: string;
}

export type ResourceTrendMetric = {
    timestamp: string; // ISO date string
    value: number;
};

export interface WorkloadFactoryResourceDetails {
    id: string;
    name: string;
    status: string;
    databaseCount: number;
    databaseInstanceName?: string;
    databaseServer: {
        collation?: string;
        operatingSystem: string;
        serverEdition: string;
        serverVersion: string;
        nodeNames: Array<string>;
        activeConnections: number;
        creationDate: string;
        clusterName: string;
        activeNode: string;
    };
    databaseInstanceTopology: DatabaseInstanceTopology;
    resourceTrend: {
        cpuUsed: ResourceTrendMetric[];
        readThroughput: ResourceTrendMetric[];
        writeThroughput: ResourceTrendMetric[];
        readIops: ResourceTrendMetric[];
        writeIops: ResourceTrendMetric[];
        readLatency: ResourceTrendMetric[];
        writeLatency: ResourceTrendMetric[];
    };
    nodeTopology?: {
        ec2Details: Array<{
            id?: string;
        }>;
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
            protocol?: Array<string>;

            physicalUsed: number;
            ssdUsed: number;
            capacityPoolUsed: number;
            snapshotUsed: number;
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
        cpu: ResourceTrendMetric[];
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
    sqlServerDeploymentType: string;
    aoagDetails?: {
        serverInfo?: {
            serverName?: string;
            isHadrEnabled?: number;
        };
        availabilityGroups?: Array<{
            agName?: string;
            primaryReplica?: string;
            replicas?: Array<any>;
        }>;
        baseDeploymentType?: string;
    };
    clusterNodeDetails?: ClusterNodeDetail[];
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
    luns?: LunFilesMap;
    collation?: string;
    availabilityGroup?: string;
    replicaRole?: string;
    synchronizationState?: string;
    isReadableSecondary?: boolean;
    replicaDatabases?: WorkloadFactoryDatabaseItem[];
    replicaHostName?: string;
    fsxId?: string;
    fsxForOntap?: string;
}

export interface AoagClusterNode {
    node?: string;
    memberName?: string;
    memberType?: number;
    ip?: string;
    ec2InstanceId?: string;
    ec2InstanceName?: string;
    databaseHostId?: string;
    databaseInstanceId?: string;
}

export interface ClusterNodeDetail {
    ec2InstanceId?: string;
    ec2InstancePrivateIpAddress?: string;
    ec2InstanceType?: string;
    ec2InstanceName?: string;
}

export interface LunFile {
    name?: string;
    driveLetter?: string;
}

export interface LunFilesMap {
    dataFiles?: LunFile[];
    logFiles?: LunFile[];
}

export interface LunFilterOption {
    value: string;
    label: string;
}
