import { Type } from '@fastify/type-provider-typebox';

const databaseParams = Type.Object({
    accountId: Type.String(),
    resourceId: Type.String()
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

const ServerSummaryResponse = Type.Object({
    serverId: Type.String(),
    serverVersion: Type.String(),
    serverEdition: Type.String(),
    serverEngine: Type.String(),
    serverStatus: Type.String(),
    activeConnections: Type.Integer(),
    databasesCount: Type.Integer(),
    databaseTotalSize: Type.String()
});

const UtilisationResponseBody = Type.Object({
    percentUsed: Type.String(),
    used: Type.String(),
    total: Type.String(),
    remaining: Type.String()
});

export { databaseParams, DatabasesResponseBody, UtilisationResponseBody, ServerSummaryResponse };
