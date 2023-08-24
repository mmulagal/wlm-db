import { RouteTags } from '../../utils/consts';
import { databaseParams, DatabasesResponseBody, UtilisationResponseBody } from '../types/database.types';
import { GenericHeaders } from '../types/generic.types';

const baseRequest = {
    Headers: GenericHeaders,
    tags: [RouteTags.DATABASE],
    params: databaseParams
};

const DeleteMsSqlServerSchema = {
    params: databaseParams,
    tags: [RouteTags.DATABASE],
    description: 'Remove Microsoft SQL Server by resource ID',
    response: {
        204: { type: 'number', description: 'Resource deleted successfully.' },
        404: { type: 'number', description: 'Failed to delete the resource.' }
    }
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
export { GetDatabasesSchema, DatabaseUtilisationResponseSchema, DeleteMsSqlServerSchema };
