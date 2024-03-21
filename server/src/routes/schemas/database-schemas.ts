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

const allResourceUtilizationBaseRequest = {
    ...baseRequest,
    response: {
        200: ResourceUtilizationResponseBody
    }
};

const resourceUtilizationBaseRequest = {
    ...baseRequest,
    response: {
        200: UtilisationResponseBody
    }
};

const PostSqlServerSchema = {
    tags: [RouteTags.DATABASE],
    params: CredentialsIdParams,
    body: MsSqlServerDiscoverRequestBody,
    summary: 'Discover MSSQL',
    description: 'Discover Microsoft SQL Server',
    response: {
        200: MsSqlServerDiscoveryResponse
    }
};

const GetDatabasesSchema = {
    ...baseRequest,
    summary: 'List databases',
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
    description: 'Remove the given MSSQL Server resource',
    response: {
        200: DatabaseDeleteResponseBody
    }
};

const GetServerSummarySchema = {
    ...baseRequest,
    summary: 'Get MSSQL summary',
    description: 'Get MSSQL summary of the given resource',
    response: {
        200: ServerSummaryResponse
    }
};

const DatabaseCpuUtilisationResponseSchema = {
    ...resourceUtilizationBaseRequest,
    summary: 'Get MSSQL CPU utilisation',
    description: 'Database Resource CPU Utilisation'
};

const DatabaseStorageUtilisationResponseSchema = {
    ...resourceUtilizationBaseRequest,
    summary: 'Get MSSQL Storage utilisation',
    description: 'Database Resource Storage Utilisation'
};

const DatabaseMemoryUtilisationResponseSchema = {
    ...resourceUtilizationBaseRequest,
    summary: 'Get MSSQL Memory utilisation',
    description: 'Database Resource Memory Utilisation'
};

const DatabaseResourcesUtilisationResponseSchema = {
    ...allResourceUtilizationBaseRequest,
    summary: 'Get MSSQL resources utilisation',
    description: 'Database utilization of CPU , Storage and Memory resources'
};

const GetTablesSchema = {
    ...baseRequest,
    params: Tablesparams,
    summary: 'List tables',
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
