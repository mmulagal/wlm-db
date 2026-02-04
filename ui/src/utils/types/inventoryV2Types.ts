import { ErrorInvestigationInstance } from './agenticAITypes';

/** FSx authentication status value */
export type FsxAuthStatus = 'success' | 'failed' | 'pending';

/** Map of FSx IDs to their authentication status */
export type FsxAuthStatusMap = Record<string, FsxAuthStatus>;

/** Instance authentication status value */
export type InstanceAuthStatus = 'success' | 'failed' | 'pending';

/** Map of Instance IDs to their authentication status */
export type InstanceAuthStatusMap = Record<string, InstanceAuthStatus>;

interface OptionType {
    id: number;
    label: string;
    value: string;
}

export interface InventorySliceData {
    selectedPreparePageTab: string;
    selectedFSxForOntapCredentials: string;
    landingFromWizard: boolean;
    selectedMultiDetectInstances: OptionType[];
    selectedRowsForBulkRegister: any[];
    wizardOperationType: string;
    manageInstanceInstallAction: any;
    authenticationType: string;
    registerReplicaSelection: boolean;
    replicaSelectionForAuth: boolean;
    credentialOption: string;
    bulkInstanceCredentials: {
        authMode: any;
        username: string;
        password: string;
    };
    oracleBulkDatabaseCredentials: {
        oracleUsername: string;
        oraclePassword: string;
    };
    instanceCredentials: {
        [key: string]: {
            authMode: any;
            username: string;
            password: string;
        };
    };
    tableManageColumnState: any;
    selectedFilterValue: {} | any;
    selectedInventoryTab: string;
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
    multiMssqlDatabaseHostsData: any;
    getPgSqlDatabaseHosts: {
        databaseHostsData: any;
        databaseHostsLoading: boolean;
        fullHostDataLoading: boolean;
    };
    getOracleDatabaseHosts: {
        databaseHostsData: any;
        databaseHostsLoading: boolean;
        fullHostDataLoading: boolean;
    };
    multiPgSqlDatabaseHostsData: any;
    multiOracleDatabaseHostsData: any;
    discoveredHosts: {
        discoveredHostData: any;
        discoverHostLoading: boolean;
    };
    discoveredOracleHosts: {
        discoveredOracleHostData: any;
        discoverOracleHostLoading: boolean;
    };
    discoveredPgsqlHosts: {
        discoveredPgsqlHostData: any;
        discoverPgsqlHostLoading: boolean;
    };
    fsxCredentialStatusObj: any; // For MSSQL
    fsxCredentialStatusObjOracle: any; // For Oracle
    fsxCredentialStatusObjPgsql: any; // For PostgreSQL
    fsxCredentialStatusLoading: boolean;
    fsxCredentialStatusLoadingOracle: boolean;
    fsxCredentialStatusLoadingPgsql: boolean;
    mssqlInstancesData: any;
    pgsqlInstancesData: any;
    oracleInstancesData: Record<string, OracleInstanceData> | null;
    perfMssqlInstancesData: any;
    inProgressInstances: any;
    detectManageUserName: string;
    detectManagePassword: string;
    detectOntapUsername: string;
    detectOntapPassword: string;
    detectOntapCredentialsByFsx: Record<string, { username: string; password: string }>;
    detectWindowsAuthentication: {
        username: string;
        password: string;
    };
    detectCredentialErrors: {
        databaseServerError: string;
        fsxnError: string;
        oracleAsmError: string;
    };
    resetManagedData: boolean;
    removeSecNodeDiscoveredList: Array<string>;
    unManagedPerfInstanceIdsList: Array<string>;
    unManagedInstanceIdsList: Array<string>;
    managedHostInstanceLoading: boolean;
    selectedHeaderTab: string;
    isRefreshed: boolean;
    managedAssessmentHostIdsList: Array<string>;
    allmssqlHostAssessmentData: any;
    allOracleHostAssessmentData: any;
    allmssqlHostAssessmentLoading: boolean;
    allOracleHostAssessmentLoading: boolean;
    allLogAnalysisData: Array<ErrorInvestigationInstance>;
    allLogAnalysisLoading: boolean;
    allLogAnalysisOracleLoading: boolean;
    potentialSavingsHostData: {
        [key: string]: any;
    };
    selectedHostType: string;
    hostTableRows: Array<any>;
    instanceTableRows: Array<any>;
    databaseTableRows: Array<any>;
    fullHostTableRows: Array<any>;
    fullInstanceTableRows: Array<any>;
    fullDatabaseTableRows: Array<any>;
    dashSandboxList: {
        data: Array<any>;
        loading: boolean;
        error: string;
    };
    dashSandboxSavings: {
        data: Array<any>;
        loading: boolean;
        error: string;
    };
    createResourceApiLoading: boolean;
    manageSingleInstanceReadiness: any;
    manageSingleInstanceChecks: any;
    manageSingleInstanceData: any;
    replicaSelectedRowsForManage: any;
    bulkDetectedInstanceList: any;
    registerHostType: string;
    fsxAuthStatus: FsxAuthStatusMap;
    instanceAuthStatus: InstanceAuthStatusMap;
    bulkWizardStartAtFsxStep: boolean;
    mssqlInstancesTabVisitCount: number;
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
    fullManagedInstanceLoading?: boolean;
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
    platform?: string;
    protocol?: string;
}

export interface InventoryTableInstanceDatInterface {
    databaseInstanceId?: string;
    databaseInstanceName?: string;
    status?: string;
    instanceType?: string; // Oracle tenancy type: SINGLE_TENANT or MULTI_TENANT
    protocol?: string; // Storage protocol used by the Oracle instance
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
            protocol?: Array<string>;
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
    sqlServerDeploymentType?: string;
    discoverInstanceData?: any;
    isFsxRegistered?: boolean;
    isDefaultAuthentication?: boolean;
    oracleServerAuthentication?: boolean;
    isInstanceStorageAsmManaged?: boolean;
    asmAuthentication?: boolean;
    windowsAuthentication?: boolean;
    sqlServerAuthentication?: boolean;
    windowsDomainUserAuthentication?: boolean;
}

export interface StorageInterface {
    fsxn?: {
        protocol?: Array<string>;
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
    instanceType?: string; // Oracle tenancy type: SINGLE_TENANT or MULTI_TENANT
    protocol?: string; // Storage protocol used by the Oracle instance
    databases?: Array<{
        // Databases property coming for Oracle having size and type property
        name: string;
        size: number;
        status: string;
        type: string;
    }>;
    dataguardDetails?: any;
    databaseCount?: number;
    isInstanceStorageAsmManaged?: boolean;
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
    ssmStatus?: string; // Connected,NotConnected,Connecting,Disconnected, N\A
    loading?: boolean;
    databaseInstanceDetails?: Array<{
        databaseInstanceId?: string;
        instanceName?: string;
        instanceState?: string;
        isManaged?: boolean;
        databaseInstanceStatus?: string; // up, down
        isInstanceStorageAsmManaged?: boolean; // will get for Oracle databases
    }>;
    clusterNodeDetails?: Array<{
        ec2InstanceId?: string;
        ec2InstancePrivateIpAddress?: string;
        ec2InstanceType?: string;
        ec2InstanceName?: string;
    }>;
    nodeTopology?: {
        windowsClusterName?: string;
        fqdn?: string;
        nodeIpAddress?: string;
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
    ssmStatus?: string; // Connected,NotConnected,Connecting,Disconnected, N\A
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
    pgsqlServerInstances?: Array<PgsqlInstancesDiscovered>;
    oracleServerDeploymentType?: string;
    databaseInstanceDetails?: Array<OracleInstancesDiscovered>;
    [key: string]: any;
}

export interface DiscoverOracleHostInterface {
    ec2InstanceId: string;
    ec2InstanceType?: string;
    platform?: string;
    ssmState?: string;
    ec2InstanceName?: string;
    ec2UsageOperation?: string;
    key?: string;
    vpc?: {
        id?: string;
        name?: string;
        cidrBlock?: string;
    };
    oracleServerDeploymentType?: string;
    databaseInstanceDetails?: Array<OracleInstancesDiscovered>;
    credentialId?: string;
    regionId?: string;
}

export interface DiscoverPgsqlHostInterface {
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
    pgsqlServerInstances?: Array<PgsqlInstancesDiscovered>;
    credentialId?: string;
    regionId?: string;
    ec2Details?: Array<{
        id?: string;
        name?: string;
    }>;
}

export interface OracleInstancesDiscovered {
    instanceName?: string;
    instanceId?: string;
    instanceState?: string;
    version?: string;
    isDefaultAuthentication?: boolean;
    oracleServerAuthentication?: boolean;
    isInstanceStorageAsmManaged?: boolean;
    asmAuthentication?: boolean;
    instanceType?: string;
    databaseCount?: number;
    databaseDetails?: {
        databaseName?: string;
        databaseId?: string;
        openMode?: string;
    };
    pluggableDatabases?: Array<{
        pdbName?: string;
        pdbId?: string;
        pdbStatus?: string;
    }>;
    defaultAuth?: boolean;
    storage?: Array<{
        type?: string;
        id?: string;
        svmId?: string;
        protocol?: string;
        fileSystemStorageType?: string;
        deploymentType?: string;
        zones?: Array<string>;
        nfsMountPoint?: string;
        mountDetails?: Array<{
            mountIp: string;
            mountPoint: string;
            protocol: string;
        }>;
    }>;
    dataguardDetails?: any;
}

export interface SQLServerInstancesDiscovered {
    sqlServerInstance?: string;
    sqlServerState?: string;
    sqlServerVersion?: string;
    sqlServerProductYear?: string;
    isDefaultInstance?: boolean;
    windowsAuthentication?: boolean;
    windowsDomainUserAuthentication?: boolean;
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
    manageReadiness?: any;
    dataguardDetails?: any;
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
}

export interface PgsqlInstancesDiscovered {
    pgsqlServerInstanceName?: string;
    pgsqlServerState?: string;
    pgsqlServerVersion?: string;
    pgsqlServerName?: string;
    pgsqlServerDeploymentType?: boolean;
    pgsqlServerInstanceId?: boolean;
    databaseCount?: string;
    isPrimary?: number;
    defaultAuth?: string;
    primaryNode?: {
        ec2InstanceId?: string;
        ec2InstancePrivateIpAddress?: string;
        ec2InstanceType?: string;
        ec2InstanceName?: string;
        ec2UsageOperation?: string;
    };
    storage?: Array<any>;
    nodes?: Array<{
        ec2InstanceId?: string;
        ec2InstancePrivateIpAddress?: string;
        ec2InstanceType?: string;
        ec2InstanceName?: string;
        ec2UsageOperation?: string;
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

export type OracleInstanceData = {
    isManagedHost: boolean;
    loading: boolean;
    data: OracleHostData | null;
    error: any | null;
    fields?: Array<string>;
};

export interface OracleHostData {
    databaseHostStatus: string;
    databaseInstanceDetails: any[];
    databaseInstancesSummary?: any[];
    estimatedUsageCost?: {
        compute: number;
        storage: any;
        connectivity: number;
        others: number;
        estimationType: string;
    };
    fsxnResourceInfo?: any[];
    id: string;
    name: string;
    ssmStatus: string;
    storageAllocation?: any;
}

export interface ManageReadinessInterface {
    [key: string]: {
        missingSqlPermissions?: string[];
        missingModules: string[];
    };
}
