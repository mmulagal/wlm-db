import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    getDatabaseHostsSummary,
    getDatabaseHostSummary,
    getDatabases,
    deployDatabase
} from '../operations/database-hosts-operations';
import {
    DatabaseHostDetailsSchema,
    DatabasesListSchema,
    DatabaseHostsSummarySchema,
    DatabasesCreateSchema
} from './schemas/database-hosts-schemas';

const DATABASE_HOSTS_API_PATH: string = '/v1/database-hosts';
const MSSQL_DATABASE_HOSTS_API_PATH: string =
    '/v1/credentials/:credentialsId/regions/:region/database-hosts/:databaseHostId';

export default function databaseHostsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .get(`${DATABASE_HOSTS_API_PATH}`, { schema: DatabaseHostsSummarySchema }, async (request, reply) => {
            const {
                params: { accountId },
                query: { fields, nextToken }
            } = request;
            const response = await getDatabaseHostsSummary(accountId, fields, nextToken);
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
        .post(
            `${MSSQL_DATABASE_HOSTS_API_PATH}/database`,
            { schema: DatabasesCreateSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region },
                    body: {
                        databaseName,
                        dataFileName,
                        dataVolumeSize,
                        dataDrive,
                        logFileName,
                        logVolumeSize,
                        logDrive,
                        isExisting
                    }
                } = request;
                const response = await deployDatabase(
                    accountId,
                    databaseHostId,
                    credentialsId,
                    region,
                    databaseName,
                    dataFileName,
                    dataVolumeSize,
                    dataDrive,
                    logFileName,
                    logVolumeSize,
                    logDrive,
                    isExisting
                );
                return reply.send(response);
            }
        );
}
