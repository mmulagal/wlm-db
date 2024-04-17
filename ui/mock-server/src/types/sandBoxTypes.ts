export interface Sandboxes {
    count: number;
    items: [
        {
            sandboxName: string;
            databaseHostName: string;
            databaseHostId: string;
            databaseInstanceName: string;
            sourceDatabaseName: string;
            sourceDatabaseHostName: string;
            sourceDatabaseInstanceName: string;
            creationTime: string;
            tag: string;
            error: string;
        }
    ];
    nextToken: string;
}
