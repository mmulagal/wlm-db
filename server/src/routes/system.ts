import { FastifyInstance } from 'fastify/types/instance';
import { VERSION } from '../utils/consts';
import { getHealthinessSchema, getSystemInfoSchema } from '../validation/routes-schema-validation';
import { AboutResponseType, HealthResponseType } from '../types/route-types';

export default function systemRoutes(fastify: FastifyInstance) {
    fastify
        .get<{ Reply: AboutResponseType }>(
            '/about',
            {
                schema: getSystemInfoSchema
            },
            (_, reply) => {
                reply.send({
                    version: VERSION,
                    nodeVersion: process.version,
                    mode: process.env.ENV_SS_BUILD_MODE,
                    build: process.env.ENV_SS_BUILD_TC,
                    git: process.env.ENV_SS_BUILD_GIT
                });
            }
        )
        .get<{ Reply: HealthResponseType }>(
            '/health',
            { schema: getHealthinessSchema },
            (_, reply) => {
                reply.code(200).send('wlm-db_health 1');
            }
        );
}
