import { CredentialsResponse, CredentialsListParams } from '../types/credentials.types';

const CredentialsSchema = {
    tags: ['Generic'],
    params: CredentialsListParams,
    summary: 'List credentials',
    description: 'List added credentials',
    response: {
        200: CredentialsResponse
    }
};

export { CredentialsSchema };
