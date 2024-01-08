import { RouteTags } from '../../utils/consts';
import {
    JobsParams,
    ListJobsQueryString,
    ListJobsResponse,
    JobDetailsResponse,
    DeleteJobResponse,
    ModifyJobResponse
} from '../types/jobs.types';
import { AccountIdParams } from '../types/generic.types';

// Base Request for Deployment Routes
const baseRequest = {
    tags: [RouteTags.JOB_MONITORING],
    params: AccountIdParams
};

// Get all jobs
const ListJobsSchema = {
    ...baseRequest,
    summary: 'List all jobs',
    description: 'API to list all jobs in a tenancy account',
    querystring: ListJobsQueryString,
    response: {
        200: ListJobsResponse
    }
};

// Get job details
const JobDetailsSchema = {
    tags: [RouteTags.JOB_MONITORING],
    params: JobsParams,
    summary: 'Get job details with child jobs',
    description: 'API to list all jobs in a tenancy account with its immediate level child jobs',
    response: {
        200: JobDetailsResponse
    }
};

// Delete job
const DeleteJobSchema = {
    tags: [RouteTags.JOB_MONITORING],
    params: JobsParams,
    summary: 'Delete a job with all its child jobs',
    description: 'API to delete a job and all its subjobs',
    response: {
        200: DeleteJobResponse
    }
};

const ModifyJobSchema = {
    tags: [RouteTags.JOB_MONITORING],
    params: JobsParams,
    summary: 'Delete a job with all its child jobs',
    description: 'API to delete a job and all its subjobs',
    response: {
        200: ModifyJobResponse
    }
};

export { ListJobsSchema, JobDetailsSchema, DeleteJobSchema, ModifyJobSchema };
