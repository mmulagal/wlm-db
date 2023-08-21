import { Type, Static } from '@fastify/type-provider-typebox';
import { WLMDB } from '../../utils/consts.js';

const STATUS_TYPES = Type.Union([
    Type.Literal('pending'),
    Type.Literal('aborted'),
    Type.Literal('success'),
    Type.Literal('failed')
]);

const CreateAuditGroupSchema = Type.Object({
    startTime: Type.Number(),
    actionName: Type.String(),
    status: STATUS_TYPES,
    requestId: Type.String(),
    serviceName: Type.Literal(WLMDB),
    referrer: Type.String(),
    version: Type.String(),
    actionParameters: Type.String(),
    principalId: Type.String(),
    resourceId: Type.Optional(Type.String()),
    errorMessage: Type.Optional(Type.String())
});

const UpdateAuditGroupSchema = Type.Object({
    startTime: Type.Number(),
    endTime: Type.Number(),
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

const AuditRecordSchema = Type.Object({
    recordId: Type.Number(),
    actionName: Type.String(),
    startTime: Type.Number(),
    status: STATUS_TYPES,
    requestId: Type.String(),
    serviceName: Type.Literal(WLMDB),
    actionParameters: Type.String(),
    errorMessage: Type.Optional(Type.String())
});

type CreateAuditGroupSchemaType = Static<typeof CreateAuditGroupSchema>;
type UpdateAuditGroupSchemaType = Static<typeof UpdateAuditGroupSchema>;
type AuditRecordSchemaType = Static<typeof AuditRecordSchema>;

export {
    CreateAuditGroupSchema,
    UpdateAuditGroupSchema,
    AuditRecordSchema,
    CreateAuditGroupSchemaType,
    UpdateAuditGroupSchemaType,
    AuditRecordSchemaType
};
