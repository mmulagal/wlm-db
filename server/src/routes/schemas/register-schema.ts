import { RouteTags } from '../../utils/consts';

import { GenericHeaders, AccountIdParams } from '../types/generic.types';
import {
    BulkRegisterCredentialsRequestBody,
    JobBasedManageResponseBody,
    MultiHostManageResponseBody,
    MultiInstanceManageMsSqlRequestBody,
    MultiInstanceRegisterOracleRequestBody,
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
    summary: '(Deprecated) Discover credentials',
    description: '(Deprecated) Use /v1/register-credentials instead.',
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

const OracleRegisterInstancesSchema = {
    ...RegisterBaseRequest,
    params: AccountIdParams,
    body: MultiInstanceRegisterOracleRequestBody,
    summary: 'Register Oracle instances',
    description: 'Register Oracle instances',
    response: {
        200: JobBasedManageResponseBody
    }
};

const RegisterCredentialsSchema = {
    ...RegisterBaseRequest,
    params: AccountIdParams,
    body: BulkRegisterCredentialsRequestBody,
    summary: 'Register credentials',
    description: 'Register credentials for FSxN and SQL Server/PostgreSQL/Oracle instances',
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
    description: 'Deprecated. Use /v1/mssql/register instead.',
    response: {
        200: MultiHostManageResponseBody
    }
};

export {
    JobBasedManageSchema,
    RegisterCredentialsSchema,
    SingleRegisterCredentialsSchema,
    PrepareForManageSchema,
    ManageMsSqlSchemaV2,
    OracleRegisterInstancesSchema
};
