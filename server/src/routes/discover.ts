import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { DiscoverMsSqlSchema, DiscoverCredentialsSchema } from './schemas/discover-schemas';
import { getHostAndSqlServerInfo, saveDiscoveredParameters } from '../operations/discover-operations';

import getLogger from '../utils/logger';

const logger = getLogger();

const DISCOVER_MSSQL_API_PATH: string = '/v1/credentials/:credentialsId/regions/:region';

export default function discoverRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${DISCOVER_MSSQL_API_PATH}/mssql/discover`, { schema: DiscoverMsSqlSchema }, async request => {
        const {
            params: { accountId, credentialsId, region },
            query: { nextToken }
        } = request;

        const startTime = performance.now();
        const apiInfo = await getHostAndSqlServerInfo(accountId, credentialsId, region, nextToken);
        const endTime = performance.now();
        logger.info(`Time taken to collect information for ${apiInfo.count} records: ${endTime - startTime}ms`);
        return apiInfo;
    });

    server.post(
        `${DISCOVER_MSSQL_API_PATH}/instances/:instanceId/mssql/discover/resource-credentials`,
        { schema: DiscoverCredentialsSchema },
        async request => {
            const {
                params: { accountId, credentialsId, region, instanceId },
                body: { credentials }
            } = request;

            return saveDiscoveredParameters(accountId, credentialsId, region, instanceId, credentials);
        }
    );
}
