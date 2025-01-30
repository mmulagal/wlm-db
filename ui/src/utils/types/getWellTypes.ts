export interface GetWellSliceInterface {
    optimizePageLoading: boolean;
    driftAssessmentData: AssessmentResponseInterface | null;
    isAssessmentAvailable: boolean;
    selectedHostname: string;
    selectedResourceId: string;
    selectedDatabaseInstance: string;
    selectedDatabaseInstanceName: string;
    selectedDatabaseStorageType: string;
    cardData: any;
    osConfigTableData: PerConfigInterface[] | null;
    ontapConfigTableData: PerConfigInterface[] | null;
    optimizationBreakDown: {
        storage?: CountBreakDown;
        compute?: CountBreakDown;
        application?: CountBreakDown;
        total?: CountBreakDown;
    } | null;
    gwRefreshPage: boolean;
    gwTimestamp: string;
    optimizingData: any;
    optimizingInstanceData: boolean;
    selectedRecommendedInstance: any;
    credIdFromJM: string;
    regionFromJM: string;
    landingFrom: string;
    inProgressOptimizationData: any;
    inProgressHostData: any;
    jobToInstanceMap: any;
    jobToInstanceMapForBulk: any;
    recommendedInstanceInBulk?: any;
}

interface CountBreakDown {
    total?: number;
    optimized?: number;
    notOptimized?: number;
    percent?: number;
}

export interface AssessmentResponseInterface {
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
    license?: PerConfigInterface;
    hostOsPatch?: PerConfigInterface;
    mssqlPatch?: PerConfigInterface;
    maxDOP?: PerConfigInterface;
}

export interface HostAssessmentResponseInterface {
    databaseInstanceId: string;
    assessments?: AssessmentResponseInterface;
    error?: string;
}

export interface RSSConfigAdapterInterface {
    adapterName?: string;
    rssProfile?: string;
    rssEnabled?: boolean;
    baseProcessorNumber?: string;
    numberOfReceiveQueues?: string;
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
    ec2InstancesToPatch?: Array<{
        baselineId?: string;
        criticalNonCompliantCount?: number;
        ec2InstanceId?: string;
        operationStartTime?: number;
        operationEndTime?: number;
        securityNonCompliantCount?: number;
        otherNonCompliantCount?: number;
    }>;
    missingPatchesInEc2Instances?: Array<{
        ec2InstanceId?: string;
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

export interface PerDriveObjInterface {
    databaseName?: string;
    logDriveLetter?: string;
    dataDriveLetter?: string;
    logDrivePercent?: number;
    logDriveTotalSizeMB?: number;
    dataDriveTotalSizeMB?: number;
}

export interface GwCardDataInterface {
    [key: string]: GwPerConfigCardInterface;
}

export interface GwPerConfigCardInterface {
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
    recommendation?: {
        title: string;
        description?: string;
        values?: string[] | undefined;
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

export interface GwSqlServerInstanceInterface {
    sqlServerInstance: string;
    sqlServerState?: string;
    sqlServerVersion?: string;
    sqlServerProductYear?: number;
    sqlServerEdition: string;
    sqlServerEngineEdition?: number;
    sqlServerName?: string;
}
