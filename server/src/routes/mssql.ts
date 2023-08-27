import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    DatabaseUtilisationResponseSchema,
    GetDatabasesSchema,
    GetServerSummarySchema
} from './schemas/database-schemas';
import { getDataBasesSummary, getResourceUtilisation, serverSummary } from '../operations/mssql/mssql-operations';
import { DATABASE_METRIC_TYPE } from '../utils/consts';

const MSSQL_DATA_API_PATH: string = '/v1/mssql/resources/:resourceId';

function msSqlServerRoutes(fastify: FastifyInstance) {
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
    server.get(`${MSSQL_DATA_API_PATH}/databases`, { schema: GetDatabasesSchema }, async (request, reply) => {
        const {
            params: { resourceId }
        } = request;
        const response = await getDataBasesSummary(resourceId);
        return reply.send(response);
    });

    server.get(`${MSSQL_DATA_API_PATH}/summary`, { schema: GetServerSummarySchema }, async (request, reply) => {
        const {
            params: { resourceId }
        } = request;

        const response = await serverSummary(resourceId);
        return reply.send(response);
    });
}

export { msSqlServerRoutes };
