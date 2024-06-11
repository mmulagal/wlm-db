export interface InventorySliceData {
    inventoryTableData: { [key: string]: InventoryTableData } | null;
    inventoryChartData: InventoryChartData | null;
    isManagedHostListLoading: boolean;
    getDatabaseHosts: {
        databaseHostsData: any;
        databaseHostsLoading: boolean;
        fullHostDataLoading: boolean;
    };
    discoveredHosts: {
        discoveredHostData: any;
        discoverHostLoading: boolean;
    };
    fsxCredentialStatusObj: any;
}

export interface InventoryTableData {
    ec2InstanceId?: string;
    ec2InstanceName?: string;
    id?: string;
    name?: string;
    status?: string;
    ssmState?: string;
    totalInstance?: number;
    managedInstance?: number;
    serverInstallationMode?: string;
    vpcId?: string;
    vpcName?: string;
    vpcCidr?: string;
    action?: string;
    actionDisable?: boolean;
    ec2Details?: Array<{
        id?: string;
        name?: string;
        ebsVolumeId?: string;
    }>;
    estimatedUsageCost?: EstimatedUsageCostInterface;
    allocatedCapacity?: number;
    sqlServerInstances?: Array<{
        databaseInstanceId?: string;
        databaseInstanceName?: string;
        status?: string;
        databaseCount?: number;
        isDetected?: boolean;
        isManaged?: boolean;
        fileSystemDeploymentMode?: string;
        fileSystemType?: string;
        protection?: {
            isAwsBackupEnabled?: { fsxn?: boolean; fsxw?: boolean; ebs?: boolean };
            isFsxOntapSnapshotsEnabled?: boolean;
            isSqlNativeEnabled?: boolean;
            protectedDatabases?: number;
        };
        performance?: {
            assessment?: string;
        };
        storage?: {
            fsxn?: {
                protocol?: Array<String>;
                size?: number;
                used?: number;
                spaceSavings?: number;
                spaceSavingsPercentage?: number;
            };
            fsxw?: {
                size?: number;
                used?: number;
                spaceSavings?: number;
                spaceSavingsPercentage?: number;
            };
            ebs?: {
                size?: number;
            };
        };
        allocatedCapacity?: number;
    }>;
}

export interface InventoryChartData {
    detectedHost?: number;
    undetectedHost?: number;
    managedInstance?: number;
    unmanagedInstance?: number;
}

export interface EstimatedUsageCostInterface {
    compute?: number;
    storage?: { fsxn?: number; fsxw?: number; ebs?: number };
    connectivity?: number;
    others?: number;
    estimationType?: string;
}

export interface DatabaseInstancesSummaryInterface {
    databaseInstanceId?: string;
    databaseInstanceName?: string;
    status?: string;
    databaseCount?: number;
    databaseServer?: {
        operatingSystem?: string;
        serverEdition?: string;
        serverVersion?: string;
        clusterName?: string;
        activeNode?: string;
        nodeNames?: Array<string>;
        activeConnections?: number;
        creationDate?: string;
        collation?: string;
    };
    databseInstanceTopology?: {
        serverType?: string;
        serverInstallationMode?: string;
        fileSystemType?: string;
        fileSystemId?: string;
        fileSystemName?: string;
        fileSystemDeploymentMode?: string;
        fileSystemStatus?: string;
        fileSystemStorageCapacity?: number;
        fileSystemThroughputCapacity?: number;
        availabilityZones?: Array<string>;
    };
    protection?: {
        isSqlNativeEnabled?: boolean;
        isAwsBackupEnabled?: {
            fsxn?: boolean;
            fsxw?: boolean;
            ebs?: boolean;
        };
        isFsxOntapSnapshotsEnabled?: boolean;
        protectedDatabases?: number;
    };
    performance?: {
        latency?: number;
        assessment?: string;
        rwMetrics?: {
            latency?: {
                read?: number;
                write?: number;
                serverIo?: number;
            };
            iops?: {
                read?: number;
                write?: number;
            };
            throughput?: {
                read?: number;
                write?: number;
            };
        };
    };
    storage?: {
        [key: string]: StorageInterface;
    };
    resourceUtilization?: {
        cpu?: ResourceUtilizationInterface;
        memory?: ResourceUtilizationInterface;
        disk?: ResourceUtilizationInterface;
    };
    sqlServerDeploymentType?: string;
    databaseInstanceErrors?: string;
}

export interface ResourceUtilizationInterface {
    percentUsed?: string;
    used?: string;
    total?: string;
    remaining?: string;
    error?: string;
}

export interface StorageInterface {
    size?: number;
    used?: number;
    spaceSavings?: number;
    spaceSavingsPercentage?: number;
    protocol?: Array<string>;
}

export interface ManagedHostsRowInterface {
    id?: string;
    name?: string;
    nodeStatus?: string; // running,terminated,pending,shutting-down,stopping,stopped,N\A
    ssmStatus?: string; //Connected,NotConnected,Connecting,Disconnected, N\A
    databaseInstanceDetails?: Array<{
        instanceName?: string;
        isManaged?: boolean;
        databaseInstanceStatus?: string; // up, down
    }>;
    clusterNodeDetails?: Array<{
        ec2InstanceId?: string;
        ec2InstancePrivateIpAddress?: string;
        ec2InstanceType?: string;
        ec2InstanceName?: string;
    }>;
    nodeTopology?: {
        awsAccount?: string;
        region?: string;
        vpcId?: string;
        vpcName?: string;
        vpcCidr?: string;
        keyPairName?: string;
        ec2Details?: Array<{
            id?: string;
            name?: string;
            ebsVolumeId?: string;
            instanceType?: string;
            availabilityZone?: string;
            subnetId?: string;
        }>;
        activeDirectoryDetails?: {
            name?: string;
            address?: string;
        };
    };
    ebsResourceInfo?: Array<{
        id?: string;
        size?: number;
        cost?: number;
        throughput?: number;
        iops?: number;
        volumeType?: string;
    }>;
    estimatedUsageCost?: EstimatedUsageCostInterface;
    databaseInstancesSummary?: Array<DatabaseInstancesSummaryInterface>;
    nodeInstanceError?: string;
}

export interface DiscoverHostInterface {
    ec2InstanceId: string;
    ec2InstanceType?: string;
    ssmState?: string;
    ec2InstanceName?: string;
    ec2UsageOperation?: string;
    nodesList?: Array<string>;
    key?: string;
    vpc?: {
        id?: string;
        name?: string;
        cidrBlock?: string;
    };
    sqlServerInstances?: Array<SQLServerInstancesDiscovered>;
}

export interface SQLServerInstancesDiscovered {
    sqlServerInstance?: string;
    sqlServerState?: string;
    sqlServerVersion?: string;
    sqlServerProductYear?: string;
    isDefaultInstance?: boolean;
    windowsAuthentication?: boolean;
    sqlServerEdition?: string;
    sqlServerEngineEdition?: number;
    sqlServerName?: string;
    serverGuid?: string;
    failureInfo?: string;
    sqlServerNodes?: Array<string>;
    nodeIps?: Array<string>;
    sqlServerDeploymentType?: string;
    databaseCount?: number;
    sqlServerAuthentication?: boolean;
    storage?: Array<DiscoveredStorageObj>;
    deploymentTypes?: Array<{
        type?: string;
        zones?: Array<string>;
    }>;
}

export interface DiscoveredStorageObj {
    type?: string;
    id?: string | undefined;
    svmId?: string;
    protocol?: string;
}

export interface StatusObjInterface {
    status: string;
    name: string;
    storageType: any;
}
