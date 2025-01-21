import { Static, Type } from '@fastify/type-provider-typebox';

const UploadMetricsFileBody = Type.Object({
    fileName: Type.String(),
    fileContent: Type.String()
});

const OnPremDatabaseResourceParams = Type.Object({
    resourceId: Type.String(),
    resourceName: Type.String(),
    deploymentModel: Type.String(),
    sqlServerInstances: Type.Array(Type.String()),
    onPremisesNodes: Type.Array(Type.String())
});

type OnPremDatabaseResourcesParamsType = Static<typeof OnPremDatabaseResourceParams>;

const OnPremDatabaseResourcesResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(OnPremDatabaseResourceParams),
    nextToken: Type.Optional(Type.String())
});

export { UploadMetricsFileBody, OnPremDatabaseResourcesResponse, OnPremDatabaseResourcesParamsType };
