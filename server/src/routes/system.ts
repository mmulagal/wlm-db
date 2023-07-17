import { FastifyInstance } from 'fastify/types/instance';
import { Static, Type } from '@sinclair/typebox';
import { VERSION } from '../utils/consts';

const AboutResponse = Type.Object({
    version: Type.String(),
    nodeVersion: Type.String(),
    mode: Type.Optional(Type.String()),
    build: Type.Optional(Type.String()),
    git: Type.Optional(Type.String())
});
type AboutResponseType = Static<typeof AboutResponse>;

const HealthResponse = Type.String();
type HealthResponseType = Static<typeof HealthResponse>;

export default function systemRoutes(fastify: FastifyInstance) {
    fastify
        .get<{ Reply: AboutResponseType }>(
            '/about',
            {
                schema: {
                    tags: ['System'],
                    description: 'Get system information',
                    response: {
                        200: AboutResponse
                    }
                }
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
            {
                schema: {
                    tags: ['System'],
                    description: 'Health and liveness',
                    response: { 200: HealthResponse }
                }
            },
            (_, reply) => {
                reply.code(200).send('wlm-db_health 1');
            }
        );
}
