import { RouteTags } from '../../utils/consts';
import { AwsAccountParams } from '../types/aws.types';
import {
    DatabaseHostObjectParams,
    DatabaseHostQueryString,
    DatabaseHostSummaryListResponse
} from '../types/database-hosts.types';

// Base Request for Deployment Routes
const baseRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: AwsAccountParams
};

// Get Database hosts summary details
const DatabaseHostsSummarySchema = {
    ...baseRequest,
    params: DatabaseHostObjectParams,
    querystring: DatabaseHostQueryString,
    response: {
        200: DatabaseHostSummaryListResponse
    }
};

export default DatabaseHostsSummarySchema;
