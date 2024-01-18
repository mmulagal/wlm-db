import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    JobSummarySchema,
    ListJobsSchema,
    JobDetailsSchema,
    DeleteJobSchema,
    UpdateJobSchema,
    CreateJobSchema
} from './schemas/jobs-schemas';
import {
    deleteJobsWithAllSubJobs,
    getJobDetails,
    getJobs,
    registerJobs,
    updateJobDetails,
    getJobSummary
} from '../operations/database/job-operations';
import { JobRecordType } from './types/jobs.types';

const JOBS_API_PATH: string = '/v1/jobs';

export default function jobsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${JOBS_API_PATH}`, { schema: ListJobsSchema }, async (request, reply) => {
        const {
            params: { accountId },
            query
        } = request;
        const response = await getJobs(accountId, query);
        return reply.send(response);
    });
    server.get(`${JOBS_API_PATH}/:jobId`, { schema: JobDetailsSchema }, async (request, reply) => {
        const {
            params: { accountId, jobId }
        } = request;
        const response = await getJobDetails(accountId, jobId);
        return reply.send(response);
    });

    server.get(`${JOBS_API_PATH}/summary`, { schema: JobSummarySchema }, async (request, reply) => {
        const {
            params: { accountId },
            query: { startTime, endTime }
        } = request;
        const response = await getJobSummary(accountId, startTime, endTime);
        return reply.send(response);
    });

    if (process.env.NODE_ENV !== 'production') {
        server.delete(`${JOBS_API_PATH}/:jobId`, { schema: DeleteJobSchema }, async (request, reply) => {
            const {
                params: { accountId, jobId }
            } = request;
            const response = await deleteJobsWithAllSubJobs(accountId, jobId);
            return reply.send(response);
        });

        server.patch(`${JOBS_API_PATH}/:jobId`, { schema: UpdateJobSchema }, async (request, reply) => {
            const {
                params: { accountId, jobId },
                body
            } = request;
            const response = await updateJobDetails(accountId, jobId, body);
            return reply.send(response);
        });

        server.post(`${JOBS_API_PATH}`, { schema: CreateJobSchema }, async (request, reply) => {
            const {
                params: { accountId }
            } = request;

            const { items } = request.body;
            const response = await registerJobs(accountId, items as JobRecordType[]);
            return reply.send(response);
        });
    }
}
