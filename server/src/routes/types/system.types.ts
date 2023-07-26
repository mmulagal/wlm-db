import { Type } from '@sinclair/typebox';

const HealthResponse = Type.String();

const AboutResponse = Type.Object({
    version: Type.String(),
    nodeVersion: Type.String(),
    mode: Type.Optional(Type.String()),
    build: Type.Optional(Type.String())
});

export { AboutResponse, HealthResponse };
