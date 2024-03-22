import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { STORAGE_TYPE } from '@prisma/client';
import {
    DatabaseResourcesUtilisationResponseSchema,
    GetDatabasesSchema,
    GetServerSummarySchema,
    GetTablesSchema,
    DeleteDatabaseSchema,
    PostSqlServerSchema,
    DatabaseMemoryUtilisationResponseSchema,
    DatabaseCpuUtilisationResponseSchema,
    DatabaseStorageUtilisationResponseSchema
} from './schemas/database-schemas';
import {
    getDataBasesSummary,
    getResourceUtilisation,
    getServerSummary,
    getTablesSummary,
    discoverMsSqlServer,
    deleteResourceById,
    getAllResourceUtilisation
} from '../operations/workloads/mssql/mssql-operations';
import { DATABASE_METRIC_TYPE, DatabaseTypes } from '../utils/consts';

const MSSQL_DISCOVER_API_PATH: string = '/v1/mssql/credentials/:credentialsId/regions/:region';
const MSSQL_DATA_API_PATH: string = '/v1/mssql/resources/:resourceId';

export default function msSqlServerRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post(`${MSSQL_DISCOVER_API_PATH}`, { schema: PostSqlServerSchema }, async request => {
        const {
            params: { accountId, credentialsId, region },
            body: { activeNodeInstanceId, standbyNodeInstanceId, fsxId }
        } = request;

        return discoverMsSqlServer(
            accountId,
            credentialsId,
            region,
            DatabaseTypes.MS_SQL_SERVER,
            STORAGE_TYPE.FSXN,
            activeNodeInstanceId,
            standbyNodeInstanceId, // FIXME: To conclude whether this has to be user input or programmatically detected.
            fsxId
        );
    });

    server.delete(`${MSSQL_DATA_API_PATH}`, { schema: DeleteDatabaseSchema }, async request => {
        const {
            params: { accountId, resourceId }
        } = request;

        return deleteResourceById(accountId, resourceId);
    });

    server.get(
        `${MSSQL_DATA_API_PATH}/utilization/cpu`,
        { schema: DatabaseCpuUtilisationResponseSchema },
        async request => {
            const {
                params: { resourceId }
            } = request;
            return getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.CPU);
        }
    );

    server.get(
        `${MSSQL_DATA_API_PATH}/utilization/memory`,
        { schema: DatabaseMemoryUtilisationResponseSchema },
        async request => {
            const {
                params: { resourceId }
            } = request;
            return getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.MEMORY);
        }
    );

    server.get(
        `${MSSQL_DATA_API_PATH}/utilization/disk`,
        { schema: DatabaseStorageUtilisationResponseSchema },
        async request => {
            const {
                params: { resourceId }
            } = request;
            return getResourceUtilisation(resourceId, DATABASE_METRIC_TYPE.DISK);
        }
    );

    server.get(
        `${MSSQL_DATA_API_PATH}/resources-utilization`,
        { schema: DatabaseResourcesUtilisationResponseSchema },
        async request => {
            const {
                params: { resourceId }
            } = request;
            return getAllResourceUtilisation(resourceId);
        }
    );

    server.get(`${MSSQL_DATA_API_PATH}/databases`, { schema: GetDatabasesSchema }, async request => {
        const {
            params: { resourceId }
        } = request;
        return getDataBasesSummary(resourceId);
    });

    server.get(`${MSSQL_DATA_API_PATH}/summary`, { schema: GetServerSummarySchema }, async request => {
        const {
            params: { resourceId }
        } = request;

        return getServerSummary(resourceId);
    });

    server.get(`${MSSQL_DATA_API_PATH}/databases/:databaseName/tables`, { schema: GetTablesSchema }, async request => {
        const {
            params: { resourceId, databaseName }
        } = request;
        return getTablesSummary(resourceId, databaseName);
    });
}
