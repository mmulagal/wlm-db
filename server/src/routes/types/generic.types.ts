import { Static, Type } from '@fastify/type-provider-typebox';
import { AWS_REGION_KEYS, HEADERS } from '../../utils/consts';
import {
    ACCOUNT_ID_DESC,
    AWS_REGION_DESC,
    AWS_REGION_CODE_DESC,
    AWS_REGION_NAME_DESC,
    CREDENTIALS_ID_DESC
} from '../../utils/schema-description-consts';

const GenericHeaders = Type.Object({
    [HEADERS.WORKSPACE_ID_HEADER]: Type.Optional(Type.String())
});
type GenericHeadersType = Static<typeof GenericHeaders>;

const AccountIdParams = Type.Object({
    accountId: Type.String({ description: ACCOUNT_ID_DESC, minLength: 1 })
});

const AccountIdRegionParams = Type.Object({
    accountId: Type.String({ description: ACCOUNT_ID_DESC, minLength: 1 }),
    region: Type.String({ description: AWS_REGION_DESC, minLength: 1 })
});

const AccountIdCredentialsIdParams = Type.Object({
    accountId: Type.String({ description: ACCOUNT_ID_DESC, minLength: 1 }),
    credentialsId: Type.String({
        description: CREDENTIALS_ID_DESC,
        minLength: 1,
        format: 'uuid',
        examples: ['123e4567-e89b-12d3-a456-426614174000']
    })
});

const CredentialsIdParams = Type.Object({
    accountId: Type.String({ description: ACCOUNT_ID_DESC, minLength: 1 }),
    credentialsId: Type.String({
        description: CREDENTIALS_ID_DESC,
        minLength: 1,
        format: 'uuid',
        examples: ['123e4567-e89b-12d3-a456-426614174000']
    }),
    region: Type.String({ description: AWS_REGION_DESC, enum: AWS_REGION_KEYS })
});

const RegionDetails = Type.Object({
    code: Type.Optional(Type.String({ description: AWS_REGION_CODE_DESC, minLength: 1 })),
    name: Type.Optional(Type.String({ description: AWS_REGION_NAME_DESC }))
});
type RegionDetailsType = Static<typeof RegionDetails>;

const CredentialsIdRegionQueryParams = Type.Object({
    credentialsId: Type.Optional(
        Type.String({
            description: CREDENTIALS_ID_DESC,
            minLength: 1,
            format: 'uuid',
            examples: ['123e4567-e89b-12d3-a456-426614174000']
        })
    ),
    region: Type.Optional(Type.String({ description: AWS_REGION_DESC, minLength: 1 }))
});

const CredentialsIdRegionParams = Type.Object({
    credentialsId: Type.Optional(
        Type.String({
            description: CREDENTIALS_ID_DESC,
            minLength: 1,
            format: 'uuid',
            examples: ['123e4567-e89b-12d3-a456-426614174000']
        })
    ),
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
