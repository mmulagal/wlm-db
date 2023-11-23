import { RouteTags } from '../../utils/consts';
import {
    DeploymentJobsCountResponse,
    DeploymentJobsCountQueryString,
    DeploymentJobsSummaryQueryString,
    DeploymentJobsSummaryListResponse,
    JobsParams,
    DeleteJobResponse
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
    summary: 'Get deployment jobs count',
    description: 'API to get deployment jobs count for given duration in days',
    querystring: DeploymentJobsCountQueryString,
    response: {
        200: DeploymentJobsCountResponse
    }
};

const DeploymentJobsSummaryListSchema = {
    ...baseRequest,
    summary: 'Get deployment jobs summary',
    description: 'API to get deployment jobs summary for given deployment status types',
    querystring: DeploymentJobsSummaryQueryString,
    response: {
        200: DeploymentJobsSummaryListResponse
    }
};

const DeleteDeploymentJobsSchema = {
    tags: [RouteTags.DEPLOYMENT],
    params: JobsParams,
    summary: 'Delete deployment Job',
    description: 'Delete deployment Job for the given job Id',
    response: {
        200: DeleteJobResponse
    }
};

export { DeploymentJobsCountSchema, DeploymentJobsSummaryListSchema, DeleteDeploymentJobsSchema };
