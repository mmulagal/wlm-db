import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    getDatabaseHostsSummary,
    getDatabaseHostSummary,
    getDatabases,
    getDriveInfo
} from '../operations/database-hosts-operations';
import {
    DatabaseHostDetailsSchema,
    DatabasesListSchema,
    DatabaseHostsSummarySchema,
    GetDriveInfoSchema
} from './schemas/database-hosts-schemas';

const DATABASE_HOSTS_API_PATH = '/v1/database-hosts';
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
            `${DATABASE_HOSTS_API_PATH}/:databaseHostId`,
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
            `${DATABASE_HOSTS_API_PATH}/:databaseHostId/databases`,
            { schema: DatabasesListSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId }
                } = request;
                const response = await getDatabases(accountId, databaseHostId);
                return reply.send(response);
            }
        )
        .get(
            `${DATABASE_HOSTS_API_PATH}/:databaseHostId/driveInfo`,
            { schema: GetDriveInfoSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId }
                } = request;
                const response = await getDriveInfo(accountId, databaseHostId);
                return reply.send(response);
            }
        );
}
