import { RouteTags } from '../../utils/consts';
import {
    databaseParams,
    DatabasesResponseBody,
    UtilisationResponseBody,
    ServerSummaryResponse
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

export { GetDatabasesSchema, DatabaseUtilisationResponseSchema, GetServerSummarySchema };
