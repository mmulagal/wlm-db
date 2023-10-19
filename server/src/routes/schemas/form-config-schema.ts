import {
    FormConfigListResponse,
    FormConfigListParams,
    FormConfigObjectParams,
    FormConfigCreateResponse,
    FormConfigObjectResponse,
    CreateConfigRequestBody,
    FormConfigObjectDeleteResponse,
    UpdateConfigRequestBody,
    FormConfigUpdateParams,
    FormConfigUpdateResponse
} from '../types/form-config.types';

const FormConfigListSchema = {
    tags: ['Config'],
    params: FormConfigListParams,
    description: 'List saved config',
    response: {
        200: FormConfigListResponse
    }
};

const FormConfigObjectSchema = {
    tags: ['Config'],
    params: FormConfigObjectParams,
    description: 'Get individual saved config',
    response: {
        200: FormConfigObjectResponse
    }
};

const FormConfigObjectDeleteSchema = {
    tags: ['Config'],
    params: FormConfigObjectParams,
    description: 'Delete individual saved config',
    response: {
        200: FormConfigObjectDeleteResponse
    }
};

const FormConfigCreateSchema = {
    tags: ['Config'],
    params: FormConfigListParams,
    description: 'Create a config',
    body: CreateConfigRequestBody,
    response: {
        200: FormConfigCreateResponse
    }
};

const FormConfigUpdateSchema = {
    tags: ['Config'],
    params: FormConfigUpdateParams,
    description: 'Update a config',
    body: UpdateConfigRequestBody,
    response: {
        200: FormConfigUpdateResponse
    }
};

export {
    FormConfigListSchema,
    FormConfigCreateSchema,
    FormConfigUpdateSchema,
    FormConfigObjectSchema,
    FormConfigObjectDeleteSchema
};
