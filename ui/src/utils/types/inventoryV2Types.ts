export interface InventorySliceData {
    tableManageColumnState: any;
    selectedFilterValue: {} | any;
    selectedInventoryTab: string;
    optimizeInnerPageValues: {} | any;
    selectedOptimizeConfig: any;
    breadCrumbSelectedFrom: string;
    defaultFilterOptions: {} | any;
    optimizeFilterTags: [] | any;
    inventoryTableData: { [key: string]: InventoryTableData } | null;
    inventoryChartData: InventoryChartData | null;
    isManagedHostListLoading: boolean;
    getDatabaseHosts: {
        databaseHostsData: any;
        databaseHostsLoading: boolean;
        fullHostDataLoading: boolean;
    };
    getPgSqlDatabaseHosts: {
        databaseHostsData: any;
        databaseHostsLoading: boolean;
        fullHostDataLoading: boolean;
    };
    discoveredHosts: {
        discoveredHostData: any;
        discoverHostLoading: boolean;
    };
    fsxCredentialStatusObj: any;
    fsxCredentialStatusLoading: boolean;
    mssqlInstancesData: any;
    perfMssqlInstancesData: any;
    inProgressInstances: any;
    manageHostSelectedRows: any;
    valuesNotFilled: boolean;
    detectHostRadio: string;
    detectManageUserName: string;
    detectManagePassword: string;
    detectOntapUsername: string;
    detectOntapPassword: string;
    detectedInstanceId: string;
    inventoryExpandedRowHostData: any;
    resetManagedData: boolean;
    removeSecNodeDiscoveredList: Array<string>;
    unManagedPerfInstanceIdsList: Array<string>;
    managedHostInstanceLoading: boolean;
    selectedHeaderTab: string;
    isRefreshed: boolean;
    managedAssessmentHostIdsList: Array<string>;
    managedAssessmentHostData: any;
    allmssqlHostAssessmentData: any;
    allmssqlHostAssessmentLoading: boolean;
    potentialSavingsHostData: {
        [key: string]: any;
    };
    selectedRowsForManage: Array<any>;
    hostTableRows: Array<any>;
    instanceTableRows: Array<any>;
    databaseTableRows: Array<any>;
}

export interface InventoryTableData {
    ec2InstanceId?: string;
    ec2InstanceName?: string;
    resourceId?: string;
    id?: string;
    name?: string;
    hostType?: string;
    status?: string;
    ssmState?: string;
    totalInstance?: number;
    managedInstance?: number;
    serverInstallationMode?: string;
    serverAllInstallationMode?: Array<string>;
    vpcId?: string;
    vpcName?: string;
    vpcCidr?: string;
    action?: string;
    actionDisable?: boolean;
    ec2Details?: Array<EC2DetailsInterface>;
    estimatedUsageCost?: EstimatedUsageCostInterface;
    allocatedCapacity?: number;
    isManagedHost?: boolean;
    loading?: boolean;
    isDetected?: boolean;
    storageType?: string;
    sqlServerInstances?: Array<InventoryTableInstanceDatInterface>;
    hasInstanceData?: boolean;
    credentialId?: string;
    regionId?: string;
    credentialName?: string;
    regionName?: string;
    accountId?: string;
    statusColText?: string;
}

export interface InventoryTableInstanceDatInterface {
    databaseInstanceId?: string;
    databaseInstanceName?: string;
    status?: string;
    databaseCount?: number;
    isDetected?: boolean;
    isManaged?: boolean;
    fileSystemDeploymentMode?: string;
    fileSystemType?: string;
    fsxId?: string;
    statusColText?: string;
    storageSavingsText?: string;
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
    databaseServer?: {
        activeConnections?: string;
        activeNode?: string;
        collation?: string;
        creationDate?: string;
        nodeNames?: Array<string>;
        operatingSystem?: string;
        serverEdition?: string;
        serverVersion?: string;
    };
}

export interface StorageInterface {
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
    statusColText?: string;
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
    databaseInstanceTopology?: {
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
    hostType?: string;
    name?: string;
    nodeStatus?: string; // running,terminated,pending,shutting-down,stopping,stopped,N\A
    databaseHostStatus?: string;
    ssmStatus?: string; //Connected,NotConnected,Connecting,Disconnected, N\A
    loading?: boolean;
    databaseInstanceDetails?: Array<{
        databaseInstanceId?: string;
        instanceName?: string;
        instanceState?: string;
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
        ec2Details?: Array<EC2DetailsInterface>;
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
    fsxnResourceInfo?: Array<{
        id?: string;
        capacityCost?: number;
        operationalCost?: number;
        size?: number;
    }>;
    fsxwResourceInfo?: Array<{
        id?: string;
        capacityCost?: number;
        operationalCost?: number;
        size?: number;
    }>;
    storageAllocation?: {
        fsxw?: number;
        fsxn?: number;
        ebs?: number;
    };
}

export interface EC2DetailsInterface {
    id?: string;
    name?: string;
    ebsVolumeId?: string;
    instanceType?: string;
    availabilityZone?: string;
    subnetId?: string;
}

export interface DatabaseInstanceDetailsInterface {
    instanceName?: string;
    instanceState?: string;
    isManaged?: boolean;
    databaseInstanceStatus?: string; // up, down
}

export interface InstancesHostsRowInterface {
    id?: string;
    name?: string;
    nodeStatus?: string; // running,terminated,pending,shutting-down,stopping,stopped,N\A
    databaseHostStatus?: string;
    ssmStatus?: string; //Connected,NotConnected,Connecting,Disconnected, N\A
    loading?: boolean;
    databaseInstanceDetails?: Array<DatabaseInstanceDetailsInterface>;
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
        ec2Details?: Array<EC2DetailsInterface>;
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
    sqlLicenseIncluded?: boolean;
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
    credentialId?: string;
    regionId?: string;
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
    fileSystemStorageType?: string;
}

export interface StatusObjInterface {
    status?: string;
    name?: string;
    storageType?: any;
    fsxId?: string;
    isFsxRegistered?: boolean;
    detectOption?: string;
    detectOptionDisableMsg?: string;
}

export interface InstancesObjectInterface {
    data?: InstancesHostsRowInterface;
    loading?: boolean;
    isManagedHost?: boolean;
}

export type InstanceActions = 'manage' | 'unmanage' | 'detect';
