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
    CreateSandboxSchema,
    GetSandboxSavingsSchema,
    GetSandboxesInfoSchema,
    GetSandboxesMountPointSchema,
    GetSandboxConnectionStringSchema,
    DeleteSandboxSchema,
    GetSandboxSplitEstimateSchema,
    SandboxLifeCycleSchema,
    SandboxSplitSchema,
    DatabaseHostsSummarySchemaV2,
    CheckSandboxIntegritySchema,
    DatabaseHostDetailsSchemaV2,
    DatabaseHostInstanceDetailsSchema,
    DatabasesListSchemaV2,
    GetSandboxSnapshotsSchema,
    GetDriveInfoSchemaV2,
    GetCollationDetailsSchemaV2,
    PgSqlDbHostDetailsSchema,
    PgSqlDbHostsSummarySchema
} from './schemas/database-hosts-schemas';
import {
    createSandbox,
    getSandboxConnectionString,
    getSandboxesInfo,
    getDatabaseMountPointInfo,
    getSandboxSavings,
    deleteSandbox,
    getSandboxSplitEstimate,
    updateSandboxLifeCycle,
    splitSandbox,
    checkDatabaseIntegrity,
    getSandboxSnapshots
} from '../operations/sandbox-operations';
import { DatabaseTypes } from '../utils/consts';

const MSSQL_API_PREFIX_PATH = '/v1/mssql/credentials/:credentialsId/regions/:region';
const PGSQL_API_PREFIX_PATH = '/v1/pgsql/credentials/:credentialsId/regions/:region';

export default function databaseHostsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        // TODO: Accept instance id, database name as query params for more granularity
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/sandboxes/savings`,
            { schema: GetSandboxSavingsSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region }
                } = request;
                const response = await getSandboxSavings(accountId, credentialsId, region);
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database`,
            { schema: DatabasesCreateSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region },
                    body: { databaseName, dataFileConfig, logFileConfig, collation, databaseInstanceId }
                } = request;
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
                } = request;
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
        // TODO: Accept instance id as query params for more granularity
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/sandboxes`,
            { schema: GetSandboxesInfoSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region },
                    query: { nextToken }
                } = request;
                const response = await getSandboxesInfo(accountId, credentialsId, region, nextToken);
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-mount-points`,
            { schema: GetSandboxesMountPointSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId },
                    query: { databaseName, databaseInstanceId }
                } = request;
                const response = await getDatabaseMountPointInfo(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    databaseName
                );
                return reply.send(response);
            }
        )
        .post(`${MSSQL_API_PREFIX_PATH}/sandboxes`, { schema: CreateSandboxSchema }, async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                body: { source, destination, tag, mountPoints }
            } = request;
            const response = await createSandbox(
                accountId,
                credentialsId,
                region,
                source,
                destination,
                tag,
                mountPoints
            );
            return reply.code(202).send(response);
        })
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/sandboxes/:sandboxName/connection-string`,
            { schema: GetSandboxConnectionStringSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId, sandboxName }
                } = request;
                const response = await getSandboxConnectionString(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    sandboxName
                );
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/sandboxes/:sandboxName/split-estimate`,
            { schema: GetSandboxSplitEstimateSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId, sandboxName }
                } = request;
                const response = await getSandboxSplitEstimate(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    sandboxName
                );
                return reply.send({ volumes: response });
            }
        )
        .delete(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/sandboxes/:sandboxName`,
            { schema: DeleteSandboxSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId, sandboxName }
                } = request;
                const response = await deleteSandbox(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    sandboxName
                );
                return reply.code(202).send(response);
            }
        )
        .patch(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/sandboxes/:sandboxName`,
            { schema: SandboxLifeCycleSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId, sandboxName },
                    body: { snapshot, action }
                } = request;
                const response = await updateSandboxLifeCycle(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    sandboxName,
                    action,
                    snapshot
                );
                return reply.code(202).send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/sandboxes/:sandboxName/split`,
            { schema: SandboxSplitSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId, sandboxName }
                } = request;
                const response = await splitSandbox(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    sandboxName
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
                } = request;
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
                } = request;
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
                } = request;
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
                } = request;
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
                } = request;
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
                } = request;
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
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/sandboxes/:sandboxName/check-integrity`,
            { schema: CheckSandboxIntegritySchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, sandboxName, databaseInstanceId }
                } = request;
                const response = await checkDatabaseIntegrity(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    sandboxName
                );
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/sandboxes/:sandboxName/snapshots`,
            { schema: GetSandboxSnapshotsSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, sandboxName, databaseInstanceId },
                    query: { historical }
                } = request;
                const response = await getSandboxSnapshots(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    sandboxName,
                    historical
                );
                return reply.send({ snapshots: response });
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/drive-information`,
            { schema: GetDriveInfoSchemaV2 },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { forSandbox }
                } = request;
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
        );
}
