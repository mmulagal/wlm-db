import { Type, Static } from '@fastify/type-provider-typebox';

const HealthResponse = Type.String();

const AboutResponse = Type.Object({
    version: Type.String(),
    nodeVersion: Type.String(),
    mode: Type.Optional(Type.String()),
    build: Type.Optional(Type.String())
});

type AboutResponseType = Static<typeof AboutResponse>;
type HealthResponseType = Static<typeof HealthResponse>;

export { AboutResponseType, HealthResponseType, AboutResponse, HealthResponse };
