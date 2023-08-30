import { Type, Static } from '@sinclair/typebox';

const BatchParams = Type.Object({
    accountId: Type.String()
});

const BatchRequestBody = Type.Array(
    Type.Object({
        url: Type.String(),
        method: Type.String({ enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }),
        payload: Type.Optional(Type.Any()),
        headers: Type.Optional(Type.Any())
    })
);

const SingleBatchResponse = Type.Object({
    data: Type.Optional(Type.Any()),
    error: Type.Optional(Type.Any())
});

const BatchResponse = Type.Array(Type.Object(SingleBatchResponse));

type BatchRequestBodyType = Static<typeof BatchRequestBody>;
type BatchResponseType = Static<typeof BatchResponse>;
type SingleBatchResponseType = Static<typeof SingleBatchResponse>;

export {
    BatchRequestBody,
    BatchParams,
    BatchResponse,
    BatchRequestBodyType,
    BatchResponseType,
    SingleBatchResponseType
};
