import { Type } from '@fastify/type-provider-typebox';

const databaseParams = Type.Object({
    accountId: Type.String(),
    resourceId: Type.String()
});

const tablesparams = Type.Object({
    accountId: Type.String(),
    resourceId: Type.String(),
    databaseName: Type.String()
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

export { databaseParams, DatabasesResponseBody, UtilisationResponseBody, tablesparams, TablesResponseBody };
