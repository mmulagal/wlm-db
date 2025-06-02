export interface DatabaseTables {
    tableName?: string;
    databaseName?: string;
    tableType?: string;
    tableSchema?: string;
    tableSize?: string;
}

export interface Database {
    databaseId: string;
    databaseName: string;
    creationDate: number;
    databaseStatus: string;
    databaseSize: number;
}

export interface BatchEntry {
    method: Method;
    url: string;
    headers?: any;
    payload?: any;
    inputs?: any;
    key?: string;
}

export enum Method {
    GET = 'GET',
    POST = 'POST'
}

export interface ResourceEntities {
    tables: DatabaseTables[];
    ready: boolean;
}
