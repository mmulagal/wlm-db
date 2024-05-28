import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { getDatabaseHostsSummary, getDatabaseHostSummary, getDatabases } from '../operations/database-hosts-operations';
import { deployDatabase, getCollationDetails, getDriveInfo } from '../operations/createdb-operations';
import {
    DatabaseHostDetailsSchema,
    DatabasesListSchema,
    DatabaseHostsSummarySchema,
    DatabasesCreateSchema,
    GetDriveInfoSchema,
    CloneDatabaseHostSchema,
    GetCollationDetailsSchema,
    GetSandboxSavingsSchema,
    GetSandboxesInfoSchema,
    PatchResourceForSandboxSchema,
    RevertPatchResourceForSandboxSchema,
    GetSandboxesMountPointSchema,
    GetSandboxConnectionStringSchema,
    DeleteSandboxSchema,
    GetSandboxSplitEstimateSchema,
    SandboxLifeCycleSchema,
    SandboxSplitSchema
} from './schemas/database-hosts-schemas';
import {
    createSandbox,
    getSandboxConnectionString,
    getSandboxesInfo,
    getDatabaseMountPointInfo,
    getSandboxSavings,
    revertMetadataForSanboxTesting,
    updateMetadataForSanboxTesting,
    deleteSandbox,
    getSandboxSplitEstimate,
    updateSandboxLifeCycle,
    splitSandbox
} from '../operations/sandbox-operations';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';

export default function databaseHostsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .get(`${API_PREFIX_PATH}/database-hosts`, { schema: DatabaseHostsSummarySchema }, async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                query: { fields, nextToken, vpcId, fsxId }
            } = request;
            const response = await getDatabaseHostsSummary(
                accountId,
                fields,
                nextToken,
                region,
                credentialsId,
                vpcId,
                fsxId
            );
            return reply.send(response);
        })
        .get(
            `${API_PREFIX_PATH}/database-hosts/sandboxes/savings`,
            { schema: GetSandboxSavingsSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region }
                } = request;
                const response = await getSandboxSavings(accountId, credentialsId, region);
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId`,
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
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/databases`,
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
                    body: { databaseName, dataFileConfig, logFileConfig, collation }
                } = request;
                const response = await deployDatabase(
                    accountId,
                    databaseHostId,
                    credentialsId,
                    region,
                    databaseName,
                    dataFileConfig,
                    logFileConfig,
                    collation
                );
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/drive-information`,
            { schema: GetDriveInfoSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region },
                    query: { forSandbox }
                } = request;
                const response = await getDriveInfo(accountId, databaseHostId, credentialsId, region, forSandbox);
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/collation`,
            { schema: GetCollationDetailsSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region }
                } = request;
                const response = await getCollationDetails(accountId, databaseHostId, credentialsId, region);
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/sandboxes`,
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
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/database-mount-points`,
            { schema: GetSandboxesMountPointSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId },
                    query: { databaseName, instanceName }
                } = request;
                const response = await getDatabaseMountPointInfo(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseName,
                    instanceName
                );
                return reply.send(response);
            }
        )
        .patch(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/sandboxes-meta-update`,
            { schema: PatchResourceForSandboxSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId }
                } = request;
                const response = await updateMetadataForSanboxTesting(accountId, credentialsId, region, databaseHostId);
                return reply.send(response);
            }
        )
        .patch(
            `${API_PREFIX_PATH}/database-hosts/revert-sandboxes-meta-update`,
            { schema: RevertPatchResourceForSandboxSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region }
                } = request;
                const response = await revertMetadataForSanboxTesting(accountId, credentialsId, region);
                return reply.send(response);
            }
        )
        .post(`${API_PREFIX_PATH}/sandboxes`, { schema: CloneDatabaseHostSchema }, async (request, reply) => {
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
            return reply.send(response);
        })
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/sandboxes/:sandboxName/connection-string`,
            { schema: GetSandboxConnectionStringSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, sandboxName }
                } = request;
                const response = await getSandboxConnectionString(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    sandboxName
                );
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/sandboxes/:sandboxName/split-estimate`,
            { schema: GetSandboxSplitEstimateSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, sandboxName }
                } = request;
                const response = await getSandboxSplitEstimate(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    sandboxName
                );
                return reply.send({ volumes: response });
            }
        )
        .delete(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/sandboxes/:sandboxName`,
            { schema: DeleteSandboxSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, sandboxName }
                } = request;
                const response = await deleteSandbox(accountId, credentialsId, region, databaseHostId, sandboxName);
                return reply.send(response);
            }
        )
        .patch(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/sandboxes/:sandboxName`,
            { schema: SandboxLifeCycleSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, sandboxName },
                    body: { snapshot, action }
                } = request;
                const response = await updateSandboxLifeCycle(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    sandboxName,
                    action,
                    snapshot
                );
                return reply.send(response);
            }
        )
        .patch(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/sandboxes/:sandboxName/split`,
            { schema: SandboxSplitSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, sandboxName }
                } = request;
                const response = await splitSandbox(accountId, credentialsId, region, databaseHostId, sandboxName);
                return reply.send(response);
            }
        );
}
