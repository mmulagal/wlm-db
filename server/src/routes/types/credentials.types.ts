import { Static, Type } from '@fastify/type-provider-typebox';
import { ACCOUNT_ID_DESC } from '../../utils/schema-description-consts';

const CredentialsResponse = Type.Array(
    Type.Object({
        credentialsId: Type.String({ format: 'uuid' }),
        name: Type.String(),
        arn: Type.String(),
        providerAccountId: Type.String()
    })
);
type CredentialsResponseType = Static<typeof CredentialsResponse>;

const CredentialsListParams = Type.Object({
    accountId: Type.String({ description: ACCOUNT_ID_DESC, minLength: 1 }),
    credentialsType: Type.String({ enum: ['aws_assume_role'] })
});
type CredentialsListParamsType = Static<typeof CredentialsListParams>;

export { CredentialsResponse, CredentialsResponseType, CredentialsListParams, CredentialsListParamsType };
