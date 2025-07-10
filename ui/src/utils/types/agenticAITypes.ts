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
    investigationDates: Array<{ id: string; reportCreationTime: string }> | [];
    errorInvestigation: {
        errorInvestigationData: Array<ErrorInvestigationGetApiResponse> | [];
        errorInvestigationLoading: boolean;
    };
    eiRefreshTimestamp: string;
    eiRefreshPage: boolean;
    noErrorsDetected: boolean;
    scanInProgress: boolean;
}
