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
    objectsInViolation?: string[] | null;
    recommendationOptions?: any;
    errorMessage?: string;
    missingPermissions?: string[];
    recommendedSizeInGib?: number;
    resourceType?: string;
    totalObjectsAssessed?: number;
    totalObjectsInViolation?: number;
    violationDetails?: any;
    ec2InstancesToPatch?: Array<{
        baselineId?: string;
        criticalNonCompliantCount?: number;
        ec2InstanceId?: string;
        ec2InstanceName?: string;
        operationStartTime?: number;
        operationEndTime?: number;
        securityNonCompliantCount?: number;
        otherNonCompliantCount?: number;
        missingPatchDetails?: Array<{
            classification?: string;
            severity?: string;
            state?: string;
            title?: string;
            kbId?: string;
        }>;
    }>;
    missingPatchesInEc2Instances?: Array<{
        ec2InstanceId?: string;
        ec2InstanceName?: string;
        criticalMissingPatchesCount?: number;
        importantMissingPatchesCount?: number;
        missingPatchesCount?: number;
        missingPatchDetails?: Array<{
            classification?: string;
            severity?: string;
            state?: string;
            title?: string;
            kbId?: string;
        }>;
    }>;
    missingPatchDetails?: Array<{
        missingPatchesCount?: number;
        missingPatches?: Array<{
            cveId?: string;
            component?: string;
            description?: string;
            releaseDate?: string;
            releaseName?: string;
        }>;
    }>;
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
}

export interface AssessmentResponseInterface {
    dismissedConfigurations?: any;
    fileSystemId: string;
    ec2InstanceId: string;
    databaseHostName: string;
    databaseInstanceName: string;
    lastAssessmentTimestamp?: string;
    deploymentType?: string;
    baseDeploymentType?: string;
    isASMManaged?: boolean;
    storageProtocol?: string;
    isStorageLayoutFra?: boolean;
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
    clone?: PerConfigInterface;
    isWad?: boolean;
}

export interface HostAssessmentResponseInterface {
    databaseInstanceId: string;
    deploymentType?: string;
    assessments?: AssessmentResponseInterface;
    error?: string;
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
    osConfigTableData: PerConfigInterface[] | null;
    ontapConfigTableData: PerConfigInterface[] | null;
    mssqlHighAvailabilityTableData: PerConfigInterface[] | null;
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
}
