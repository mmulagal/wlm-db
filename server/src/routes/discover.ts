import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    DiscoverMsSqlSchema,
    DiscoverCredentialsSchema,
    MsSqlInstancesSchema,
    ManageMsSqlSchema
} from './schemas/discover-schemas';
import {
    fetchUnmanagedHostsInformation,
    getHostAndSqlServerInfo,
    manageSqlServer,
    validateAndStoreDiscoveredParameters
} from '../operations/discover-operations';

import getLogger from '../utils/logger';

const logger = getLogger();

const DISCOVER_MSSQL_API_PATH: string = '/v1/credentials/:credentialsId/regions/:region';

export default function discoverRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${DISCOVER_MSSQL_API_PATH}/mssql/discover`, { schema: DiscoverMsSqlSchema }, async request => {
        const {
            params: { accountId, credentialsId, region },
            query: { pageSize, nextToken }
        } = request;

        const startTime = performance.now();
        const apiInfo = await getHostAndSqlServerInfo(accountId, credentialsId, region, pageSize, nextToken);
        const endTime = performance.now();
        logger.info(`API1Performance: Time taken to collect data for ${apiInfo.count} EC2s: ${endTime - startTime}ms`);
        return apiInfo;
    });

    server.post(
        `${DISCOVER_MSSQL_API_PATH}/instances/:instanceId/mssql/manage`,
        { schema: ManageMsSqlSchema },
        async request => {
            const {
                params: { accountId, credentialsId, region, instanceId }
            } = request;
            const startTime = performance.now();
            const apiInfo = await manageSqlServer(accountId, credentialsId, region, instanceId);
            const endTime = performance.now();
            logger.info(`API3Performance: Time taken to manage EC2 instance(s):', ${endTime - startTime}ms`);
            return apiInfo;
        }
    );

    server.post(
        `${DISCOVER_MSSQL_API_PATH}/instances/:instanceId/mssql/discover/resource-credentials`,
        { schema: DiscoverCredentialsSchema },
        async request => {
            const {
                params: { accountId, credentialsId, region, instanceId },
                body: { credentials }
            } = request;

            return validateAndStoreDiscoveredParameters(accountId, credentialsId, region, instanceId, credentials);
        }
    );

    server.get(`${DISCOVER_MSSQL_API_PATH}/mssql/instances`, { schema: MsSqlInstancesSchema }, async request => {
        const {
            params: { accountId, credentialsId, region },
            query: { instances }
        } = request;

        return fetchUnmanagedHostsInformation(accountId, credentialsId, region, instances.split(','));
    });
}
