import { FastifyInstance } from 'fastify/types/instance';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { GetSystemStatusSchema } from './schemas/system-schemas';
import getSystemStatus from '../operations/system-operations';
import castRequest from './utils';

export default function systemRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
    server.get('/v1/status', { schema: GetSystemStatusSchema }, async request => {
        const {
            params: { accountId }
        } = castRequest(request);
        return getSystemStatus(accountId);
    });
}
