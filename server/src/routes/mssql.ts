import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    DatabaseUtilisationResponseSchema,
    GetDatabasesSchema,
    GetServerSummarySchema,
    GetTablesSchema,
    DeleteDatabaseSchema,
    PostSqlServerSchema
} from './schemas/database-schemas';
import {
    getDataBasesSummary,
    getResourceUtilisation,
    getServerSummary,
    getTablesSummary,
    discoverMsSqlServer
} from '../operations/workloads/mssql/mssql-operations';
import { removeTenancyResource } from '../operations/tenancy-operations';
import { DATABASE_METRIC_TYPE /* DatabaseTypes */, DatabaseTypes } from '../utils/consts';

const MSSQL_DISCOVER_API_PATH: string = '/v1/mssql/credentials/:credentialsId/regions/:regionId';
const MSSQL_DATA_API_PATH: string = '/v1/mssql/resources/:resourceId';

export default function msSqlServerRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post(`${MSSQL_DISCOVER_API_PATH}`, { schema: PostSqlServerSchema }, async (request, reply) => {
        const {
            params: { accountId, credentialsId, regionId },
            body: { activeInstanceId, standbyInstanceId }
        } = request;

        const response = await discoverMsSqlServer(
            accountId,
            credentialsId,
            regionId,
            activeInstanceId,
            standbyInstanceId, // FIXME: To conclude whether this has to be user input or programmatically detected.
            DatabaseTypes.MS_SQL_SERVER
        );
        return reply.send(response);
    });

    server.delete(`${MSSQL_DATA_API_PATH}`, { schema: DeleteDatabaseSchema }, async (request, reply) => {
        const {
            params: { resourceId }
        } = request;

        const response = await removeTenancyResource(resourceId);
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

    server.get(
        `${MSSQL_DATA_API_PATH}/utilization/disk`,
        { schema: DatabaseUtilisationResponseSchema },
        async (request, reply) => {
            const {
                params: { resourceId }
            } = request;
            const response = await getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.DISK);
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

        const response = await getServerSummary(resourceId);
        return reply.send(response);
    });

    server.get(
        `${MSSQL_DATA_API_PATH}/databases/:databaseName/tables`,
        { schema: GetTablesSchema },
        async (request, reply) => {
            const {
                params: { resourceId, databaseName }
            } = request;
            const response = await getTablesSummary(resourceId, databaseName);
            return reply.send(response);
        }
    );
}
