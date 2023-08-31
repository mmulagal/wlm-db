import { Type } from '@fastify/type-provider-typebox';
import { HEADERS } from '../../utils/consts';

const WorkinEnvironmentHeaders = Type.Object({
    [HEADERS.WORKSPACE_ID]: Type.String({ minLength: 1 })
});

const AccountIdParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});

const AccountIdAndWorkingEnvironmentIdParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    workingEnvironmentId: Type.String({ minLength: 1 })
});

const WorkingEnvironmentsResponse = Type.Object({
    workingEnvironments: Type.Optional(
        Type.Array(
            Type.Object({
                id: Type.Optional(Type.String()),
                name: Type.Optional(Type.String()),
                provider: Type.Optional(Type.String()),
                deploymentState: Type.Optional(Type.String())
            })
        )
    )
});

const WorkingEnvironmentResponse = Type.Optional(
    Type.Object({
        id: Type.Optional(Type.String()),
        serverName: Type.Optional(Type.String()),
        databasesCount: Type.Optional(Type.Number()),
        domain: Type.Optional(Type.String()),
        location: Type.Optional(Type.String()),
        deploymentState: Type.Optional(Type.String())
    })
);

export {
    WorkingEnvironmentsResponse,
    WorkingEnvironmentResponse,
    WorkinEnvironmentHeaders,
    AccountIdParams,
    AccountIdAndWorkingEnvironmentIdParams
};
