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
            // added both condition to work for local & demo simulator
            if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
                reply.code(200).send('wlmdb_demo_health 1');
            } else {
                // this health response is to differentiate demo and dev mode
                reply.code(200).send('wlmdb_health 1');
            }
        });
}
