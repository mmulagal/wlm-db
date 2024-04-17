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
    GetCollationDetailsSchema,
    GetSandboxSavingsSchema,
    GetSandboxesInfoSchema,
    PatchResourceForSandboxSchema,
    RevertPatchResourceForSandboxSchema
} from './schemas/database-hosts-schemas';
import {
    getSandboxesInfo,
    getSandboxSavings,
    revertMetadataForSanboxTesting,
    updateMetadataForSanboxTesting
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
            `${API_PREFIX_PATH}/database-hosts/sandbox-savings`,
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
                    params: { accountId, databaseHostId, credentialsId, region }
                } = request;
                const response = await getDriveInfo(accountId, databaseHostId, credentialsId, region);
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
        );
}
