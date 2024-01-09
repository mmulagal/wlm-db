import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    ListJobsSchema,
    JobDetailsSchema,
    DeleteJobSchema,
    ModifyJobSchema
} from './schemas/jobs-schemas';
import { deleteJobsWithAllSubJobs, getJobDetails, getJobs, modifyJobDetails } from '../operations/database/job-operations';

const JOBS_API_PATH: string = '/v1/jobs';

export default function jobsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${JOBS_API_PATH}`, { schema: ListJobsSchema }, async (request, reply) => {
        const {
            params: { accountId },
            query: { parentJobId, sort, sortOrder, initiator, type, status, startTime, endTime, pageSize, nextToken }
        } = request;
        const response = await getJobs(
            accountId,
            parentJobId,
            sort,
            sortOrder,
            initiator,
            type,
            status,
            startTime,
            endTime,
            pageSize,
            nextToken
        ) 
        return reply.send(response);
    });

    server.get(`${JOBS_API_PATH}/:jobId`, { schema: JobDetailsSchema }, async (request, reply) => {
        const {
            params: { accountId, jobId },
        } = request;
        const response = await getJobDetails(
            accountId,jobId
        ) 
        return reply.send(response);
    });

    // TODO: restrict the next 2 APIs to staging only
    server.delete(`${JOBS_API_PATH}/:jobId`, { schema: DeleteJobSchema }, async (request, reply) => {
        const {
            params: { accountId, jobId },
        } = request;
        const response = await deleteJobsWithAllSubJobs(
            accountId,jobId
        ) 
        return reply.send(response);
    });

    server.patch(`${JOBS_API_PATH}/:jobId`, { schema: ModifyJobSchema }, async (request, reply) => {
        const {
            params: { accountId, jobId },
        } = request;
        const response = await modifyJobDetails(
            accountId,jobId
        ) 
        return reply.send(response);
    });
}
