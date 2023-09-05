export interface SummaryRes {
    serverId: string;
    serverVersion: string;
    serverStatus: string;
    serverEdition: string;
    serverEngine: string;
    activeConnections: number;
    deploymentModel: string;
    primaryNode: string;
    standbyNode: string;
    activeNode: string;
}

export interface CpuUtilisation {
    percentUsed: string;
    used: string;
    total: string;
    remaining: string;
}

export interface DiskUtilisation {
    percentUsed: string;
    used: string;
    total: string;
    remaining: string;
}

export interface MemoryUtilisation {
    percentUsed: string;
    used: string;
    total: string;
    remaining: string;
}

export interface Databases {
    databases: [
        {
            databaseId: string;
            databaseName: string;
            creationDate: number;
            databaseStatus: string;
            databaseSize: number;
        }
    ];
}

export interface Tables {
    tables: [
        {
            tableName: string;
            databaseName: string;
            tableType: string;
            tableSchema: string;
            tableSize: string;
        }
    ];
}

export interface BatchTables {
    data: {
        tables: [
            {
                tableName: string;
                databaseName: string;
                tableType: string;
                tableSchema: string;
                tableSize: string;
            }
        ];
    };
}
