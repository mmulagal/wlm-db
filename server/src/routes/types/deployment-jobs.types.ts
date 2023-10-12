import { Static, Type } from '@fastify/type-provider-typebox';

const DeploymentJobsObjectParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    duration: Type.Number({ minimum: 1, maximum: 90 })
});
type DeploymentJobsObjectParamsType = Static<typeof DeploymentJobsObjectParams>;

const DeploymentJobsResponse = Type.Object({
    success: Type.Number(),
    initializing: Type.Number(),
    failed: Type.Number()
});
type DeploymentJobsResponseResponseType = Static<typeof DeploymentJobsResponse>;

export {
    DeploymentJobsObjectParams,
    DeploymentJobsObjectParamsType,
    DeploymentJobsResponse,
    DeploymentJobsResponseResponseType
};
