import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import getStorageSavingsSchema from './schemas/storage-savings-schema';
import performStorageSavingsCalculations from '../operations/cloud-manager/marketing-operations';

export default function storageSavingsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    const API_PATH_STORAGE_SAVINGS =
        '/v1/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings';

    server.post(API_PATH_STORAGE_SAVINGS, { schema: getStorageSavingsSchema }, async (request, reply) => {
        const {
            params: { accountId, credentialsId, region, instanceId }
        } = request;

        const response = await performStorageSavingsCalculations(accountId, credentialsId, region, instanceId);
        return reply.send(response);
    });
}
