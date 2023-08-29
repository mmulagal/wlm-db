import { Type } from '@fastify/type-provider-typebox';
import { HEADERS } from '../../utils/consts';

const DatabaseHeaders = Type.Object({
    [HEADERS.WORKSPACE_ID]: Type.String({ minLength: 1 })
});

const DatabaseParams = Type.Object({
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

const DatabaseDeleteResponseBody = Type.Object({
    status: Type.Integer(),
    reason: Type.Optional(Type.String())
});

const UtilisationResponseBody = Type.Object({
    percentUsed: Type.String(),
    used: Type.String(),
    total: Type.String(),
    remaining: Type.String()
});

export { DatabaseParams, DatabasesResponseBody, UtilisationResponseBody, DatabaseDeleteResponseBody, DatabaseHeaders };
