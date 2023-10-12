import { RouteTags } from '../../utils/consts';
import { DeploymentJobsObjectParams, DeploymentJobsResponse } from '../types/deployment-jobs.types';
import { AccountIdParams } from '../types/generic.types';

// Base Request for Deployment Routes
const baseRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams
};

// Get Deployment jobs summary details
const DeploymentJobsSummarySchema = {
    ...baseRequest,
    description: 'API to get deplyment jobs count for given duration in days',
    params: DeploymentJobsObjectParams,
    response: {
        200: DeploymentJobsResponse
    }
};

export default DeploymentJobsSummarySchema;
