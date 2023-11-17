import { RouteTags } from '../../utils/consts';
import {
    DatabaseParams,
    DatabaseHeaders,
    Tablesparams,
    DatabasesResponseBody,
    TablesResponseBody,
    UtilisationResponseBody,
    ServerSummaryResponse,
    DatabaseDeleteResponseBody,
    MsSqlServerDiscoveryParams,
    MsSqlServerDiscoveryResponse,
    MsSqlServerDiscoverRequestBody
} from '../types/database.types';
import { GenericHeaders } from '../types/generic.types';

const baseRequest = {
    Headers: GenericHeaders,
    tags: [RouteTags.DATABASE],
    params: DatabaseParams
};

const PostSqlServerSchema = {
    tags: [RouteTags.DATABASE],
    params: MsSqlServerDiscoveryParams,
    body: MsSqlServerDiscoverRequestBody,
    summary: 'Discover MS SQL',
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
    summary: 'Remove MS SQL resource',
    description: 'Remove the given MS SQL Server resource',
    response: {
        200: DatabaseDeleteResponseBody
    }
};

const GetServerSummarySchema = {
    ...baseRequest,
    summary: 'Get MS SQL summary',
    description: 'Get MS SQL summary of the given resource',
    response: {
        200: ServerSummaryResponse
    }
};

const DatabaseUtilisationResponseSchema = {
    ...baseRequest,
    summary: 'Get MS SQL resource utilisation',
    description: 'Database Resource(CPU, Storage, Memory) Utilisation',
    response: {
        200: UtilisationResponseBody
    }
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
    DatabaseUtilisationResponseSchema,
    PostSqlServerSchema,
    DeleteDatabaseSchema,
    GetServerSummarySchema,
    GetTablesSchema
};
