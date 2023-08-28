import { FastifyInstance } from 'fastify/types/instance';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { DeleteResourceSchema } from './schemas/generic-schemas';
import { removeTenancyResource } from '../operations/tenancy-operations';

const RESOURCE_DELETE_API_PATH = '/v1/resources/:resourceId';

export default function genericRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.delete(`${RESOURCE_DELETE_API_PATH}`, { schema: DeleteResourceSchema }, async (request, reply) => {
        const {
            params: { resourceId }
        } = request;

        const response = await removeTenancyResource(resourceId);
        return reply.send(response);
    });
}
