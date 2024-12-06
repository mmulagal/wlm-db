import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    FileSystemsCredentialsStatusSchema,
    FileSystemCredentialsStatusSchema,
    GetManagedResourcesSchema,
    CreateDemoDataSchema
} from './schemas/resource-schema';
import {
    createDemoDataforRegion,
    getFileSystemCredentialsStatus,
    getFileSystemsCredentialsStatus,
    getManagedResources
} from '../operations/resource-operations';

export default function resourceRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    const API_PATH_RESOURCES = '/v1/credentials/:credentialsId/regions/:region/resources';
    const MSSQL_API_PATH_RESOURCES = '/v1/mssql/credentials/:credentialsId/regions/:region/resources';

    server.get(
        `${API_PATH_RESOURCES}/file-systems/credentials-status`,
        { schema: FileSystemsCredentialsStatusSchema },
        async (request, reply) => {
            const {
                params: { accountId },
                query: { fsxids }
            } = request;

            const response = await getFileSystemsCredentialsStatus(accountId, fsxids);
            return reply.send(response);
        }
    );

    server.get(
        `${API_PATH_RESOURCES}/file-systems/:fileSystemId/credentials-status`,
        { schema: FileSystemCredentialsStatusSchema },
        async (request, reply) => {
            const {
                params: { accountId, fileSystemId }
            } = request;

            const response = await getFileSystemCredentialsStatus(accountId, fileSystemId);
            return reply.send(response);
        }
    );

    server.get(
        `${MSSQL_API_PATH_RESOURCES}/managed-hosts`,
        { schema: GetManagedResourcesSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                query: { pageSize, nextToken }
            } = request;
            const response = await getManagedResources(accountId, credentialsId, region, pageSize, nextToken);
            return reply.send(response);
        }
    );

    server.post(
        `${MSSQL_API_PATH_RESOURCES}/create-demo-resources`,
        { schema: CreateDemoDataSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region }
            } = request;
            const response = await createDemoDataforRegion(accountId, credentialsId, region);
            return reply.code(201).send(response);
        }
    );
}
