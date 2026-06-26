export interface InnerPageDetailsInterface {
    fsxId: string;
    ec2InstanceId: string;
    isInstanceStorageAsmManaged?: boolean;
}

interface CountBreakDown {
    total?: number;
    optimized?: number;
    notOptimized?: number;
    percent?: number;
    critical?: number;
    warning?: number;
    dismissedOrPostponed?: number;
    dismissedIds?: string[];
}

export interface RSSConfigAdapterInterface {
    adapterName?: string;
    rssProfile?: string;
    rssEnabled?: boolean;
    baseProcessorNumber?: string;
    numberOfReceiveQueues?: string;
}

export interface PerDriveObjInterface {
    databaseName?: string;
    logDriveLetter?: string;
    dataDriveLetter?: string;
    logDrivePercent?: number;
    logDriveTotalSizeMB?: number;
    dataDriveTotalSizeMB?: number;
}

export type AssessmentConfigCategoryType = 'storage' | 'compute' | 'application' | 'resiliency' | 'cloning';

export interface AssessmentMetadata {
    lastAssessmentTimestamp?: number | string;
    fileSystemId?: string;
    ec2InstanceId?: string;
    databaseInstanceName?: string;
    deploymentType?: string;
    databaseHostName?: string;
    storageProtocol?: string;
    isASMManaged?: boolean;
    baseDeploymentType?: string;
    isStorageLayoutFra?: boolean;
    isWad?: boolean;
}

export interface DismissedConfigurationItem {
    name: string;
    id: string;
    configState: string;
    startTime: number;
    endTime?: number;
}

export interface PerConfigInterface {
    id?: string;
    type?: string;
    name?: string;
    status?: string;
    current?: string;
    recommended?: string;
    severity?: string;
    recommendation?: string;
    tags?: string[];
    subType?: string;
    categories?: string[];
    focusWidgetName?: string;
    objectsInViolation?: string[] | null;
    recommendationOptions?: any;
    errorMessage?: string;
    missingPermissions?: string[];
    recommendedSizeInGib?: number;
    resourceType?: string;
    totalObjectsAssessed?: number;
    totalObjectsInViolation?: number;
    violationDetails?: any;
    // Per sub-config recommendations for nested configs (e.g. storage-efficiencies)
    configDetails?: Array<{
        id?: string;
        name?: string;
        recommended?: string;
        objectType?: string;
        recommendedByDataCategory?: Record<string, string>;
        recommendedNote?: string;
    }>;
    ec2InstancesToPatch?: Array<{
        baselineId?: string;
        criticalNonCompliantCount?: number;
        ec2InstanceId?: string;
        ec2InstanceName?: string;
        operationStartTime?: number;
        operationEndTime?: number;
        securityNonCompliantCount?: number;
        otherNonCompliantCount?: number;
    }>;
    missingPatchesInEc2Instances?: Array<{
        ec2InstanceId?: string;
        ec2InstanceName?: string;
        criticalMissingPatchesCount?: number;
        importantMissingPatchesCount?: number;
        missingPatchesCount?: number;
    }>;
    missingPatchesCount?: number;
    rssAdapters?: Array<RSSConfigAdapterInterface>;
    tcpOffloadState?: string;
    recommendedAdapterSettings?: {
        recommendedRssProfile?: string;
        recommendedBaseProcessorNumber?: string;
        recommendedReceiveQueues?: string;
    };
    sizingViolations?: {
        overProvisionedDrives?: Array<PerDriveObjInterface>;
        underProvisionedDrives?: Array<PerDriveObjInterface>;
        ignoredDrives?: Array<PerDriveObjInterface>;
    };
    cloneDetails?: any;
}

export interface AssessmentResponseInterface {
    /** List of configuration assessment items (new API response shape) */
    assessments?: PerConfigInterface[];
    metadata?: AssessmentMetadata;
    dismissedConfigurations?: DismissedConfigurationItem[] | Record<string, unknown>;
    storage?: {
        timestamp?: string;
        optimisedCount?: {
            total?: number;
            optimised?: number;
        };
        configuration?: {
            volumes?: PerConfigInterface[];
            luns?: PerConfigInterface[];
            os?: PerConfigInterface[];
        };
        sizing?: PerConfigInterface[];
        layout?: PerConfigInterface[];
    };
    compute?: PerConfigInterface;
    rssConfig?: PerConfigInterface;
    mtuAlignment?: PerConfigInterface;
    license?: PerConfigInterface;
    hostOsPatch?: PerConfigInterface;
    mssqlPatch?: PerConfigInterface;
    maxDOP?: PerConfigInterface;
    snapshotPolicy?: PerConfigInterface;
    awsBackup?: PerConfigInterface;
    highAvailability?: Array<{ [Key: string]: PerConfigInterface }>;
    crr?: PerConfigInterface;
    snapcenterSnapshot?: PerConfigInterface;
    oracleSecurityPatch?: PerConfigInterface;
    transparentHugepages?: PerConfigInterface;
    tcpAdvancedOptions?: PerConfigInterface;
    filesystemsIoOptions?: PerConfigInterface;
    multiblockReadcount?: PerConfigInterface;
    clone?: PerConfigInterface;
}

export interface HostAssessmentResponseInterface {
    databaseInstanceId: string;
    deploymentType?: string;
    assessments?: AssessmentResponseInterface;
    error?: string;
}

// New flat assessment response structure
export interface FlatAssessmentItem extends PerConfigInterface {
    id: string;
    name: string;
    type: string; // 'storage' | 'compute' | 'application' | 'resiliency' | 'cloning'
    categories: string[];
}

export interface FlatAssessmentResponse {
    assessments: FlatAssessmentItem[];
    dismissedConfigurations: FlatAssessmentItem[];
    metadata: {
        lastAssessmentTimestamp: number;
        fileSystemId: string;
        ec2InstanceId: string;
        databaseInstanceName: string;
        deploymentType: string;
        databaseHostName: string;
        baseDeploymentType?: string;
        isWad?: boolean;
    };
}

export interface GwPerConfigCardInterface {
    mapName: string;
    block_one: {
        type: string;
        value: string;
        smallFont?: boolean;
    };
    block_two: {
        type: string;
        value: string;
        smallFont?: boolean;
    };
    block_three: {
        type: string;
        value: string;
        smallFont?: boolean;
        list?: string[] | null;
    };
    block_four: {
        type: string;
        value: string;
        smallFont?: boolean;
    };
    block_five?: any;
    block_six?: any;
    recommendation?: {
        title: string;
        description?: string;
        values?: string[] | undefined;
        valuesHeading?: string;
        descriptionList?: Array<{ title: string; description: string }> | undefined;
        descriptionRssConfig?: {
            first?: string;
            second?: string;
            points?: string[];
            last?: string;
        };
        info?: string;
    };
    tags: string[];
    category?: string;
    id?: string;
    rssOptimizedRows?: {
        [key: string]: string;
    };
    rssOptimizedValues?: {
        [key: string]: string;
    };
}

export interface GwCardDataInterface {
    [key: string]: GwPerConfigCardInterface;
}

export interface GwSqlServerInstanceInterface {
    sqlServerInstance: string;
    sqlServerState?: string;
    sqlServerVersion?: string;
    sqlServerProductYear?: number;
    sqlServerEdition: string;
    sqlServerEngineEdition?: number;
    sqlServerName?: string;
}

export interface GetWellSliceInterface {
    configEngineType: string;
    innerPageDetails: InnerPageDetailsInterface;
    visitedTabs: any;
    selectedWellArchitectTab: string;
    selectedCloneTab: string;
    optimizePageLoading: boolean | null;
    driftAssessmentData: AssessmentResponseInterface | null;
    isAssessmentAvailable: boolean;
    selectedHostname: string;
    selectedResourceId: string;
    selectedDatabaseInstance: string;
    selectedDatabaseInstanceName: string;
    selectedGwInstanceCredId: string;
    selectedGwInstanceRegionId: string;
    selectedDatabaseStorageType: string;
    selectedDatabaseAoagStorageType: string;
    selectedRowFsxId: string;
    cardData: any;
    optimizationBreakDown: {
        storage?: CountBreakDown;
        compute?: CountBreakDown;
        application?: CountBreakDown;
        resiliency?: CountBreakDown;
        cloning?: CountBreakDown;
        total?: CountBreakDown;
    } | null;
    gwRefreshPage: boolean;
    gwTimestamp: string;
    gwRefreshTimestamp: string;
    optimizingData: any;
    optimizingInstanceData: boolean;
    selectedRecommendedInstance: any;
    selectedSnapshotPolicy: any;
    selectedSnapshot: any;
    selectedAWSBackup: any;
    credIdFromJM: string;
    regionFromJM: string;
    landingFrom: string;
    inProgressOptimizationData: any;
    inProgressResourceOptimizeData: any;
    inProgressHostData: any;
    jobToInstanceMap: any;
    jobToInstanceMapForBulk: any;
    recommendedInstanceInBulk?: any;
    landingFromInnerPage?: boolean;
    isInnerPageOptimize?: boolean;
    gwAdhocError?: string;
    cloneDashboardData: any;
    cloneIsOptimizedRows: any;
    inProgressStateData: any;
    isWad?: boolean; // Flag to indicate if the instance is from WAD (offline assessment)
    instanceStatus?: string;
}
