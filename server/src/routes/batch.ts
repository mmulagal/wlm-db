import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import executeBatchApiCalls from '../operations/batch-operations';
import { BatchSchema } from './schemas/batch-schemas';
import castRequest from './utils';
import { BatchRequestBodyType } from './types/batch.types';

const API_PREFIX_PATH = '/v1/batches';

export default function batchRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post(`${API_PREFIX_PATH}`, { schema: BatchSchema }, async (request, reply) => {
        const { body } = castRequest(request);
        const response = await executeBatchApiCalls(body as BatchRequestBodyType);
        return reply.send(response);
    });
}
