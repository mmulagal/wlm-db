import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { DiscoverMsSqlSchema } from './schemas/discover-schemas';
import { getHostAndSqlServerInfo } from '../operations/discover-operations';
import getLogger from '../utils/logger';

const logger = getLogger();

const DISCOVER_MSSQL_API_PATH: string = '/v1/mssql/credentials/:credentialsId/regions/:region';

export default function discoverRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${DISCOVER_MSSQL_API_PATH}/discover`, { schema: DiscoverMsSqlSchema }, async request => {
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
}
