import { Type, Static } from '@fastify/type-provider-typebox';

const GenerateUbrCredentialsBody = Type.Object({
    connectorId: Type.String({ minLength: 1 }),
    ec2InstanceIds: Type.Array(Type.String({ description: 'EC2 instance ID', pattern: '^i-[0-9a-f]{8,17}$' })),
    sqlInstanceName: Type.Optional(Type.String({ description: 'SQL instance name', minLength: 1 })),
    workspaceId: Type.Optional(Type.String({ description: 'Workspace ID', minLength: 1 })),
    resourceId: Type.Optional(Type.String({ description: 'Resource ID', minLength: 1 })),
    organizationId: Type.Optional(Type.String({ description: 'Organization ID', minLength: 1 }))
});

const GenerateUbrCredentialsResponse = Type.Object({
    credentialsId: Type.Optional(Type.String()),
    errorMessage: Type.Optional(Type.String())
});

type GenerateUbrCredentialsBodyType = Static<typeof GenerateUbrCredentialsBody>;
type GenerateUbrCredentialsResponseType = Static<typeof GenerateUbrCredentialsResponse>;

export {
    GenerateUbrCredentialsBody,
    GenerateUbrCredentialsResponse,
    GenerateUbrCredentialsBodyType,
    GenerateUbrCredentialsResponseType
};
