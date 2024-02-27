import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    FileSystemsCredentialsStatusSchema,
    FileSystemCredentialsStatusSchema,
    GetManagedResourcesSchema
} from './schemas/resource-schema';
import {
    getFileSystemCredentialsStatus,
    getFileSystemsCredentialsStatus,
    getManagedResources
} from '../operations/resource-operations';

export default function resourceRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    const API_PATH_RESOURCES = '/v1/resources';
    const API_PATH_RESOURCES_WITH_CRED = '/v1/credentials/:credentialsId/regions/:region/resources';

    server.get(
        `${API_PATH_RESOURCES}/file-systems/credentials-status`,
        { schema: FileSystemsCredentialsStatusSchema },
        async (request, reply) => {
            const {
                params: { accountId },
                query: { fsxids }
            } = request as { params: { accountId: string }; query: { fsxids: string } };

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
        `${API_PATH_RESOURCES_WITH_CRED}/managed-hosts`,
        { schema: GetManagedResourcesSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region }
            } = request;
            const response = await getManagedResources(accountId, credentialsId, region);
            return reply.send(response);
        }
    );
}
