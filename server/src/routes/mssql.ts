import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { DatabaseUtilisationResponseSchema, GetDatabasesSchema, PostSqlServerSchema } from './schemas/database-schemas';
import { getDataBasesSummary, getResourceUtilisation, discoverMsSqlServer } from '../operations/mssql/mssql-operations';
import { DATABASE_METRIC_TYPE, DatabaseTypes } from '../utils/consts';

const MSSQL_DISCOVER_API_PATH: string =
    '/v1/credentials/:credentialsId/regions/:regionId/ec2instances/:ec2InstanceId/mssql';
const MSSQL_DATA_API_PATH: string = '/v1/mssql/resources/:resourceId';

export default function mssqlRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post(`${MSSQL_DISCOVER_API_PATH}`, { schema: PostSqlServerSchema }, async (request, reply) => {
        const {
            params: { accountId, credentialsId, regionId, ec2InstanceId }
        } = request;

        const response = await discoverMsSqlServer(
            accountId,
            credentialsId,
            regionId,
            ec2InstanceId,
            DatabaseTypes.MS_SQL_SERVER
        );
        return reply.send(response);
    });

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
}
