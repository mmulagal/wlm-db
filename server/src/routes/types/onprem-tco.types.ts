import { Static, TSchema, Type } from '@fastify/type-provider-typebox';
import {
    StorageSavingsCalculationsMetricsResponse,
    StorageSavingsRequestBody,
    StorageSavingsResponse,
    BulkStorageSavingsCalculationsMetricsResponse,
    BulkStorageSavingsResponse
} from './storage-savings.types';
import { NETWORK_PERF } from '../../utils/continous-optimization-consts';

const UploadMetricsFileBody = Type.Object({
    fileName: Type.String(),
    fileContent: Type.String()
});

const OnPremTcoResourceObject = Type.Object({
    resourceId: Type.String(),
    resourceName: Type.String(),
    deploymentModel: Type.String(),
    creationTime: Type.Number()
});

const DatabaseInstanceRequestBase = Type.Object({
    noOfVcpusInUse: Type.Number({ description: 'Number of vCPUs actually in use' }),
    memory: Type.Number({ description: 'Memory in bytes' }),
    networkPerformance: Type.String({ enum: [NETWORK_PERF.UP_TO_10, NETWORK_PERF.ABOVE_10] }),
    totalIops: Type.Optional(Type.Number({ description: 'Total IOPS' })),
    totalThroughput: Type.Optional(Type.Number({ description: 'Throughput in mbps' })),
    totalStorage: Type.Optional(Type.Number({ description: 'Storage in bytes' }))
});

const SqlInstanceDetailsRequestObject = Type.Intersect([
    Type.Object({ sqlInstanceId: Type.String() }),
    DatabaseInstanceRequestBase
]);

type SqlInstanceDetailsRequestObjectType = Static<typeof SqlInstanceDetailsRequestObject>;

const SqlInstanceDetailsResponseObject = Type.Union([
    Type.Intersect([
        SqlInstanceDetailsRequestObject,
        Type.Object({
            sqlInstanceName: Type.String(),
            noOfDatabases: Type.Number(),
            sqlEdition: Type.String(),
            sqlVersion: Type.String(),
            totalStorage: Type.Optional(Type.Number()),
            isReadReplica: Type.Optional(Type.Boolean())
        })
    ]),
    Type.Object({
        sqlInstanceId: Type.Optional(Type.String()),
        sqlInstanceName: Type.Optional(Type.String()),
        errorMessage: Type.Optional(Type.String())
    })
]);

const OnPremTcoExploreSavingsRequestBody = Type.Object({
    regionCode: Type.String(),
    sqlInstanceData: Type.Optional(Type.Array(SqlInstanceDetailsRequestObject)),
    snapshotInfo: Type.Optional(StorageSavingsRequestBody)
});

const BulkResources = Type.Object({
    resourceId: Type.String(),
    sqlInstanceData: Type.Optional(Type.Array(SqlInstanceDetailsRequestObject))
});

const BulkOnPremTcoExploreSavingsRequestBody = Type.Object({
    regionCode: Type.String(),
    resources: Type.Array(BulkResources, {
        description: 'List of resources with their SQL instance details',
        minItems: 1,
        maxItems: 5
    }),
    snapshotInfo: Type.Optional(StorageSavingsRequestBody)
});

const BulkTcoExploreSavingsResponse = Type.Object({
    region: Type.String(),
    regionCode: Type.String(),
    calculations: BulkStorageSavingsCalculationsMetricsResponse,
    storageSavings: BulkStorageSavingsResponse
});

type BulkResourcesType = Static<typeof BulkResources>;

const OnPremTcoExploreSavingsResponse = Type.Intersect([
    OnPremTcoResourceObject,
    Type.Object({
        region: Type.String(),
        regionCode: Type.String(),
        calculations: StorageSavingsCalculationsMetricsResponse,
        storageSavings: StorageSavingsResponse
    })
]);

const OnPremDatabaseResourceObject = Type.Intersect([
    OnPremTcoResourceObject,
    Type.Object({
        sqlServerInstances: Type.Array(SqlInstanceDetailsResponseObject),
        onPremisesNodes: Type.Array(Type.String()),
        totalAllocatedCapacity: Type.Optional(Type.String()) // in bytes, as string
    })
]);

type OnPremDatabaseResourcesObjectType = Static<typeof OnPremDatabaseResourceObject>;

function createDatabaseResourcesResponse(itemSchema: TSchema) {
    return Type.Object({
        count: Type.Number(),
        items: Type.Array(itemSchema),
        nextToken: Type.Optional(Type.String())
    });
}

const OnPremDatabaseResourcesResponse = createDatabaseResourcesResponse(OnPremDatabaseResourceObject);

const OracleDatabaseDetailsRequestObject = Type.Intersect([
    Type.Object({ databaseId: Type.String({ description: 'Oracle database ID (DBID) or unique identifier' }) }),
    DatabaseInstanceRequestBase
]);

type OracleDatabaseDetailsRequestObjectType = Static<typeof OracleDatabaseDetailsRequestObject>;

const OracleDatabaseDetailsResponseObject = Type.Object({
    databaseId: Type.String(),
    databaseName: Type.String(),
    sid: Type.String(),
    oracleVersion: Type.String(),
    oracleEdition: Type.String(),
    deploymentModel: Type.String({ enum: ['Standalone', 'DG'] }),
    isRacEnabled: Type.Boolean(),
    isDataGuardEnabled: Type.Boolean(),
    databaseRole: Type.String(),
    isCDB: Type.Boolean(),
    vCPUs: Type.Number(),
    pdbCount: Type.Number(),
    totalIops: Type.Optional(Type.Number()),
    totalThroughput: Type.Optional(Type.Number({ description: 'Throughput in MB/s' })),
    totalStorage: Type.Optional(Type.Number({ description: 'Storage in bytes' })),
    memory: Type.Optional(Type.Number({ description: 'Oracle memory (SGA + PGA) in bytes' })),
    networkPerformance: Type.Optional(Type.String({ enum: [NETWORK_PERF.UP_TO_10, NETWORK_PERF.ABOVE_10] })),
    errorMessage: Type.Optional(Type.String())
});

type OracleDatabaseDetailsResponseObjectType = Static<typeof OracleDatabaseDetailsResponseObject>;

const OracleDatabaseResourceObject = Type.Intersect([
    OnPremTcoResourceObject,
    Type.Object({
        oracleDatabases: Type.Array(OracleDatabaseDetailsResponseObject),
        hostInfo: Type.Object({
            hostname: Type.String(),
            cpuCount: Type.Number(),
            totalRamGB: Type.Number(),
            storageProtocol: Type.String()
        }),
        totalAllocatedCapacityGB: Type.Optional(Type.Number()),
        onPremisesNodes: Type.Array(Type.String())
    })
]);

type OracleDatabaseResourceObjectType = Static<typeof OracleDatabaseResourceObject>;

const OracleDatabaseResourcesResponse = createDatabaseResourcesResponse(OracleDatabaseResourceObject);

const BulkOracleResources = Type.Object({
    resourceId: Type.String(),
    databaseData: Type.Optional(Type.Array(OracleDatabaseDetailsRequestObject)),
    monthlyByolCost: Type.Optional(
        Type.Number({
            description: 'Monthly BYOL license cost for this Oracle resource. Defaults to 0 if not provided.'
        })
    )
});

type BulkOracleResourcesType = Static<typeof BulkOracleResources>;

const BulkOracleTcoExploreSavingsRequestBody = Type.Object({
    regionCode: Type.String(),
    resources: Type.Array(BulkOracleResources, {
        description: 'List of Oracle resources with their instance details',
        minItems: 1,
        maxItems: 5
    }),
    snapshotInfo: Type.Optional(StorageSavingsRequestBody)
});

export {
    UploadMetricsFileBody,
    OnPremTcoResourceObject,
    OnPremDatabaseResourcesResponse,
    OnPremTcoExploreSavingsRequestBody,
    OnPremTcoExploreSavingsResponse,
    SqlInstanceDetailsRequestObjectType,
    OnPremDatabaseResourceObject,
    OnPremDatabaseResourcesObjectType,
    BulkOnPremTcoExploreSavingsRequestBody,
    BulkTcoExploreSavingsResponse,
    BulkResourcesType,
    OracleDatabaseDetailsRequestObject,
    OracleDatabaseDetailsRequestObjectType,
    OracleDatabaseDetailsResponseObject,
    OracleDatabaseDetailsResponseObjectType,
    OracleDatabaseResourceObject,
    OracleDatabaseResourceObjectType,
    OracleDatabaseResourcesResponse,
    BulkOracleResources,
    BulkOracleResourcesType,
    BulkOracleTcoExploreSavingsRequestBody
};
