import { Type } from '@fastify/type-provider-typebox';
import { WLMDB } from '../../utils/consts.js';

const STATUS_TYPES = Type.Union([
    Type.Literal('pending'),
    Type.Literal('aborted'),
    Type.Literal('success'),
    Type.Literal('failed')
]);

const createAuditGroupSchema = Type.Object({
    startDate: Type.Number(),
    actionName: Type.String(),
    status: STATUS_TYPES,
    requestId: Type.String(),
    serviceName: Type.Literal(WLMDB),
    referrer: Type.String(),
    version: Type.String(),
    actionParameters: Type.String(),
    principalId: Type.String(),
    resourceId: Type.Optional(Type.String())
});

const updateAuditGroupSchema = Type.Object({
    startDate: Type.Number(),
    endDate: Type.Number(),
    actionName: Type.String(),
    status: STATUS_TYPES,
    requestId: Type.String(),
    serviceName: Type.Literal(WLMDB),
    referrer: Type.String(),
    version: Type.String(),
    actionParameters: Type.String(),
    principalId: Type.String(),
    resourceId: Type.Optional(Type.String()),
    responseData: Type.Optional(Type.String()),
    errorMessage: Type.Optional(Type.String())
});

const auditRecordSchema = Type.Object({
    recordId: Type.Number(),
    actionName: Type.String(),
    date: Type.Number(),
    status: STATUS_TYPES,
    requestId: Type.String(),
    serviceName: Type.Literal(WLMDB),
    actionParameters: Type.String(),
    errorMessage: Type.Optional(Type.String())
});

export { createAuditGroupSchema, updateAuditGroupSchema, auditRecordSchema };
