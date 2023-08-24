import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    GetDatabasesSchema,
    DatabaseUtilisationResponseSchema,
    DeleteMsSqlServerSchema
} from './schemas/database-schemas';
import {
    getDataBasesSummary,
    getResourceUtilisation,
    removeMsSqlServerResourceFromTenancy
} from '../operations/mssql/mssql-operations';

const MSSQL_DELETE_API_PATH: string = '/v1/mssql/:resourceId';

const MSSQL_DATA_API_PATH: string = '/v1/mssql/resources/:resourceId';

function msSqlServerRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.delete(`${MSSQL_DELETE_API_PATH}`, { schema: DeleteMsSqlServerSchema }, async (request, reply) => {
        const {
            params: { resourceId }
        } = request;

        const response = await removeMsSqlServerResourceFromTenancy(resourceId);
        return reply.send(response);
    });

    server.get(`${MSSQL_DATA_API_PATH}/databases`, { schema: GetDatabasesSchema }, async (request, reply) => {
        const {
            params: { resourceId }
        } = request;
        const response = await getDataBasesSummary(resourceId);
        return reply.send(response);
    });

    server.get(
        `${MSSQL_DATA_API_PATH}/utilization/cpu`,
        { schema: DatabaseUtilisationResponseSchema },
        async (request, reply) => {
            const {
                params: { resourceId }
            } = request;
            const response = await getResourceUtilisation(resourceId, 'cpu');
            return reply.send(response);
        }
    );
}

export { msSqlServerRoutes };
