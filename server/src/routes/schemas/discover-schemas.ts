import { RouteTags } from '../../utils/consts';
import {
    DatabaseHostSummaryForMultiInstanceListResponse,
    DatabaseHostSummaryPerStorageTypeListResponse
} from '../types/database-hosts.types';
import {
    DiscoverMsSqlResponseBody,
    DiscoverQuery,
    DiscoverInstanceParams,
    DiscoverCredentialsRequestBody,
    DiscoverCredentialsResponse,
    MsSqlInstancesRequestQuery,
    PrepareResourceResponseBody,
    MultiInstanceManageMsSqlRequestBody,
    MultiInstanceUnmanageResponseBody,
    UnmanageInstanceParams,
    DatabaseInstanceQueryString,
    DiscoverPgSqlResponseBody,
    MultiHostManageResponseBody
} from '../types/discover.types';
import { GenericHeaders, CredentialsIdParams, AccountIdParams } from '../types/generic.types';

const DiscoveryBaseRequest = {
    Headers: GenericHeaders,
    tags: [RouteTags.DISCOVER]
};

const DiscoverMsSqlSchema = {
    ...DiscoveryBaseRequest,
    params: CredentialsIdParams,
    querystring: DiscoverQuery,
    summary: 'Discover EC2 instances hosting Microsoft SQL Server.',
    description: `Discover AWS EC2 instances hosting Microsoft SQL Server.
        EC2 instances meeting the following constraints are
        considered for discovery:
        <ul>
            <li> Instance is in running state.
            <li> Host operating system is Microsoft Windows.
            <li> Architecture is x86_64.
        </ul>
        <p>If SSM connectivity is available, only those EC2 running
        SQL Server 2016 and above are returned. For EC2s without SSM
        connectivity SQL Server edition constraint is not applicable.`,
    response: {
        200: DiscoverMsSqlResponseBody
    }
};

const PrepareForManageSchema = {
    ...DiscoveryBaseRequest,
    params: DiscoverInstanceParams,
    summary: 'Prepare the EC2 for managing resources',
    description:
        'Install the required PowerShell modules and copy database artifacts required by a Workload Factory managed resource.',
    response: {
        200: PrepareResourceResponseBody
    }
};
// const ManageMsSqlSchema = {
//     ...DiscoveryBaseRequest,
//     params: DiscoverInstanceParams,
//     hide: process.env.NODE_ENV === 'production',
//     summary: 'Manage EC2 instances hosting Microsoft SQL Server. (deprecated)',
//     description: `Manage AWS EC2 instances hosting Microsoft SQL Server.
//     EC2 instances meeting the following constraints are managed:
//     <ul>
//         <li> Instance is in running state.
//         <li> Host operating system is Microsoft Windows.
//         <li> Architecture is x86_64.
//         <li> Underlying storage is FSx for NetApp.
//     </ul>`,
//     response: {
//         200: ManageMsSqlResponseBody
//     }
// };

const UnManageMsSqlSchema = {
    ...DiscoveryBaseRequest,
    params: UnmanageInstanceParams,
    querystring: DatabaseInstanceQueryString,
    summary: 'Unmanage SQL Server database instances.',
    description: 'Unmanage SQL Server database instances managed by Workload Factory.',
    response: {
        200: MultiInstanceUnmanageResponseBody
    }
};

const ManageMsSqlSchemaV2 = {
    ...DiscoveryBaseRequest,
    params: AccountIdParams,
    body: MultiInstanceManageMsSqlRequestBody,
    summary: 'Manage SQL Server instances',
    description: 'Manage SQL Server instances',
    response: {
        200: MultiHostManageResponseBody
    }
};

const DiscoverCredentialsSchema = {
    Headers: GenericHeaders,
    tags: [RouteTags.DISCOVER],
    params: DiscoverInstanceParams,
    body: DiscoverCredentialsRequestBody,
    summary: 'Discover credentials',
    description: 'Store the credentials for a given discovered resource in SSM Parameter Store',
    response: {
        200: DiscoverCredentialsResponse
    }
};

const MsSqlInstancesSchema = {
    Headers: GenericHeaders,
    tags: [RouteTags.DISCOVER],
    params: CredentialsIdParams,
    querystring: MsSqlInstancesRequestQuery,
    hide: process.env.NODE_ENV === 'production',
    summary: 'Get details of instances with Microsoft Windows platform and hosting Microsoft SQL Server (deprecated).',
    description: 'Get details of instances with Microsoft Windows platform and hosting Microsoft SQL Server.',
    response: {
        200: DatabaseHostSummaryPerStorageTypeListResponse
    }
};

const MsSqlInstancesSchemaV2 = {
    Headers: GenericHeaders,
    tags: [RouteTags.DISCOVER],
    params: CredentialsIdParams,
    querystring: MsSqlInstancesRequestQuery,
    summary: 'Get details of instances with Microsoft Windows platform and hosting Microsoft SQL Server.',
    description: 'Get details of instances with Microsoft Windows platform and hosting Microsoft SQL Server.',
    response: {
        200: DatabaseHostSummaryForMultiInstanceListResponse
    }
};

const DiscoverPgSqlSchema = {
    ...DiscoveryBaseRequest,
    params: CredentialsIdParams,
    querystring: DiscoverQuery,
    summary: 'Discover EC2 instances hosting PostgreSQL Server.',
    description: `Discover AWS EC2 instances hosting PostgreSQL Server.
        EC2 instances meeting the following constraints are
        considered for discovery:
        <ul>
            <li> Instance is in running state.
            <li> Machines running images of Amazon Linux 2023.
            <li> Architecture is x86_64.
        </ul>`,
    response: {
        200: DiscoverPgSqlResponseBody
    }
};

export {
    DiscoverCredentialsSchema,
    DiscoverMsSqlSchema,
    MsSqlInstancesSchema,
    PrepareForManageSchema,
    MsSqlInstancesSchemaV2,
    UnManageMsSqlSchema,
    ManageMsSqlSchemaV2,
    DiscoverPgSqlSchema
};
