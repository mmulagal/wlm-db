import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { OptimizeSizingSchema } from './schemas/continuous-assessment-schema';
import optimizeSizing from '../operations/continuous-assessment-operations';

const MSSQL_API_PREFIX_PATH = '/v1/mssql/credentials/:credentialsId/regions/:region';

export default function databaseHostsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post(
        `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/drift-assessment/sizing-optimize`,
        { schema: OptimizeSizingSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                query: { type }
            } = request;

            const response = await optimizeSizing(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                type
            );
            return reply.send(response);
        }
    );
}
