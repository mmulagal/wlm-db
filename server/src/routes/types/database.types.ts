import { Static, Type } from '@fastify/type-provider-typebox';
import { HEADERS } from '../../utils/consts';

const DatabaseHeaders = Type.Object({
    [HEADERS.WORKSPACE_ID_HEADER]: Type.Optional(Type.String({ minLength: 1 }))
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
    region: Type.String()
});

const MsSqlServerDiscoveryResponse = Type.Object({
    resourceId: Type.String(),
    resourceName: Type.String()
});

const MsSqlServerDiscoverRequestBody = Type.Object({
    activeNodeInstanceId: Type.String(),
    standbyNodeInstanceId: Type.Optional(Type.String()),
    activeNodeInstanceName: Type.String(),
    standbyNodeInstanceName: Type.Optional(Type.String()),
    fsxId: Type.String()
});

const DiscoverMsSqlParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String()
});

const DiscoverMsSqlQuery = Type.Object({
    nextToken: Type.Optional(Type.String())
});

const DiscoverMsSqlResponseBody = Type.Object({
    count: Type.Number(),

    items: Type.Array(
        Type.Object({
            instanceId: Type.String(),
            instanceName: Type.Optional(Type.String()),
            ssmState: Type.String(),
            sqlServerInstances: Type.Array(
                Type.Object({
                    sqlServerEdition: Type.Number(),
                    sqlServerInstance: Type.String(),
                    sqlServerState: Type.String(),
                    sqlServerVersion: Type.String(),
                    windowsAuthentication: Type.Boolean()
                })
            )
        })
    ),
    nextToken: Type.Optional(Type.String())
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
    message: Type.String()
});

const ServerSummaryResponse = Type.Object({
    serverId: Type.String(),
    serverVersion: Type.String(),
    serverEdition: Type.String(),
    serverEngine: Type.Optional(Type.String()),
    serverStatus: Type.String(),
    activeConnections: Type.Integer(),
    deploymentModel: Type.String(),
    clusterName: Type.Optional(Type.String()),
    activeNode: Type.String(),
    standbyNode: Type.Optional(Type.String())
});

const UtilisationResponseBody = Type.Object({
    percentUsed: Type.String(),
    used: Type.String(),
    total: Type.String(),
    remaining: Type.String()
});

type UtilisationResponseBodyInterface = Static<typeof UtilisationResponseBody>;

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
    UtilisationResponseBodyInterface,
    ServerSummaryResponse,
    Tablesparams,
    TablesResponseBody,
    DatabaseDeleteResponseBody,
    DatabaseHeaders,
    MsSqlServerDiscoveryParams,
    MsSqlServerDiscoveryResponse,
    MsSqlServerDiscoverRequestBody,
    DiscoverMsSqlParams,
    DiscoverMsSqlQuery,
    DiscoverMsSqlResponseBody
};
