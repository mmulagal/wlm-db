import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import DeploymentJobsSummarySchema from './schemas/deployment-jobs-schemas';
import { getDeploymentJobsCount } from '../operations/deployment-jobs-operations';

const DEPLOYMENT_JOBS_API_PATH: string = '/v1/duration/:duration/jobs';

export default function deploymentJobsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(
        `${DEPLOYMENT_JOBS_API_PATH}/summary`,
        { schema: DeploymentJobsSummarySchema },
        async (request, reply) => {
            const {
                params: { accountId, duration }
            } = request;
            const response = await getDeploymentJobsCount(accountId, duration);
            return reply.send(response);
        }
    );
}
