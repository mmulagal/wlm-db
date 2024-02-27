import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    getDatabaseHostsSummary,
    getDatabaseHostSummary,
    getDatabases,
    deployDatabase,
    getDriveInfo,
    getManagedResources
} from '../operations/database-hosts-operations';
import {
    DatabaseHostDetailsSchema,
    DatabasesListSchema,
    DatabaseHostsSummarySchema,
    DatabasesCreateSchema,
    GetDriveInfoSchema,
    GetManagedResourcesSchema
} from './schemas/database-hosts-schemas';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';

export default function databaseHostsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .get(`${API_PREFIX_PATH}/database-hosts`, { schema: DatabaseHostsSummarySchema }, async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                query: { fields, nextToken }
            } = request;
            const response = await getDatabaseHostsSummary(accountId, fields, nextToken, region, credentialsId);
            return reply.send(response);
        })
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId`,
            { schema: DatabaseHostDetailsSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId },
                    query: { fields }
                } = request;
                const response = await getDatabaseHostSummary(accountId, databaseHostId, fields);
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/databases`,
            { schema: DatabasesListSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId }
                } = request;
                const response = await getDatabases(accountId, databaseHostId);
                return reply.send(response);
            }
        )
        .post(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/database`,
            { schema: DatabasesCreateSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region },
                    body: { databaseName, dataFileConfig, logFileConfig }
                } = request;
                const response = await deployDatabase(
                    accountId,
                    databaseHostId,
                    credentialsId,
                    region,
                    databaseName,
                    dataFileConfig,
                    logFileConfig
                );
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/drive-information`,
            { schema: GetDriveInfoSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region }
                } = request;
                const response = await getDriveInfo(accountId, databaseHostId, credentialsId, region);
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/managed-resources`,
            { schema: GetManagedResourcesSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region }
                } = request;
                const response = await getManagedResources(accountId, credentialsId, region);
                return reply.send(response);
            }
        );
}
