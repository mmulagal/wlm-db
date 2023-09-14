import { Static, Type } from '@fastify/type-provider-typebox';

const FormConfigObjectResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    creationTime: Type.Number(),
    accountId: Type.String(),
    user: Type.String(),
    data: Type.Any()
});

const FormConfigListObjectResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    creationTime: Type.Number(),
    accountId: Type.String(),
    user: Type.String()
});

const FormConfigObjectDeleteResponse = {};

const FormConfigListResponse = Type.Array(FormConfigListObjectResponse);

type FormConfigListResponseType = Static<typeof FormConfigListResponse>;

type FormConfigObjectResponseType = Static<typeof FormConfigObjectResponse>;

const FormConfigListParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});
type FormConfigListParamsType = Static<typeof FormConfigListParams>;

const FormConfigObjectParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    id: Type.String({ minLength: 1 })
});
type FormConfigObjectParamsType = Static<typeof FormConfigObjectParams>;

const FormConfigCreateResponse = Type.Object({
    id: Type.String({ minLength: 1 }),
    accountId: Type.String({ minLength: 1 }),
    name: Type.String(),
    creationTime: Type.Number(),
    user: Type.String(),
    data: Type.Any()
});

type FormConfigCreateResponseType = Static<typeof FormConfigCreateResponse>;

const CreateConfigRequestBody = Type.Object({
    name: Type.String(),
    data: Type.Any()
});

export {
    FormConfigListResponse,
    FormConfigObjectResponse,
    FormConfigObjectDeleteResponse,
    FormConfigListResponseType,
    FormConfigObjectResponseType,
    FormConfigListParamsType,
    FormConfigObjectParamsType,
    FormConfigListParams,
    FormConfigObjectParams,
    FormConfigCreateResponseType,
    FormConfigCreateResponse,
    CreateConfigRequestBody
};
