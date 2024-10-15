export interface GetWellSliceInterface {
    optimizePageLoading: boolean;
    driftAssessmentData: any;
    selectedHostname: string;
    selectedResourceId: string;
    selectedDatabaseInstance: string;
    selectedDatabaseInstanceName: string;
    cardData: any;
    osConfigTableData: any;
    ontapConfigTableData: any;
    optimizationBreakDown: {
        storage?: CountBreakDown;
        total?: CountBreakDown;
    } | null;
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
}

export interface PerConfigInterface {
    name?: string;
    status?: string;
    current?: string;
    recommended?: string;
    severity?: string;
    recommendation?: string;
    tags?: string[];
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
    };
    block_four: {
        type: string;
        value: string;
        smallFont?: boolean;
    };
    recommendation?: {
        title: string;
        description: string;
        values?: string[];
    };
    tags: string[];
}
