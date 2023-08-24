import { Type } from '@fastify/type-provider-typebox';

const databaseParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    resourceId: Type.String({ minLength: 1 })
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

export { databaseParams, DatabasesResponseBody, UtilisationResponseBody };
