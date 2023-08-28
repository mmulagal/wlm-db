import { Type } from '@fastify/type-provider-typebox';

const databaseParams = Type.Object({
    accountId: Type.String(),
    resourceId: Type.String()
});

const msSqlServerDiscoveryParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    regionId: Type.String(),
    ec2InstanceId: Type.String()
});

const msSqlServerDiscoveryResponse = Type.Object({
    resourceId: Type.String(),
    resourceName: Type.String()
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

export {
    databaseParams,
    DatabasesResponseBody,
    UtilisationResponseBody,
    msSqlServerDiscoveryParams,
    msSqlServerDiscoveryResponse
};
