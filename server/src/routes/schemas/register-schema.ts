import { RouteTags } from '../../utils/consts';

import { GenericHeaders, AccountIdParams } from '../types/generic.types';
import {
    BulkRegisterCredentialsRequestBody,
    DatabaseInstanceQueryString,
    JobBasedManageResponseBody,
    MultiHostManageResponseBody,
    MultiInstanceManageMsSqlRequestBody,
    MultiInstanceRegisterOracleRequestBody,
    MultiInstanceUnmanageResponseBody,
    PrepareResourceResponseBody,
    RegisterCredentialsRequestBody,
    RegisterCredentialsResponse,
    RegisterInstanceParams,
    SingleRegisterCredentialsResponse,
    UnmanageInstanceParams
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

const UnManageMsSqlSchema = {
    ...RegisterBaseRequest,
    params: UnmanageInstanceParams,
    querystring: DatabaseInstanceQueryString,
    summary: 'Deregister SQL Server database instances.',
    description: 'Deregister SQL Server database instances managed by Workload Factory.',
    response: {
        200: MultiInstanceUnmanageResponseBody
    }
};

const UnManagePgSqlSchema = {
    ...RegisterBaseRequest,
    params: UnmanageInstanceParams,
    querystring: DatabaseInstanceQueryString,
    summary: 'Deregister PostgreSQL database instances.',
    description: 'Deregister PostgreSQL database instances managed by Workload Factory.',
    response: {
        200: MultiInstanceUnmanageResponseBody
    }
};

const UnmanageOracleSchema = {
    ...RegisterBaseRequest,
    params: UnmanageInstanceParams,
    querystring: DatabaseInstanceQueryString,
    summary: 'Deregister Oracle database instances.',
    description: 'Deregister Oracle database instances managed by Workload Factory.',
    response: {
        200: MultiInstanceUnmanageResponseBody
    }
};

export {
    JobBasedManageSchema,
    RegisterCredentialsSchema,
    SingleRegisterCredentialsSchema,
    PrepareForManageSchema,
    ManageMsSqlSchemaV2,
    OracleRegisterInstancesSchema,
    UnmanageOracleSchema,
    UnManagePgSqlSchema,
    UnManageMsSqlSchema
};
