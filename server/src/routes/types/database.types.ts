import { Type } from '@fastify/type-provider-typebox';
import { HEADERS } from '../../utils/consts';

const DatabaseHeaders = Type.Object({
    [HEADERS.WORKSPACE_ID_HEADER]: Type.String({ minLength: 1 })
});

const DatabaseParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    resourceId: Type.String({ minLength: 1 })
});

const Tablesparams = Type.Object({
    accountId: Type.String(),
    resourceId: Type.String(),
    databaseName: Type.String()
});

const MsSqlServerDiscoveryParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    regionId: Type.String()
});

const MsSqlServerDiscoveryResponse = Type.Object({
    resourceId: Type.String(),
    resourceName: Type.String()
});

const MsSqlServerDiscoverRequestBody = Type.Object({
    activeInstanceId: Type.String(),
    standbyInstanceId: Type.String()
});

const DatabasesResponseBody = Type.Object({
    databases: Type.Array(
        Type.Object({
            databaseId: Type.Number(),
            databaseName: Type.String(),
            creationDate: Type.Optional(Type.String()),
            databaseStatus: Type.Optional(Type.String()),
            databaseSize: Type.String()
        })
    )
});

const DatabaseDeleteResponseBody = Type.Object({
    status: Type.Integer(),
    message: Type.Optional(Type.String())
});

const ServerSummaryResponse = Type.Object({
    serverId: Type.String(),
    serverVersion: Type.String(),
    serverEdition: Type.String(),
    serverEngine: Type.String(),
    serverStatus: Type.String(),
    activeConnections: Type.Integer(),
    deploymentModel: Type.String(),
    activeNode: Type.String(),
    standbyNode: Type.String()
});

const UtilisationResponseBody = Type.Object({
    percentUsed: Type.String(),
    used: Type.String(),
    total: Type.String(),
    remaining: Type.String()
});

const TablesResponseBody = Type.Object({
    tables: Type.Array(
        Type.Object({
            tableName: Type.String(),
            databaseName: Type.String(),
            tableType: Type.String(),
            tableSchema: Type.String(),
            tableSize: Type.Number()
        })
    )
});

export {
    DatabaseParams,
    DatabasesResponseBody,
    UtilisationResponseBody,
    ServerSummaryResponse,
    Tablesparams,
    TablesResponseBody,
    DatabaseDeleteResponseBody,
    DatabaseHeaders,
    MsSqlServerDiscoveryParams,
    MsSqlServerDiscoveryResponse,
    MsSqlServerDiscoverRequestBody
};
