import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { DeploymentJobsCountSchema, DeploymentJobsSummaryListSchema } from './schemas/jobs-schemas';
import { getDeploymentJobsCount, getDeploymentJobsSummary } from '../operations/jobs-operations';

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
            query: { statuses }
        } = request;
        const response = await getDeploymentJobsSummary(accountId, statuses);
        return reply.send(response!);
    });
}
