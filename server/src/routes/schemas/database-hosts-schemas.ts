import { RouteTags } from '../../utils/consts';
import {
    DatabaseHostObjectParams,
    DatabaseHostQueryString,
    DatabaseHostSummaryListResponse,
    DatabaseHostSummaryParams,
    DatabasesListResponse
} from '../types/database-hosts.types';
import { AccountIdParams } from '../types/generic.types';

// Base Request for Deployment Routes
const baseRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams
};

// Get Database hosts summary details
const DatabaseHostsSummarySchema = {
    ...baseRequest,
    summary: 'Get databse hosts details',
    description: 'Get database hosts summary details',
    params: DatabaseHostObjectParams,
    querystring: DatabaseHostQueryString,
    response: {
        200: DatabaseHostSummaryListResponse
    }
};

// Get databases in a database server
const DatabasesListSchema = {
    ...baseRequest,
    summary: 'Fetch details about databases in a server ',
    description:
        'Fetch details about databases in a server - name, protection status, availability status, size and type of database',
    params: DatabaseHostSummaryParams,
    response: {
        200: DatabasesListResponse
    }
};

export { DatabaseHostsSummarySchema, DatabasesListSchema };
