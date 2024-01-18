import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    DatabaseCpuUtilisationResponseSchema,
    DatabaseMemoryUtilisationResponseSchema,
    DatabaseStorageUtilisationResponseSchema,
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
    discoverMsSqlServer,
    deleteResourceById
} from '../operations/workloads/mssql/mssql-operations';
import { DATABASE_METRIC_TYPE /* DatabaseTypes */, DatabaseTypes } from '../utils/consts';

const MSSQL_DISCOVER_API_PATH: string = '/v1/mssql/credentials/:credentialsId/regions/:region';
const MSSQL_DATA_API_PATH: string = '/v1/mssql/resources/:resourceId';

export default function msSqlServerRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post(`${MSSQL_DISCOVER_API_PATH}`, { schema: PostSqlServerSchema }, async request => {
        const {
            params: { accountId, credentialsId, region },
            body: {
                activeNodeInstanceId,
                standbyNodeInstanceId,
                activeNodeInstanceName,
                standbyNodeInstanceName,
                fsxId
            }
        } = request;

        const response = await discoverMsSqlServer(
            accountId,
            credentialsId,
            region,
            DatabaseTypes.MS_SQL_SERVER,
            activeNodeInstanceId,
            activeNodeInstanceName,
            standbyNodeInstanceId, // FIXME: To conclude whether this has to be user input or programmatically detected.
            standbyNodeInstanceName,
            fsxId
        );
        return response;
    });

    server.delete(`${MSSQL_DATA_API_PATH}`, { schema: DeleteDatabaseSchema }, async request => {
        const {
            params: { accountId, resourceId }
        } = request;

        const response = await deleteResourceById(accountId, resourceId);
        return response;
    });

    server.get(
        `${MSSQL_DATA_API_PATH}/utilization/cpu`,
        { schema: DatabaseCpuUtilisationResponseSchema },
        async request => {
            const {
                params: { resourceId }
            } = request;
            const response = await getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.CPU);
            return response;
        }
    );

    server.get(
        `${MSSQL_DATA_API_PATH}/utilization/memory`,
        { schema: DatabaseMemoryUtilisationResponseSchema },
        async request => {
            const {
                params: { resourceId }
            } = request;
            const response = await getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.MEMORY);
            return response;
        }
    );

    server.get(
        `${MSSQL_DATA_API_PATH}/utilization/disk`,
        { schema: DatabaseStorageUtilisationResponseSchema },
        async request => {
            const {
                params: { resourceId }
            } = request;
            const response = await getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.DISK);
            return response;
        }
    );

    server.get(`${MSSQL_DATA_API_PATH}/databases`, { schema: GetDatabasesSchema }, async request => {
        const {
            params: { resourceId }
        } = request;
        const response = await getDataBasesSummary(resourceId);
        return response;
    });

    server.get(`${MSSQL_DATA_API_PATH}/summary`, { schema: GetServerSummarySchema }, async request => {
        const {
            params: { resourceId }
        } = request;

        const response = await getServerSummary(resourceId);
        return response;
    });

    server.get(`${MSSQL_DATA_API_PATH}/databases/:databaseName/tables`, { schema: GetTablesSchema }, async request => {
        const {
            params: { resourceId, databaseName }
        } = request;
        const response = await getTablesSummary(resourceId, databaseName);
        return response;
    });
}
