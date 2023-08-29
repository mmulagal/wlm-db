import { Static, Type } from '@fastify/type-provider-typebox';

const FormConfigListResponse = Type.Array(
    Type.Object({
        id: Type.String(),
        accountId: Type.String(),
        user: Type.String(),
        data: Type.Object({})
    })
);

type FormConfigListResponseType = Static<typeof FormConfigListResponse>;

const FormConfigParams = Type.Object({
    accountId: Type.String({ minLength: 1 })
});
type FormConfigParamsType = Static<typeof FormConfigParams>;

const FormConfigCreateResponse = Type.Object({});

type FormConfigCreateResponseType = Static<typeof FormConfigCreateResponse>;

const CreateConfigRequestBody = Type.Object({
    data: Type.Object({})
});

export {
    FormConfigListResponse,
    FormConfigListResponseType,
    FormConfigParamsType,
    FormConfigParams,
    FormConfigCreateResponseType,
    FormConfigCreateResponse,
    CreateConfigRequestBody
};
