import { Type, Static } from '@fastify/type-provider-typebox';

const HealthResponse = Type.String();

const AboutResponse = Type.Object({
    version: Type.String(),
    nodeVersion: Type.String(),
    mode: Type.Optional(Type.String()),
    build: Type.Optional(Type.String())
});

const StatusParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});

const StatusResponse = Type.Object({
    isActive: Type.Boolean()
});

type AboutResponseType = Static<typeof AboutResponse>;
type HealthResponseType = Static<typeof HealthResponse>;
type StatusResponseType = Static<typeof StatusResponse>;

export {
    AboutResponseType,
    HealthResponseType,
    StatusResponseType,
    AboutResponse,
    HealthResponse,
    StatusResponse,
    StatusParams
};
