import { FastifyInstance } from 'fastify/types/instance';
import { Static } from '@sinclair/typebox';
import { VERSION } from '../utils/consts';
import { getHealthinessSchema, getSystemInfoSchema } from '../validation/routes-schema-validation';
import { HealthResponse, AboutResponse } from '../types/route-types';

type AboutResponseType = Static<typeof AboutResponse>;
type HealthResponseType = Static<typeof HealthResponse>;

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
