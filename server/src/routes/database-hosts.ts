import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    getDatabaseHostsSummaryV2,
    getDatabaseHostSummaryV2,
    getDatabaseHostInstanceSummary,
    getDatabasesV2
} from '../operations/database-hosts-operations';
import { deployDatabase, getCollationDetails, getDriveInfo } from '../operations/createdb-operations';
import {
    DatabasesCreateSchema,
    DatabaseHostsSummarySchemaV2,
    DatabaseHostDetailsSchemaV2,
    DatabaseHostInstanceDetailsSchema,
    DatabasesListSchemaV2,
    GetDriveInfoSchemaV2,
    GetCollationDetailsSchemaV2,
    PgSqlDbHostDetailsSchema,
    PgSqlDbHostsSummarySchema,
    DatabaseHostDiagramSchema,
    oracleDbHostDetailsSchema,
    OracleDbHostsSummarySchema
} from './schemas/database-hosts-schemas';
import { DatabaseTypes } from '../utils/consts';
import castRequest from './utils';
import getDiagramOfDatabaseHost from '../operations/diagrams/diagram-operations';
import { getOracleDatabaseHostInstanceSummary } from '../operations/workloads/oracle/oracle-operations';
import { IS_PROD } from '../utils/utils';

const MSSQL_API_PREFIX_PATH = '/v1/mssql/credentials/:credentialsId/regions/:region';
const PGSQL_API_PREFIX_PATH = '/v1/pgsql/credentials/:credentialsId/regions/:region';
const ORACLE_API_PREFIX_PATH = '/v1/oracle/credentials/:credentialsId/regions/:region';

export default function databaseHostsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database`,
            { schema: DatabasesCreateSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region },
                    body: { databaseName, dataFileConfig, logFileConfig, collation, databaseInstanceId }
                } = castRequest(request);
                const response = await deployDatabase(
                    accountId,
                    databaseHostId,
                    credentialsId,
                    region,
                    databaseName,
                    dataFileConfig,
                    logFileConfig,
                    collation,
                    databaseInstanceId
                );
                return reply.code(202).send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/collation`,
            { schema: GetCollationDetailsSchemaV2 },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId }
                } = castRequest(request);
                const response = await getCollationDetails(
                    accountId,
                    databaseHostId,
                    credentialsId,
                    region,
                    databaseInstanceId
                );
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts`,
            { schema: DatabaseHostsSummarySchemaV2 },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region },
                    query: { fields, nextToken, vpcId, fsxId, pageSize }
                } = castRequest(request);
                const response = await getDatabaseHostsSummaryV2(
                    accountId,
                    region,
                    credentialsId,
                    fields,
                    nextToken,
                    vpcId,
                    fsxId,
                    pageSize
                );
                return reply.send(response);
            }
        )
        .get(
            `${PGSQL_API_PREFIX_PATH}/database-hosts`,
            { schema: PgSqlDbHostsSummarySchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region },
                    query: { fields, nextToken, vpcId, fsxId, pageSize }
                } = castRequest(request);
                const response = await getDatabaseHostsSummaryV2(
                    accountId,
                    region,
                    credentialsId,
                    fields,
                    nextToken,
                    vpcId,
                    fsxId,
                    pageSize,
                    DatabaseTypes.PG_SQL
                );
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId`,
            { schema: DatabaseHostDetailsSchemaV2 },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId },
                    query: { fields }
                } = castRequest(request);
                const response = await getDatabaseHostSummaryV2(
                    accountId,
                    databaseHostId,
                    credentialsId,
                    region,
                    fields
                );
                return reply.send(response);
            }
        )
        .get(
            `${PGSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId`,
            { schema: PgSqlDbHostDetailsSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId },
                    query: { fields }
                } = castRequest(request);
                const response = await getDatabaseHostSummaryV2(
                    accountId,
                    databaseHostId,
                    credentialsId,
                    region,
                    fields
                );
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId`,
            { schema: DatabaseHostInstanceDetailsSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    query: { fields }
                } = castRequest(request);
                const response = await getDatabaseHostInstanceSummary(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    fields
                );
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/databases`,
            { schema: DatabasesListSchemaV2 },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    query: { fields }
                } = castRequest(request);
                const response = await getDatabasesV2(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    fields
                );
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/drive-information`,
            { schema: GetDriveInfoSchemaV2 },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { forSandbox }
                } = castRequest(request);
                const response = await getDriveInfo(
                    accountId,
                    databaseHostId,
                    credentialsId,
                    region,
                    forSandbox,
                    undefined,
                    databaseInstanceId
                );
                return reply.send(response);
            }
        )
        .get(
            `${ORACLE_API_PREFIX_PATH}/database-hosts/:databaseHostId`,
            { schema: oracleDbHostDetailsSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId },
                    query: { fields }
                } = castRequest(request);
                const response = await getDatabaseHostSummaryV2(
                    accountId,
                    databaseHostId,
                    credentialsId,
                    region,
                    fields
                );
                return reply.send(response);
            }
        )
        .get(
            `${ORACLE_API_PREFIX_PATH}/database-hosts`,
            { schema: OracleDbHostsSummarySchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region },
                    query: { fields, nextToken, vpcId, fsxId, pageSize }
                } = castRequest(request);
                const response = await getDatabaseHostsSummaryV2(
                    accountId,
                    region,
                    credentialsId,
                    fields,
                    nextToken,
                    vpcId,
                    fsxId,
                    pageSize,
                    DatabaseTypes.ORACLE
                );
                return reply.send(response);
            }
        )
        .get(
            `${ORACLE_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId`,
            { schema: DatabaseHostInstanceDetailsSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    query: { fields }
                } = castRequest(request);
                const response = await getOracleDatabaseHostInstanceSummary(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    fields
                );
                return reply.send(response);
            }
        );

    if (!IS_PROD) {
        server.post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/generate-diagram`,
            { schema: DatabaseHostDiagramSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId }
                } = castRequest(request);
                const response = await getDiagramOfDatabaseHost(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    request.id
                );

                if (response.error) {
                    return reply.code(500).send({ error: response.error });
                }

                return reply
                    .header('Content-Type', 'image/png')
                    .header('Content-Disposition', 'attachment; filename="diagram.png"')
                    .send(response.file);
            }
        );
    }
}
