import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    DeploymentJobsCountSchema,
    ListJobsSchema,
    JobDetailsSchema,
    DeleteJobSchema,
    UpdateJobSchema,
    CreateJobSchema
} from './schemas/jobs-schemas';
import { deleteJobsWithAllSubJobs, getJobDetails, getJobs, registerJobs, updateJobDetails } from '../operations/database/job-operations';
import { JobRecordType } from './types/jobs.types';

import { getDeploymentJobsCount } from '../operations/jobs-operations';

const JOBS_API_PATH: string = '/v1/jobs';

export default function jobsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
    //TODO : DELETE ME
    server.get(`${JOBS_API_PATH}/summary`, { schema: DeploymentJobsCountSchema }, async (request, reply) => {
        const {
            params: { accountId },
            query: { duration }
        } = request;
        const response = await getDeploymentJobsCount(accountId, duration);
        return reply.send(response);
    });

    server.get(`${JOBS_API_PATH}`, { schema: ListJobsSchema }, async (request, reply) => {
        const {
            params: { accountId },
            query
        } = request;
        const response = await getJobs(
            accountId,
            query
        )
        return reply.send(response);
    });

    server.get(`${JOBS_API_PATH}/:jobId`, { schema: JobDetailsSchema }, async (request, reply) => {
        const {
            params: { accountId, jobId }
        } = request;
        const response = await getJobDetails(
            accountId, jobId
        )
        return reply.send(response);
    });

    // TODO: restrict the next 2 APIs to staging only
    server.delete(`${JOBS_API_PATH}/:jobId`, { schema: DeleteJobSchema }, async (request, reply) => {
        const {
            params: { accountId, jobId },
        } = request;
        const response = await deleteJobsWithAllSubJobs(
            accountId, jobId
        )
        return reply.send(response);
    });

    server.patch(`${JOBS_API_PATH}/:jobId`, { schema: UpdateJobSchema }, async (request, reply) => {
        const {
            params: { accountId, jobId },
            body
        } = request;
        const response = await updateJobDetails(
            accountId, jobId, body
        )
        return reply.send(response);
    });

    server.post(`${JOBS_API_PATH}`, { schema: CreateJobSchema }, async (request, reply) => {
        const {
            params: { accountId },
        } = request;

        const { items } = request.body;
        const response = await registerJobs(
            accountId, items as JobRecordType[]
        )
        return reply.send(response);
    });
}
