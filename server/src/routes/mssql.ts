import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { STORAGE_TYPE } from '@prisma/client';
import {
    DatabaseResourcesUtilisationResponseSchema,
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
import { DatabaseTypes } from '../utils/consts';

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
        `${MSSQL_DATA_API_PATH}/resources-utilization`,
        { schema: DatabaseResourcesUtilisationResponseSchema },
        async request => {
            const {
                params: { resourceId }
            } = request;
            return getResourceUtilisation(resourceId);
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
