const oracleCollectionObjectSchema = {
    type: 'object',
    required: ['scriptInfo', 'hostInfo', 'databases'],
    properties: {
        scriptInfo: { type: 'object' },
        hostInfo: { type: 'object' },
        databases: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                required: ['databaseInfo', 'performanceSummary', 'storageInfo', 'performanceSnapshots'],
                properties: {
                    databaseInfo: { type: 'object' },
                    performanceSummary: { type: 'object' },
                    storageInfo: { type: 'object' },
                    performanceSnapshots: { type: 'array', minItems: 1 }
                }
            }
        }
    }
} as const;

const oracleHostInfoSchema = {
    type: 'object',
    required: ['hostname', 'cpuCount', 'totalRamBytes'],
    properties: {
        hostname: { type: 'string', minLength: 1 },
        cpuCount: { type: 'number', exclusiveMinimum: 0 },
        totalRamBytes: { type: 'number', exclusiveMinimum: 0 }
    }
} as const;

const mssqlCollectionObjectSchema = {
    type: 'object',
    required: ['windowsConfig', 'sqlServerInfo', 'scriptVersion', 'timestamp'],
    properties: {
        windowsConfig: { type: 'object' },
        sqlServerInfo: { type: 'array', minItems: 1 },
        scriptVersion: { type: 'string', minLength: 1 },
        timestamp: { type: 'string', minLength: 1 }
    }
} as const;

const windowsConfigSchema = {
    type: 'object',
    required: ['windowsSystemName', 'nodeDetails'],
    properties: {
        windowsSystemName: { type: 'string', minLength: 1 },
        nodeDetails: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                required: ['hostId', 'numberOfVcpus', 'ramSize'],
                properties: {
                    hostId: { type: 'string', minLength: 1 },
                    numberOfVcpus: { type: 'number', exclusiveMinimum: 0 },
                    ramSize: { type: 'number', exclusiveMinimum: 0 }
                }
            }
        }
    }
} as const;

export { oracleCollectionObjectSchema, oracleHostInfoSchema, mssqlCollectionObjectSchema, windowsConfigSchema };
