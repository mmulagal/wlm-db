import { RouteTags } from '../../utils/consts';
import {
    databaseParams,
    mssqlTablesparams,
    DatabasesResponseBody,
    TablesResponseBody,
    UtilisationResponseBody
} from '../types/database.types';
import { GenericHeaders } from '../types/generic.types';

const baseRequest = {
    Headers: GenericHeaders,
    tags: [RouteTags.DATABASE],
    params: databaseParams
};

const GetDatabasesSchema = {
    ...baseRequest,
    description: 'List of Databases',
    response: {
        200: DatabasesResponseBody
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
    params: mssqlTablesparams,
    description: 'List of tables in a database',
    response: {
        200: TablesResponseBody
    }
};

export { GetDatabasesSchema, DatabaseUtilisationResponseSchema, GetTablesSchema };
