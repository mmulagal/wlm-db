import { Static, Type } from '@fastify/type-provider-typebox';
import { HEADERS } from '../../utils/consts';

const GenericHeaders = Type.Object({
    [HEADERS.WORKSPACE_ID_HEADER]: Type.Optional(Type.String())
});
type GenericHeadersType = Static<typeof GenericHeaders>;

const AccountIdParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});

const CredentialsIdParams = Type.Object({
    accountId: Type.String({ description: 'Workload Factory account ID', minLength: 1 }),
    credentialsId: Type.String({ description: 'Workload Factory credentials ID', minLength: 1 }),
    region: Type.String({ description: 'AWS region hosting EC2 instances', minLength: 1 })
});

type AccountIdParamsType = Static<typeof AccountIdParams>;

export { GenericHeaders, GenericHeadersType, AccountIdParams, AccountIdParamsType, CredentialsIdParams };
