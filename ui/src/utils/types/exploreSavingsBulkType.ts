export interface BulkAuthCredentials {
    [hostName: string]: {
        userName: string;
        password: string;
    };
}

export interface ExploreSavingsBulkSliceEntities {
    selectedRowsForExploreSavingsEBSBulk: Array<string> | any;
    ebsTCOAction: string;
    selectedAddHostRows: Array<string> | any;
    bulkAuthCredentials: BulkAuthCredentials;
    rowsRequiringAuthBulk?: Array<any> | any;
}
