import { Static, Type } from '@fastify/type-provider-typebox';

const FormConfigObjectResponse = Type.Object({
    id: Type.String(),
    name: Type.String(),
    creationTime: Type.Number(),
    accountId: Type.String(),
    user: Type.String(),
    data: Type.Any()
});

const FormConfigListResponse = Type.Array(FormConfigObjectResponse);

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

const FormConfigCreateResponse = Type.Object({});

type FormConfigCreateResponseType = Static<typeof FormConfigCreateResponse>;

const CreateConfigRequestBody = Type.Object({
    name: Type.String(),
    data: Type.Any()
});

export {
    FormConfigListResponse,
    FormConfigObjectResponse,
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
