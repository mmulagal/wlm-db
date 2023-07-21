import { Static, Type } from '@sinclair/typebox';

const CredentialsResponse = Type.Array(
    Type.Object({
      credentialsId: Type.String(),
      name: Type.String(),
      arn: Type.String(),
      providerAccountId:  Type.String(),
    })
  );
type CredentialsResponseType = Static<typeof CredentialsResponse>;

export { CredentialsResponse, CredentialsResponseType };