export interface BulkAuthCredentials {
    [hostName: string]: {
        userName: string;
        password: string;
        ssmParameterArn?: string;
    };
}

export interface BulkAuthStatus {
    [hostName: string]: 'success' | 'in-progress' | 'failure' | null;
}

export interface ExploreSavingsBulkSliceEntities {
    selectedRowsForExploreSavingsEBSBulk: Array<string> | any;
    selectedRowsForExploreSavingsOnPremBulk: Array<string> | any;
    selectedRowsForExploreSavingsOracleOnPremBulk: Array<any>;
    selectedRowsForExploreSavingsOracleEbsBulk: Array<any>;
    ebsTCOAction: string;
    bulkAuthCredentials: BulkAuthCredentials;
    rowsRequiringAuthBulk?: Array<any> | any;
    bulkAuthStatus?: BulkAuthStatus;
    triggerBulkDataFetch?: boolean;
}
