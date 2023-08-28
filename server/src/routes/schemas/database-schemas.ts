import { RouteTags } from '../../utils/consts';
import {
    databaseParams,
    DatabasesResponseBody,
    UtilisationResponseBody,
    msSqlServerDiscoveryParams,
    msSqlServerDiscoveryResponse
} from '../types/database.types';
import { GenericHeaders } from '../types/generic.types';

const baseRequest = {
    Headers: GenericHeaders,
    tags: [RouteTags.DATABASE],
    params: databaseParams
};

const PostSqlServerSchema = {
    tags: [RouteTags.DATABASE],
    params: msSqlServerDiscoveryParams,
    description: 'Discover Microsoft SQL Server',
    response: {
        200: msSqlServerDiscoveryResponse
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
export { GetDatabasesSchema, DatabaseUtilisationResponseSchema, PostSqlServerSchema };
