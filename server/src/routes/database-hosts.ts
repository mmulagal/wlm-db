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
        .post(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/database`,
            { schema: DatabasesCreateSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region },
                    body: {
                        databaseName,
                        dataFileConfig: {
                            fileName: dataFileName,
                            volumeSize: dataVolumeSize,
                            drive: dataDrive,
                            isExisting: isDataDriveExists
                        },
                        logFileConfig: {
                            fileName: logFileName,
                            volumeSize: logVolumeSize,
                            drive: logDrive,
                            isExisting: isLogDriveExists
                        }
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
                    isDataDriveExists,
                    isLogDriveExists
                );
                return reply.send(response);
            }
        );
}
