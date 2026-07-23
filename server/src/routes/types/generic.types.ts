import { Static, Type } from '@fastify/type-provider-typebox';
import { AWS_REGION_KEYS, HEADERS } from '../../utils/consts';
import { API_DESCRIPTION, API_DESCRIPTION_EXAMPLES } from '../../utils/schema-description-consts';

const GenericHeaders = Type.Object({
    [HEADERS.WORKSPACE_ID_HEADER]: Type.Optional(Type.String())
});
type GenericHeadersType = Static<typeof GenericHeaders>;

const AccountIdParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 1 })
});

const AccountIdRegionParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 1 }),
    region: Type.String({ description: API_DESCRIPTION.AWS_REGION_DESC, minLength: 1 })
});

const AccountIdCredentialsIdParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 1 }),
    credentialsId: Type.String({
        description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
        minLength: 1,
        format: 'uuid',
        examples: API_DESCRIPTION_EXAMPLES.CREDENTIALS_ID_EX
    })
});

const CredentialsIdParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 1 }),
    credentialsId: Type.String({
        description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
        minLength: 1,
        format: 'uuid',
        examples: API_DESCRIPTION_EXAMPLES.CREDENTIALS_ID_EX
    }),
    region: Type.String({ description: API_DESCRIPTION.AWS_REGION_DESC, enum: AWS_REGION_KEYS })
});

const RegionDetails = Type.Object({
    code: Type.Optional(Type.String({ description: API_DESCRIPTION.AWS_REGION_CODE_DESC, minLength: 1 })),
    name: Type.Optional(Type.String({ description: API_DESCRIPTION.AWS_REGION_NAME_DESC }))
});
type RegionDetailsType = Static<typeof RegionDetails>;

const CredentialsIdRegionQueryParams = Type.Object({
    credentialsId: Type.Optional(
        Type.String({
            description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
            minLength: 1,
            format: 'uuid',
            examples: API_DESCRIPTION_EXAMPLES.CREDENTIALS_ID_EX
        })
    ),
    region: Type.Optional(Type.String({ description: API_DESCRIPTION.AWS_REGION_DESC, minLength: 1 }))
});

const CredentialsIdRegionParams = Type.Object({
    credentialsId: Type.Optional(
        Type.String({
            description: API_DESCRIPTION.CREDENTIALS_ID_DESC,
            minLength: 1,
            format: 'uuid',
            examples: API_DESCRIPTION_EXAMPLES.CREDENTIALS_ID_EX
        })
    ),
    region: RegionDetails
});

type AccountIdParamsType = Static<typeof AccountIdParams>;
type CredentialsIdParamsType = Static<typeof CredentialsIdParams>;

const NextTokenQueryString = Type.Object({
    nextToken: Type.Optional(Type.String()),
    pageSize: Type.Optional(Type.Integer())
});

const JobIdResponse = Type.Object({
    jobId: Type.String()
});

type JobIdResponseType = Static<typeof JobIdResponse>;

const HttpErrorResponse = Type.Object({ message: Type.String() });

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
    NextTokenQueryString,
    CredentialsIdParamsType,
    JobIdResponse,
    JobIdResponseType,
    HttpErrorResponse
};
