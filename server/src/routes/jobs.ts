import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    JobSummarySchema,
    ListJobsSchema,
    JobDetailsSchema,
    DeleteJobSchema,
    UpdateJobSchema,
    CreateJobSchema,
    JobSummaryByTimeSchema
} from './schemas/jobs-schemas';
import {
    deleteJobsWithAllSubJobs,
    getJobDetails,
    getJobs,
    registerJobs,
    updateJobDetails,
    getJobSummary,
    getJobSummaryByTime
} from '../operations/database/job-operations';
import { JobRecordType, UpdateJobRecordType } from './types/jobs.types';
import castRequest from './utils';

const JOBS_API_PATH: string = '/v1/jobs';

export default function jobsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${JOBS_API_PATH}`, { schema: ListJobsSchema }, async (request, reply) => {
        const {
            params: { accountId },
            query
        } = castRequest(request);
        const response = await getJobs(accountId, query);
        return reply.send(response);
    });
    server.get(`${JOBS_API_PATH}/:jobId`, { schema: JobDetailsSchema }, async (request, reply) => {
        const {
            params: { accountId, jobId },
            query: { credentialsId, region }
        } = castRequest(request);
        const response = await getJobDetails(accountId, jobId, credentialsId, region);
        return reply.send(response);
    });

    server.get(`${JOBS_API_PATH}/summary`, { schema: JobSummarySchema }, async (request, reply) => {
        const {
            params: { accountId },
            query
        } = castRequest(request);
        const response = await getJobSummary(accountId, query);
        return reply.send(response);
    });

    server.get(`${JOBS_API_PATH}/summary/timeline`, { schema: JobSummaryByTimeSchema }, async (request, reply) => {
        const {
            params: { accountId },
            query
        } = castRequest(request);
        const response = await getJobSummaryByTime(accountId, query);
        return reply.send(response);
    });

    if (process.env.NODE_ENV !== 'production') {
        server.delete(`${JOBS_API_PATH}/:jobId`, { schema: DeleteJobSchema }, async (request, reply) => {
            const {
                params: { accountId, jobId }
            } = castRequest(request);
            const response = await deleteJobsWithAllSubJobs(accountId, jobId);
            return reply.send(response);
        });

        server.patch(`${JOBS_API_PATH}/:jobId`, { schema: UpdateJobSchema }, async (request, reply) => {
            const {
                params: { accountId, jobId },
                body
            } = castRequest(request);
            const response = await updateJobDetails(accountId, jobId, body as UpdateJobRecordType);
            return reply.send(response);
        });

        server.post(`${JOBS_API_PATH}`, { schema: CreateJobSchema }, async (request, reply) => {
            const {
                params: { accountId },
                body
            } = castRequest(request);

            const { credentialsId, region, items } = body;
            const response = await registerJobs(accountId, credentialsId, region, items as JobRecordType[]);
            return reply.send(response);
        });
    }
}
