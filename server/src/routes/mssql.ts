import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { GetDatabasesSchema } from './schemas/mssql-schemas';
import { getDataBasesSummary } from '../operations/mssql/mssql-operations';

const MSSQL_DATA_API_PATH: string = '/v1/workspacePublicId/:workspacePublicId/mssql/:resourceId';

export default function mssqlRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
    server.get(`${MSSQL_DATA_API_PATH}/databases`, { schema: GetDatabasesSchema}, async (request, reply) => {
        const {
            params: { resourceId },
        } = request;
        const response = await getDataBasesSummary(resourceId);
        return reply.send(response);
    });
}