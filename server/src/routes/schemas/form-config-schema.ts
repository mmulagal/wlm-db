import {
    FormConfigListResponse,
    FormConfigParams,
    FormConfigCreateResponse,
    CreateConfigRequestBody
} from '../types/form-config.types';

const FormConfigListSchema = {
    tags: ['Config'],
    params: FormConfigParams,
    description: 'List saved config',
    response: {
        200: FormConfigListResponse
    }
};

const FormConfigCreateSchema = {
    tags: ['Config'],
    params: FormConfigParams,
    description: 'Create a config',
    body: CreateConfigRequestBody,
    response: {
        200: FormConfigCreateResponse
    }
};

export { FormConfigListSchema, FormConfigCreateSchema };
