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
    description: 'Discover Microsoft SQL Server',
    response: {
        200: MsSqlServerDiscoveryResponse
    }
};

const GetDatabasesSchema = {
    ...baseRequest,
    description: 'List of Databases',
    response: {
        200: DatabasesResponseBody
    }
};

const DeleteDatabaseSchema = {
    headers: DatabaseHeaders,
    tags: [RouteTags.DATABASE],
    params: DatabaseParams,
    description: 'Remove the given MS SQL Server resource',
    response: {
        200: DatabaseDeleteResponseBody
    }
};

const GetServerSummarySchema = {
    ...baseRequest,
    description: 'Summary of database',
    response: {
        200: ServerSummaryResponse
    }
};

const DatabaseUtilisationResponseSchema = {
    ...baseRequest,
    description: 'Database Resource(CPU, Storage, Memory) Utilisation',
    response: {
        200: UtilisationResponseBody
    }
};

const GetTablesSchema = {
    ...baseRequest,
    params: Tablesparams,
    description: 'List of tables in a database',
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
