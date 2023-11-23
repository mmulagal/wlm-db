import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    DeploymentJobsCountSchema,
    DeploymentJobsSummaryListSchema,
    DeleteDeploymentJobsSchema
} from './schemas/jobs-schemas';
import { getDeploymentJobsCount, getDeploymentJobsSummary, deleteDeploymentJob } from '../operations/jobs-operations';

const DEPLOYMENT_JOBS_API_PATH: string = '/v1/jobs';

export default function deploymentJobsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${DEPLOYMENT_JOBS_API_PATH}/summary`, { schema: DeploymentJobsCountSchema }, async (request, reply) => {
        const {
            params: { accountId },
            query: { duration }
        } = request;
        const response = await getDeploymentJobsCount(accountId, duration);
        return reply.send(response);
    });

    server.get(`${DEPLOYMENT_JOBS_API_PATH}`, { schema: DeploymentJobsSummaryListSchema }, async (request, reply) => {
        const {
            params: { accountId },
            query: { statuses, nextToken }
        } = request;
        const response = await getDeploymentJobsSummary(accountId, statuses, nextToken);
        return reply.send(response!);
    });

    server.delete(
        `${DEPLOYMENT_JOBS_API_PATH}/jobId/:jobId`,
        { schema: DeleteDeploymentJobsSchema },
        async (request, reply) => {
            const {
                params: { accountId, jobId }
            } = request;
            const response = await deleteDeploymentJob(accountId, jobId);
            return reply.send(response);
        }
    );
}
