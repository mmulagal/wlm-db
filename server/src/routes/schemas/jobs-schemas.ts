import { RouteTags } from '../../utils/consts';
import {
    JobsParams,
    ListJobsQueryString,
    ListJobsResponse,
    DeleteJobResponse,
    UpdateJobResponse,
    CreateJobResponse,
    CreateJobRequestBody,
    UpdateJobRequestBody,
    JobDetailsResponse,
    DeploymentJobsCountQueryString,
    DeploymentJobsCountResponse
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

// Update job
const UpdateJobSchema = {
    tags: [RouteTags.JOB_MONITORING],
    params: JobsParams,
    summary: 'Update a job',
    description: 'API to update job details',
    body: UpdateJobRequestBody,
    response: {
        200: UpdateJobResponse
    }
};

// Create jobs
const CreateJobSchema = {
    ...baseRequest,
    summary: 'Create jobs',
    description: 'API to create jobs',
    body: CreateJobRequestBody,
    response: {
        200: CreateJobResponse
    }
};

// //TODO : DELETE ME Get Deployment jobs summary details
const DeploymentJobsCountSchema = {
    ...baseRequest,
    summary: 'Get deployment jobs count',
    description: 'API to get deployment jobs count for given duration in days',
    querystring: DeploymentJobsCountQueryString,
    response: {
        200: DeploymentJobsCountResponse
    }
};

export {
    ListJobsSchema,
    JobDetailsSchema,
    DeleteJobSchema,
    UpdateJobSchema,
    CreateJobSchema,
    DeploymentJobsCountSchema
};
