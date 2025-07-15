import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    DiscoverMsSqlSchema,
    MsSqlInstancesSchema,
    UnManageMsSqlSchema,
    DiscoverPgSqlSchema,
    PgSqlResourceDetailsSchema,
    DiscoverOracleSchema,
    UnManagePgSqlSchema,
    OracleResourceDetailsSchema,
    UnmanageOracleSchema
} from './schemas/discover-schemas';
import {
    getHostAndSqlServerInfo,
    fetchUnmanagedHostsInformationV2,
    unmanageDatabaseInstance,
    discoverPgSqlResources,
    getPgSqlResourceDetails,
    discoverOracleResources,
    getOracleResourceDetails
} from '../operations/discover-operations';

import getLogger from '../utils/logger';
import castRequest from './utils';

const logger = getLogger();

const DISCOVER_MSSQL_API_PATH: string = '/v1/mssql/credentials/:credentialsId/regions/:region';
const DISCOVER_PGSQL_API_PATH: string = '/v1/pgsql/credentials/:credentialsId/regions/:region';
const DISCOVER_ORACLE_API_PATH: string = '/v1/oracle/credentials/:credentialsId/regions/:region';

export default function discoverRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${DISCOVER_MSSQL_API_PATH}/discover`, { schema: DiscoverMsSqlSchema }, async request => {
        const {
            params: { accountId, credentialsId, region },
            query: { pageSize, nextToken }
        } = castRequest(request);

        const startTime = performance.now();
        const apiInfo = await getHostAndSqlServerInfo(accountId, credentialsId, region, pageSize, nextToken);
        const endTime = performance.now();
        logger.info(`API1Performance: Time taken to collect data for ${apiInfo.count} EC2s: ${endTime - startTime}ms`);
        return apiInfo;
    });

    server.get(`${DISCOVER_MSSQL_API_PATH}/instances`, { schema: MsSqlInstancesSchema }, async request => {
        const {
            params: { accountId, credentialsId, region },
            query: { instances, fields }
        } = castRequest(request);

        return fetchUnmanagedHostsInformationV2(accountId, credentialsId, region, instances.split(','), fields);
    });

    server.delete(
        '/v1/mssql/credentials/:credentialsId/resources/:resourceId/instances',
        { schema: UnManageMsSqlSchema },
        async request => {
            const {
                params: { accountId, credentialsId, resourceId },
                query: { databaseInstanceIds }
            } = castRequest(request);

            const response = await unmanageDatabaseInstance(
                accountId,
                credentialsId,
                resourceId,
                databaseInstanceIds || ''
            );
            return response;
        }
    );

    // PostgreSQL
    server.get(`${DISCOVER_PGSQL_API_PATH}/discover`, { schema: DiscoverPgSqlSchema }, async request => {
        const {
            params: { accountId, credentialsId, region },
            query: { pageSize, nextToken }
        } = castRequest(request);

        const apiInfo = await discoverPgSqlResources(accountId, credentialsId, region, pageSize, nextToken);
        return apiInfo;
    });

    server.get(
        `${DISCOVER_PGSQL_API_PATH}/resource-details`,
        { schema: PgSqlResourceDetailsSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                query: { instances, fields }
            } = castRequest(request);

            const apiInfo = await getPgSqlResourceDetails(accountId, credentialsId, region, instances, fields);
            return reply.send(apiInfo);
        }
    );

    server.delete(
        '/v1/pgsql/credentials/:credentialsId/resources/:resourceId/instances',
        { schema: UnManagePgSqlSchema },
        async request => {
            const {
                params: { accountId, credentialsId, resourceId },
                query: { databaseInstanceIds }
            } = castRequest(request);

            const response = await unmanageDatabaseInstance(
                accountId,
                credentialsId,
                resourceId,
                databaseInstanceIds ?? ''
            );
            return response;
        }
    );

    // Oracle
    server.get(`${DISCOVER_ORACLE_API_PATH}/discover`, { schema: DiscoverOracleSchema }, async request => {
        const {
            params: { accountId, credentialsId, region },
            query: { pageSize, nextToken }
        } = castRequest(request);
        const apiInfo = await discoverOracleResources(accountId, credentialsId, region, pageSize, nextToken);
        return apiInfo;
    });

    server.get(
        `${DISCOVER_ORACLE_API_PATH}/resource-details`,
        { schema: OracleResourceDetailsSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                query: { instances, fields }
            } = castRequest(request);

            const apiInfo = await getOracleResourceDetails(accountId, credentialsId, region, instances, fields);
            return reply.send(apiInfo);
        }
    );

    server.delete(
        '/v1/oracle/credentials/:credentialsId/resources/:resourceId/instances',
        { schema: UnmanageOracleSchema },
        async request => {
            const {
                params: { accountId, credentialsId, resourceId },
                query: { databaseInstanceIds }
            } = castRequest(request);

            const response = await unmanageDatabaseInstance(
                accountId,
                credentialsId,
                resourceId,
                databaseInstanceIds ?? ''
            );
            return response;
        }
    );
}
