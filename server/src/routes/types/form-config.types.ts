import { Static, Type } from '@fastify/type-provider-typebox';

const FormConfigObjectResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    creationTime: Type.Number(),
    accountId: Type.String(),
    user: Type.String(),
    data: Type.Any(),
    modifiedTime: Type.Optional(Type.Number())
});

const FormConfigListObjectResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    creationTime: Type.Number(),
    accountId: Type.String(),
    user: Type.String(),
    modifiedTime: Type.Optional(Type.Number())
});

const FormConfigObjectDeleteResponse = {};

const FormConfigListResponse = Type.Array(FormConfigListObjectResponse);

type FormConfigListResponseType = Static<typeof FormConfigListResponse>;

type FormConfigObjectResponseType = Static<typeof FormConfigObjectResponse>;

const FormConfigListParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});
type FormConfigListParamsType = Static<typeof FormConfigListParams>;

const FormConfigUpdateParams = Type.Object({
    accountId: Type.String({ minLength: 1 }),
    id: Type.String({ minLength: 1 })
});
type FormConfigUpdateParamsType = Static<typeof FormConfigUpdateParams>;

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

const FormConfigUpdateResponse = Type.Object({
    id: Type.String({ minLength: 1 })
});

type FormConfigUpdateResponseType = Static<typeof FormConfigUpdateResponse>;

const CreateConfigRequestBody = Type.Object({
    name: Type.String(),
    data: Type.Any()
});

const UpdateConfigRequestBody = Type.Object({
    name: Type.String(),
    data: Type.Optional(Type.Any())
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
    FormConfigUpdateParams,
    FormConfigUpdateParamsType,
    FormConfigCreateResponseType,
    FormConfigCreateResponse,
    FormConfigUpdateResponse,
    FormConfigUpdateResponseType,
    CreateConfigRequestBody,
    UpdateConfigRequestBody
};
