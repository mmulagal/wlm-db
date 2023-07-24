import { FastifyInstance } from 'fastify/types/instance';
import { VERSION } from '../utils/consts';
import { GetHealthinessSchema, GetSystemInfoSchema } from './schemas/system-schemas';
import { AboutResponseType, HealthResponseType } from './types/system.types';

export default function systemRoutes(fastify: FastifyInstance) {
    fastify
        .get<{ Reply: AboutResponseType }>(
            '/about',
            {
                schema: GetSystemInfoSchema
            },
            (_, reply) => {
                reply.send({
                    version: VERSION,
                    nodeVersion: process.version,
                    mode: process.env.ENV_SS_BUILD_MODE,
                    build: process.env.ENV_SS_BUILD_TC
                });
            }
        )
        .get<{ Reply: HealthResponseType }>('/health', { schema: GetHealthinessSchema }, (_, reply) => {
            reply.code(200).send('wlm-db_health 1');
        });
}
