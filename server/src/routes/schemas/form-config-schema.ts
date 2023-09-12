import {
    FormConfigListResponse,
    FormConfigListParams,
    FormConfigObjectParams,
    FormConfigCreateResponse,
    FormConfigObjectResponse,
    CreateConfigRequestBody
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

const FormConfigCreateSchema = {
    tags: ['Config'],
    params: FormConfigListParams,
    description: 'Create a config',
    body: CreateConfigRequestBody,
    response: {
        200: FormConfigCreateResponse
    }
};

export { FormConfigListSchema, FormConfigCreateSchema, FormConfigObjectSchema };
