import { Type } from '@fastify/type-provider-typebox';

const mssqlparams = Type.Object({
    accountId: Type.String(),
    workspacePublicId: Type.String(),
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
export { mssqlparams, DatabasesResponseBody };
