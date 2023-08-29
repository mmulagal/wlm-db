import { RouteTags } from '../../utils/consts';
import {
    DatabaseParams,
    DatabaseHeaders,
    DatabasesResponseBody,
    UtilisationResponseBody,
    DatabaseDeleteResponseBody
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

const DeleteDatabaseSchema = {
    headers: DatabaseHeaders,
    tags: [RouteTags.DATABASE],
    params: DatabaseParams,
    description: 'Remove the given MS SQL Server resource',
    response: {
        200: DatabaseDeleteResponseBody
    }
};

const DatabaseUtilisationResponseSchema = {
    ...baseRequest,
    description: 'Database Resource(CPU, Storage, Memory) Utilisation',
    response: {
        200: UtilisationResponseBody
    }
};

export { GetDatabasesSchema, DatabaseUtilisationResponseSchema, DeleteDatabaseSchema };
