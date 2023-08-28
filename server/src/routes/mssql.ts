import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { DatabaseUtilisationResponseSchema, GetDatabasesSchema } from './schemas/database-schemas';
import { getDataBasesSummary, getResourceUtilisation } from '../operations/workloads/mssql/mssql-operations';
import { DATABASE_METRIC_TYPE } from '../utils/consts';

const MSSQL_DATA_API_PATH: string = '/v1/mssql/resources/:resourceId';

export default function mssqlRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
    server.get(
        `${MSSQL_DATA_API_PATH}/utilization/cpu`,
        { schema: DatabaseUtilisationResponseSchema },
        async (request, reply) => {
            const {
                params: { resourceId }
            } = request;
            const response = await getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.CPU);
            return reply.send(response);
        }
    );

    server.get(
        `${MSSQL_DATA_API_PATH}/utilization/memory`,
        { schema: DatabaseUtilisationResponseSchema },
        async (request, reply) => {
            const {
                params: { resourceId }
            } = request;
            const response = await getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.MEMORY);
            return reply.send(response);
        }
    );

    server.get(`${MSSQL_DATA_API_PATH}/databases`, { schema: GetDatabasesSchema }, async (request, reply) => {
        const {
            params: { resourceId }
        } = request;
        const response = await getDataBasesSummary(resourceId);
        return reply.send(response);
    });
}
