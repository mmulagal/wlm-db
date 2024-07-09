import { RouteTags } from '../../utils/consts';
import {
    DatabaseParams,
    DatabaseHeaders,
    Tablesparams,
    DatabasesResponseBody,
    TablesResponseBody,
    ServerSummaryResponse,
    DatabaseDeleteResponseBody,
    MsSqlServerDiscoveryResponse,
    MsSqlServerDiscoverRequestBody,
    ResourceUtilizationResponseBody,
    UtilisationResponseBody
} from '../types/database.types';
import { GenericHeaders, CredentialsIdParams } from '../types/generic.types';

const baseRequest = {
    Headers: GenericHeaders,
    tags: [RouteTags.DATABASE],
    params: DatabaseParams
};

const AllResourceUtilizationBaseRequest = {
    ...baseRequest,
    response: {
        200: ResourceUtilizationResponseBody
    }
};

const ResourceUtilizationBaseRequest = {
    ...baseRequest,
    response: {
        200: UtilisationResponseBody
    }
};

const PostSqlServerSchema = {
    tags: [RouteTags.DATABASE],
    params: CredentialsIdParams,
    body: MsSqlServerDiscoverRequestBody,
    hide: process.env.NODE_ENV === 'production',
    summary: 'Discover MSSQL',
    description: 'Discover Microsoft SQL Server',
    response: {
        200: MsSqlServerDiscoveryResponse
    }
};

const GetDatabasesSchema = {
    ...baseRequest,
    summary: 'List databases',
    hide: process.env.NODE_ENV === 'production',
    description: 'List Databases for the given resource',
    response: {
        200: DatabasesResponseBody
    }
};

const DeleteDatabaseSchema = {
    headers: DatabaseHeaders,
    tags: [RouteTags.DATABASE],
    params: DatabaseParams,
    summary: 'Remove MSSQL resource',
    hide: process.env.NODE_ENV === 'production',
    description: 'Remove the given MSSQL Server resource',
    response: {
        200: DatabaseDeleteResponseBody
    }
};

const GetServerSummarySchema = {
    ...baseRequest,
    summary: 'Get MSSQL summary',
    hide: process.env.NODE_ENV === 'production',
    description: 'Get MSSQL summary of the given resource',
    response: {
        200: ServerSummaryResponse
    }
};

const DatabaseCpuUtilisationResponseSchema = {
    ...ResourceUtilizationBaseRequest,
    hide: process.env.NODE_ENV === 'production',
    summary: 'Get MSSQL CPU utilisation',
    description: 'Database Resource CPU Utilisation'
};

const DatabaseStorageUtilisationResponseSchema = {
    ...ResourceUtilizationBaseRequest,
    hide: process.env.NODE_ENV === 'production',
    summary: 'Get MSSQL Storage utilisation',
    description: 'Database Resource Storage Utilisation'
};

const DatabaseMemoryUtilisationResponseSchema = {
    ...ResourceUtilizationBaseRequest,
    hide: process.env.NODE_ENV === 'production',
    summary: 'Get MSSQL Memory utilisation',
    description: 'Database Resource Memory Utilisation'
};

const DatabaseResourcesUtilisationResponseSchema = {
    ...AllResourceUtilizationBaseRequest,
    summary: 'Get MSSQL resources utilisation',
    hide: process.env.NODE_ENV === 'production',
    description: 'Database utilization of CPU , Storage and Memory resources'
};

const GetTablesSchema = {
    ...baseRequest,
    params: Tablesparams,
    summary: 'List tables',
    hide: process.env.NODE_ENV === 'production',
    description: 'List of tables in the given database',
    response: {
        200: TablesResponseBody
    }
};

export {
    GetDatabasesSchema,
    DatabaseResourcesUtilisationResponseSchema,
    DatabaseCpuUtilisationResponseSchema,
    DatabaseStorageUtilisationResponseSchema,
    DatabaseMemoryUtilisationResponseSchema,
    PostSqlServerSchema,
    DeleteDatabaseSchema,
    GetServerSummarySchema,
    GetTablesSchema
};
