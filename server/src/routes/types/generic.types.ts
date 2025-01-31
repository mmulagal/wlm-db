import { Static, Type } from '@fastify/type-provider-typebox';
import { HEADERS } from '../../utils/consts';

const GenericHeaders = Type.Object({
    [HEADERS.WORKSPACE_ID_HEADER]: Type.Optional(Type.String())
});
type GenericHeadersType = Static<typeof GenericHeaders>;

const AccountIdParams = Type.Object({
    accountId: Type.String({ description: 'Workload Factory account ID.', minLength: 1 })
});

const AccountIdRegionParams = Type.Object({
    accountId: Type.String({ description: 'Workload Factory account ID.', minLength: 1 }),
    region: Type.String({ description: 'AWS region hosting EC2 instances', minLength: 1 })
});

const AccountIdCredentialsIdParams = Type.Object({
    accountId: Type.String({ description: 'Workload Factory account ID.', minLength: 1 }),
    credentialsId: Type.String({ description: 'Workload Factory credentials ID', minLength: 1, format: 'uuid' })
});

const CredentialsIdParams = Type.Object({
    accountId: Type.String({ description: 'Workload Factory account ID', minLength: 1 }),
    credentialsId: Type.String({ description: 'Workload Factory credentials ID', minLength: 1, format: 'uuid' }),
    region: Type.String({ description: 'AWS region hosting EC2 instances', minLength: 1 })
});

const RegionDetails = Type.Object({
    code: Type.Optional(Type.String({ description: 'Region code for AWS region', minLength: 1 })),
    name: Type.Optional(Type.String({ description: 'Region name for AWS region' }))
});
type RegionDetailsType = Static<typeof RegionDetails>;

const CredentialsIdRegionQueryParams = Type.Object({
    credentialsId: Type.Optional(Type.String()),
    region: Type.Optional(Type.String())
});

const CredentialsIdRegionParams = Type.Object({
    credentialsId: Type.Optional(Type.String()),
    region: RegionDetails
});

type AccountIdParamsType = Static<typeof AccountIdParams>;

const NextTokenQueryString = Type.Object({
    nextToken: Type.Optional(Type.String()),
    pageSize: Type.Optional(Type.Integer())
});

export {
    GenericHeaders,
    GenericHeadersType,
    AccountIdParams,
    AccountIdRegionParams,
    AccountIdCredentialsIdParams,
    AccountIdParamsType,
    RegionDetails,
    RegionDetailsType,
    CredentialsIdParams,
    CredentialsIdRegionParams,
    CredentialsIdRegionQueryParams,
    NextTokenQueryString
};
