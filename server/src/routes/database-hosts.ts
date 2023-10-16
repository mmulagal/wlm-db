import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import getDatabaseHostsSummary from '../operations/database-hosts-operations';
import DatabaseHostsSummarySchema from './schemas/database-hosts-schemas';

const DATABASE_HOSTS_API_PATH: string = '/v1/database-hosts';

export default function databaseHostsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${DATABASE_HOSTS_API_PATH}`, { schema: DatabaseHostsSummarySchema }, async (request, reply) => {
        const {
            params: { accountId },
            query: { fields }
        } = request;
        const response = await getDatabaseHostsSummary(accountId, fields);
        return reply.send(response);
    });
}
