import { RouteTags } from '../../utils/consts';

import { GenericHeaders, AccountIdParams } from '../types/generic.types';
import {
    BulkRegisterCredentialsRequestBody,
    JobBasedManageResponseBody,
    MultiHostManageResponseBody,
    MultiInstanceManageMsSqlRequestBody,
    PrepareResourceResponseBody,
    RegisterCredentialsRequestBody,
    RegisterCredentialsResponse,
    RegisterInstanceParams,
    SingleRegisterCredentialsResponse
} from '../types/register.types';

const RegisterBaseRequest = {
    Headers: GenericHeaders,
    tags: [RouteTags.REGISTER]
};

// TODO: Remove this schema once the old API is deprecated
const SingleRegisterCredentialsSchema = {
    Headers: GenericHeaders,
    tags: [RouteTags.REGISTER],
    params: RegisterInstanceParams,
    body: RegisterCredentialsRequestBody,
    summary: 'Discover credentials',
    description: 'Store the credentials for a given discovered resource in SSM Parameter Store',
    response: {
        200: SingleRegisterCredentialsResponse
    }
};

const JobBasedManageSchema = {
    ...RegisterBaseRequest,
    params: AccountIdParams,
    body: MultiInstanceManageMsSqlRequestBody,
    summary: 'Register SQL Server instances',
    description: 'Register SQL Server instances',
    response: {
        200: JobBasedManageResponseBody
    }
};

const RegisterCredentialsSchema = {
    ...RegisterBaseRequest,
    params: AccountIdParams,
    body: BulkRegisterCredentialsRequestBody,
    summary: 'Register credentials for FSxN and SQL Server/ PostgreSQL/Oracle instances',
    description: 'Register credentials for FSxN and SQL Server/ PostgreSQL/Oracle instances',
    response: {
        200: RegisterCredentialsResponse
    }
};

const PrepareForManageSchema = {
    ...RegisterBaseRequest,
    params: RegisterInstanceParams,
    summary: 'Prepare the EC2 for managing resources',
    description:
        'Install the required PowerShell modules and copy database artifacts required by a Workload Factory managed resource.',
    response: {
        200: PrepareResourceResponseBody
    }
};

const ManageMsSqlSchemaV2 = {
    ...RegisterBaseRequest,
    params: AccountIdParams,
    body: MultiInstanceManageMsSqlRequestBody,
    summary: '(Deprecated) Register SQL Server instances',
    description: 'Deprecated. Use /v2/mssql/manage instead.',
    response: {
        200: MultiHostManageResponseBody
    }
};

export {
    JobBasedManageSchema,
    RegisterCredentialsSchema,
    SingleRegisterCredentialsSchema,
    PrepareForManageSchema,
    ManageMsSqlSchemaV2
};
