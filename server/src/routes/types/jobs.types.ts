import { Static, Type } from '@fastify/type-provider-typebox';

const DeploymentJobsResponse = Type.Object({
    success: Type.Number(),
    initializing: Type.Number(),
    failed: Type.Number()
});
type DeploymentJobsResponseResponseType = Static<typeof DeploymentJobsResponse>;

const DeploymentJobsQueryString = Type.Object({
    duration: Type.Optional(Type.Number())
});

export { DeploymentJobsResponse, DeploymentJobsResponseResponseType, DeploymentJobsQueryString };
