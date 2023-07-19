import { Static, Type } from '@sinclair/typebox';

export const CredentialsResponse = Type.Array(
    Type.Object({
      credentialsId: Type.String(),
      name: Type.String(),
      arn: Type.String(),
    })
  );
export type CredentialsResponseType = Static<typeof CredentialsResponse>;