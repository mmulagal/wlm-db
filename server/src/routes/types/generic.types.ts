import { Static, Type } from '@fastify/type-provider-typebox';
import { HEADERS } from '../../utils/consts';

const GenericHeaders = Type.Object({
    [HEADERS.WORKSPACE_ID_HEADER]: Type.Optional(Type.String())
});
type GenericHeadersType = Static<typeof GenericHeaders>;

const AccountIdParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});

const ManagedHostParams = Type.Object({
    accountId: Type.String(),
    credentialsId: Type.String(),
    region: Type.String()
});
type AccountIdParamsType = Static<typeof AccountIdParams>;

export { GenericHeaders, GenericHeadersType, AccountIdParams, AccountIdParamsType, ManagedHostParams };
