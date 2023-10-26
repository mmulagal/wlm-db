import { RouteTags } from '../../utils/consts';
import {
    DeploymentJobsCountResponse,
    DeploymentJobsCountQueryString,
    DeploymentJobsSummaryQueryString,
    DeploymentJobsSummaryListResponse
} from '../types/jobs.types';
import { AccountIdParams } from '../types/generic.types';

// Base Request for Deployment Routes
const baseRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams
};

// Get Deployment jobs summary details
const DeploymentJobsCountSchema = {
    ...baseRequest,
    description: 'API to get deployment jobs count for given duration in days',
    querystring: DeploymentJobsCountQueryString,
    response: {
        200: DeploymentJobsCountResponse
    }
};

const DeploymentJobsSummaryListSchema = {
    ...baseRequest,
    description: 'API to get deployment jobs summary for given deployment status types',
    querystring: DeploymentJobsSummaryQueryString,
    response: {
        200: DeploymentJobsSummaryListResponse
    }
};

export { DeploymentJobsCountSchema, DeploymentJobsSummaryListSchema };
