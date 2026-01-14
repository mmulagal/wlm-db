import { Static, Type } from '@fastify/type-provider-typebox';
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

const SqlInstanceDetailsRequestObject = Type.Object({
    sqlInstanceId: Type.String(),
    noOfVcpusInUse: Type.Number(),
    memory: Type.Number(),
    networkPerformance: Type.String({ enum: [NETWORK_PERF.UP_TO_10, NETWORK_PERF.ABOVE_10] }),
    totalIops: Type.Optional(Type.Number()),
    totalThroughput: Type.Optional(Type.Number({ description: 'Throughput in mbps' })),
    totalStorage: Type.Optional(Type.Number({ description: 'Storage in bytes' }))
});

type SqlInstanceDetailsRequestObjectType = Static<typeof SqlInstanceDetailsRequestObject>;

const SqlInstanceDetailsResponseObject = Type.Union([
    Type.Composite([
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

const OnPremDatabaseResources = Type.Object({
    resourceId: Type.String(),
    resourceName: Type.String(),
    deploymentModel: Type.String(),
    sqlInstanceDetails: Type.Array(SqlInstanceDetailsResponseObject),
    onPremisesNodes: Type.Array(Type.String())
});

type OnPremDatabaseResourcesType = Static<typeof OnPremDatabaseResources>;

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
        minimum: 1,
        maximum: 5
    }),
    snapshotInfo: Type.Optional(StorageSavingsRequestBody)
});

const BulkOnPremTcoExploreSavingsResponse = Type.Object({
    region: Type.String(),
    regionCode: Type.String(),
    calculations: BulkStorageSavingsCalculationsMetricsResponse,
    storageSavings: BulkStorageSavingsResponse
});

type BulkResourcesType = Static<typeof BulkResources>;

const OnPremTcoResourceObject = Type.Object({
    resourceId: Type.String(),
    resourceName: Type.String(),
    deploymentModel: Type.String(),
    creationTime: Type.Number()
});

const OnPremTcoExploreSavingsResponse = Type.Composite([
    OnPremTcoResourceObject,
    Type.Object({
        region: Type.String(),
        regionCode: Type.String(),
        calculations: StorageSavingsCalculationsMetricsResponse,
        storageSavings: StorageSavingsResponse
    })
]);

const OnPremDatabaseResourceObject = Type.Composite([
    OnPremTcoResourceObject,
    Type.Object({
        sqlServerInstances: Type.Array(SqlInstanceDetailsResponseObject),
        onPremisesNodes: Type.Array(Type.String()),
        totalAllocatedCapacity: Type.Optional(Type.String()) // in bytes, as string
    })
]);

type OnPremDatabaseResourcesObjectType = Static<typeof OnPremDatabaseResourceObject>;

const OnPremDatabaseResourcesResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(OnPremDatabaseResourceObject),
    nextToken: Type.Optional(Type.String())
});

export {
    UploadMetricsFileBody,
    OnPremDatabaseResourcesResponse,
    OnPremDatabaseResourcesType,
    OnPremTcoExploreSavingsRequestBody,
    OnPremTcoExploreSavingsResponse,
    SqlInstanceDetailsRequestObjectType,
    OnPremDatabaseResourceObject,
    OnPremDatabaseResourcesObjectType,
    BulkOnPremTcoExploreSavingsRequestBody,
    BulkOnPremTcoExploreSavingsResponse,
    BulkResourcesType
};
