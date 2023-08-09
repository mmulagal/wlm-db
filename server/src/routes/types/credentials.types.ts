import { Static, Type } from '@fastify/type-provider-typebox';

const CredentialsResponse = Type.Array(
    Type.Object({
        credentialsId: Type.String(),
        name: Type.String(),
        arn: Type.String(),
        providerAccountId: Type.String()
    })
);
type CredentialsResponseType = Static<typeof CredentialsResponse>;

const CredentialsListParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    credentialsType: Type.String({ minLength: 1 })
});
type CredentialsListParamsType = Static<typeof CredentialsListParams>;

export { CredentialsResponse, CredentialsResponseType, CredentialsListParams, CredentialsListParamsType };
