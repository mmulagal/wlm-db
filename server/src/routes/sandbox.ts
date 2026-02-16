import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import castRequest from './utils';
import {
    checkDatabaseIntegrity,
    createSandbox,
    deleteSandbox,
    getDatabaseMountPointInfo,
    getSandboxConnectionString,
    getSandboxesInfo,
    getSandboxInfoByInstanceId,
    getSandboxSavings,
    getSandboxSnapshots,
    getSandboxSplitEstimate,
    splitSandbox,
    updateSandboxLifeCycle
} from '../operations/sandbox-operations';
import {
    CheckSandboxIntegritySchema,
    CreateSandboxSchema,
    DeleteSandboxSchema,
    GetSandboxConnectionStringSchema,
    GetSandboxesInfoPerInstanceSchema,
    GetSandboxesInfoSchema,
    GetSandboxesMountPointSchema,
    GetSandboxSavingsSchema,
    GetSandboxSnapshotsSchema,
    GetSandboxSplitEstimateSchema,
    SandboxLifeCycleSchema,
    SandboxSplitSchema
} from './schemas/sandbox-schemas';

const MSSQL_API_PREFIX_PATH = '/v1/mssql/credentials/:credentialsId/regions/:region';

export default function sandboxRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        // TODO: Accept instance id, database name as query params for more granularity
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/sandboxes/savings`,
            { schema: GetSandboxSavingsSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region }
                } = castRequest(request);
                const response = await getSandboxSavings(accountId, credentialsId, region);
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/sandboxes`,
            { schema: GetSandboxesInfoSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region },
                    query: { nextToken }
                } = castRequest(request);
                const response = await getSandboxesInfo(accountId, credentialsId, region, nextToken);
                return reply.send(response || { count: 0, items: [], nextToken: undefined });
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/sandboxes`,
            { schema: GetSandboxesInfoPerInstanceSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId }
                } = castRequest(request);
                const response = await getSandboxInfoByInstanceId(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId
                );
                return reply.send(response);
            }
        )
        .post(`${MSSQL_API_PREFIX_PATH}/sandboxes`, { schema: CreateSandboxSchema }, async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                body: { source, destination, tag, mountPoints }
            } = castRequest(request);
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
                } = castRequest(request);
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
                } = castRequest(request);
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
                } = castRequest(request);
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
                } = castRequest(request);
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
                } = castRequest(request);
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
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-mount-points`,
            { schema: GetSandboxesMountPointSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId },
                    query: { databaseName, databaseInstanceId }
                } = castRequest(request);
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
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/sandboxes/:sandboxName/check-integrity`,
            { schema: CheckSandboxIntegritySchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, sandboxName, databaseInstanceId }
                } = castRequest(request);
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
                } = castRequest(request);
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
        );
}
