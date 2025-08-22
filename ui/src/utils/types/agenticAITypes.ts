export type TimeRange = {
    from: string;
    fromPeriod: string;
    to: string;
    toPeriod: string;
};

export interface ErrorInvestigationGetApiResponse {
    error: string;
    cause: string;
    count: number;
    remediation: Array<string>;
    severity: string;
    errorCode: string;
    firstOccurrence: number;
    lastOccurrence: number;
    hourlyErrorCounts?: { hour: number; count: number }[];
    totalFilteredCount?: number;
}

export interface AgenticAIEntities {
    selectedSeverity: [] | any;
    selectedTimeFrame: any;
    selectedErrorCodes: [] | any;
    timeRange: TimeRange;
    noData: boolean;
    selectedInvestigationDate: { id: string; value: string; label: string } | null;
    investigationDatesLoading: boolean;
    investigationDates: Array<{ id: string; creationTime: string }> | [];
    errorInvestigation: {
        errorInvestigationData: Array<ErrorInvestigationGetApiResponse> | [];
        errorInvestigationLoading: boolean;
    };
    eiRefreshTimestamp: string;
    eiRefreshPage: boolean;
    noErrorsDetected: boolean;
    scanInProgress: any;
    logAnalyzerState: string;
    logAnalyzerPreReq: {
        data: {
            bedrockPreRequisites: {
                ready: boolean;
                message: string;
            };
            instanceProfilePreRequisites: {
                ready: boolean;
                message: string;
            };
            credentialsPreRequisites: {
                ready: boolean;
                message: string;
            };
            networkingPreRequisites: {
                ready: boolean;
                message: string;
            };
        } | null;
        loading: boolean;
    };
    logAnalyzerPricing: {
        data: {
            costPerError: number;
        } | null;
        loading: boolean;
    };
    agenticRegisterFlowChecks: {
        [key: string]: any;
    };
}

export interface ErrorInvestigationInstance {
    id?: string;
    databaseInstanceId?: string;
    databaseHostId?: string;
    status?: string;
    credentialId?: string;
    regionId?: string;
    latestReport?: {
        creationTime?: number;
        jobId?: string;
        errorCount?: number;
    };
}
