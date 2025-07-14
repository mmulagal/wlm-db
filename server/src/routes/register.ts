import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    PrepareForManageSchema,
    ManageMsSqlSchemaV2,
    JobBasedManageSchema,
    RegisterCredentialsSchema,
    SingleRegisterCredentialsSchema
} from './schemas/register-schema';
import { prepareForManage } from '../operations/discover-operations';

import getLogger from '../utils/logger';
import castRequest from './utils';
import {
    manageSqlServerV2,
    registerResourceCredentials,
    validateAndStoreDiscoveredParameters,
    registerDatabaseServerInstances
} from '../operations/register-operations';
import { SingleRegisterCredentialsResponseType } from './types/register.types';
import { DatabaseTypes } from '../utils/consts';

const logger = getLogger();

const MSSQL_API_PATH: string = '/v1/mssql/credentials/:credentialsId/regions/:region';

export default function registerRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post('/v1/mssql/manage', { schema: ManageMsSqlSchemaV2 }, async request => {
        const {
            params: { accountId },
            body: { items }
        } = castRequest(request);
        logger.info(`Manage SQL Server instances for account ${accountId}, ${items}`);
        const apiInfo = await manageSqlServerV2(accountId, items);
        return apiInfo;
    });

    server.post(
        `${MSSQL_API_PATH}/instances/:instanceId/discover/resource-credentials`,
        { schema: SingleRegisterCredentialsSchema },
        async request => {
            const {
                params: { accountId, credentialsId, region, instanceId },
                body: { credentials, clusterNodesIpAddress, checkManageReadiness }
            } = castRequest(request);

            const response = await validateAndStoreDiscoveredParameters(
                accountId,
                credentialsId,
                region,
                instanceId,
                credentials,
                clusterNodesIpAddress,
                checkManageReadiness,
                true
            );

            return response as SingleRegisterCredentialsResponseType;
        }
    );

    server.post(
        `${MSSQL_API_PATH}/instances/:instanceId/prepare`,
        { schema: PrepareForManageSchema },
        async request => {
            const {
                params: { accountId, credentialsId, region, instanceId }
            } = castRequest(request);

            const apiInfo = await prepareForManage(accountId, credentialsId, region, instanceId);
            return { jobId: apiInfo };
        }
    );

    // Manage job based
    server.post('/v1/mssql/register', { schema: JobBasedManageSchema }, async request => {
        const {
            params: { accountId },
            body: { items }
        } = castRequest(request);
        const response = await registerDatabaseServerInstances(accountId, items, DatabaseTypes.MS_SQL_SERVER);
        return response;
    });

    server.post('/v1/register-credentials', { schema: RegisterCredentialsSchema }, async request => {
        const {
            params: { accountId },
            body: { items }
        } = castRequest(request);

        const response = await registerResourceCredentials(accountId, items);
        return response;
    });

    server.post('/v1/oracle/register', { schema: JobBasedManageSchema }, async request => {
        const {
            params: { accountId },
            body: { items }
        } = castRequest(request);
        const response = await registerDatabaseServerInstances(accountId, items, DatabaseTypes.ORACLE);
        return response;
    });
}
