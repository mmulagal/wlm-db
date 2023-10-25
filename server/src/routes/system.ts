import { FastifyInstance } from 'fastify/types/instance';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { VERSION } from '../utils/consts';
import { GetHealthinessSchema, GetSystemInfoSchema } from './schemas/system-schemas';

export default function systemRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
    server
        .get(
            '/about',
            {
                schema: GetSystemInfoSchema
            },
            (_, reply) => {
                reply.send({
                    version: VERSION,
                    nodeVersion: process.version,
                    mode: process.env.ENV_WLMDB_BUILD_MODE,
                    build: process.env.ENV_WLMDB_BUILD_TC
                });
            }
        )
        .get('/health', { schema: GetHealthinessSchema }, (_, reply) => {
            reply.code(200).send('wlmdb_health 1');
        });
}
