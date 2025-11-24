export interface BulkAuthCredentials {
    [hostName: string]: {
        userName: string;
        password: string;
    };
}

export interface BulkAuthStatus {
    [hostName: string]: 'success' | 'in-progress' | 'failure' | null;
}

export interface ExploreSavingsBulkSliceEntities {
    selectedRowsForExploreSavingsEBSBulk: Array<string> | any;
    ebsTCOAction: string;
    selectedAddHostRows: Array<string> | any;
    bulkAuthCredentials: BulkAuthCredentials;
    rowsRequiringAuthBulk?: Array<any> | any;
    bulkAuthStatus?: BulkAuthStatus;
    triggerBulkDataFetch?: boolean;
}
