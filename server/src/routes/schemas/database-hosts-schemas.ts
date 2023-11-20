import { RouteTags } from '../../utils/consts';
import {
    DatabaseHostObjectParams,
    DatabaseHostQueryString,
    DatabaseHostSummaryListResponse
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

export default DatabaseHostsSummarySchema;
