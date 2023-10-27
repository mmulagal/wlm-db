import { Static, Type } from '@fastify/type-provider-typebox';

const DeploymentJobsCountQueryString = Type.Object({
    duration: Type.Optional(Type.Number())
});

const DeploymentJobsSummaryQueryString = Type.Object({
    statuses: Type.Optional(Type.String())
});

const DeploymentJobsSummaryResponse = Type.Object({
    id: Type.String(),
    name: Type.Optional(Type.String()),
    status: Type.String(),
    metadata: Type.Object({
        region: Type.Optional(Type.String()),
        serverType: Type.Optional(Type.String()),
        serverInstallationMode: Type.Optional(Type.String()),
        fileSystemType: Type.Optional(Type.String())
    })
});

type DeploymentJobsSummaryResponseType = Static<typeof DeploymentJobsSummaryResponse>;

const DeploymentJobsSummaryListResponse = Type.Object({
    count: Type.Number(),
    items: Type.Array(DeploymentJobsSummaryResponse),
    nextToken: Type.String()
});

type DeploymentJobsSummaryListResponseType = Static<typeof DeploymentJobsSummaryListResponse>;

const DeploymentJobsCountResponse = Type.Object({
    success: Type.Number(),
    initializing: Type.Number(),
    failed: Type.Number()
});

type DeploymentJobsCountResponseType = Static<typeof DeploymentJobsCountResponse>;

export {
    DeploymentJobsCountResponse,
    DeploymentJobsCountResponseType,
    DeploymentJobsCountQueryString,
    DeploymentJobsSummaryQueryString,
    DeploymentJobsSummaryListResponse,
    DeploymentJobsSummaryResponseType,
    DeploymentJobsSummaryListResponseType
};
