import { Type } from '@sinclair/typebox';
import { Static } from '@sinclair/typebox';

const HealthResponse = Type.String();

const AboutResponse = Type.Object({
    version: Type.String(),
    nodeVersion: Type.String(),
    mode: Type.Optional(Type.String()),
    build: Type.Optional(Type.String()),
    git: Type.Optional(Type.String())
});

export type AboutResponseType = Static<typeof AboutResponse>;
export type HealthResponseType = Static<typeof HealthResponse>;

export { HealthResponse, AboutResponse };