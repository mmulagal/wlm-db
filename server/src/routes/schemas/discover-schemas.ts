import { RouteTags } from '../../utils/consts';
import {
    DatabaseHostSummaryForMultiInstanceListResponse,
    OracleDbHostSummaryListResponse,
    PgSqlDbHostSummaryListResponse
} from '../types/database-hosts.types';
import {
    DiscoverMsSqlResponseBody,
    DiscoverQuery,
    SqlInstancesRequestQuery,
    DiscoverPgSqlResponseBody,
    DiscoverOracleResponseBody
} from '../types/discover.types';
import { GenericHeaders, CredentialsIdParams } from '../types/generic.types';

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

const MsSqlInstancesSchema = {
    Headers: GenericHeaders,
    tags: [RouteTags.DISCOVER],
    params: CredentialsIdParams,
    querystring: SqlInstancesRequestQuery,
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

const PgSqlResourceDetailsSchema = {
    ...DiscoveryBaseRequest,
    params: CredentialsIdParams,
    querystring: SqlInstancesRequestQuery,
    summary: 'Get resource details of non-NetApp deployed PostgreSQL instances.',
    description: 'Get resource details of non-NetApp deployed PostgreSQL instances.',
    response: {
        200: PgSqlDbHostSummaryListResponse
    }
};

const DiscoverOracleSchema = {
    ...DiscoveryBaseRequest,
    params: CredentialsIdParams,
    querystring: DiscoverQuery,
    summary: 'Discover EC2 instances hosting Oracle Server.',
    description: `Discover AWS EC2 instances hosting Oracle Server.
        EC2 instances meeting the following constraints are
        considered for discovery:
        <ul>
            <li> Instance is in running state.
            <li> Machines running Linux.
            <li> Architecture is x86_64.
        </ul>`,
    response: {
        200: DiscoverOracleResponseBody
    }
};

const OracleResourceDetailsSchema = {
    ...DiscoveryBaseRequest,
    params: CredentialsIdParams,
    querystring: SqlInstancesRequestQuery,
    summary: 'Get resource details of non-NetApp deployed Oracle instances.',
    description: 'Get resource details of non-NetApp deployed Oracle instances.',
    response: {
        200: OracleDbHostSummaryListResponse
    }
};

export {
    DiscoverMsSqlSchema,
    MsSqlInstancesSchema,
    DiscoverPgSqlSchema,
    PgSqlResourceDetailsSchema,
    DiscoverOracleSchema,
    OracleResourceDetailsSchema
};
