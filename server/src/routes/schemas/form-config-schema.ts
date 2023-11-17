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
    summary: 'List saved config',
    description: 'List all the saved configurations',
    response: {
        200: FormConfigListResponse
    }
};

const FormConfigObjectSchema = {
    tags: ['Config'],
    params: FormConfigObjectParams,
    summary: 'Get individual saved config',
    description: 'Get individual saved configuration detail for given Id',
    response: {
        200: FormConfigObjectResponse
    }
};

const FormConfigObjectDeleteSchema = {
    tags: ['Config'],
    params: FormConfigObjectParams,
    summary: 'Delete individual saved config',
    description: 'Delete saved configuration for the given Id',
    response: {
        200: FormConfigObjectDeleteResponse
    }
};

const FormConfigCreateSchema = {
    tags: ['Config'],
    params: FormConfigListParams,
    summary: 'Create a config',
    description: 'Create a configuration with given details for given account',
    body: CreateConfigRequestBody,
    response: {
        200: FormConfigCreateResponse
    }
};

const FormConfigUpdateSchema = {
    tags: ['Config'],
    params: FormConfigUpdateParams,
    summary: 'Update a config',
    description: 'Update the configuration of given Id with data provided',
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
