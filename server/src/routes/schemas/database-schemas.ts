import { RouteTags } from '../../utils/consts';
import {
    DatabaseParams,
    Tablesparams,
    DatabasesResponseBody,
    TablesResponseBody,
    UtilisationResponseBody,
    ServerSummaryResponse
} from '../types/database.types';
import { GenericHeaders } from '../types/generic.types';

const baseRequest = {
    Headers: GenericHeaders,
    tags: [RouteTags.DATABASE],
    params: DatabaseParams
};

const GetDatabasesSchema = {
    ...baseRequest,
    description: 'List of Databases',
    response: {
        200: DatabasesResponseBody
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

export { GetDatabasesSchema, DatabaseUtilisationResponseSchema, GetServerSummarySchema, GetTablesSchema };
