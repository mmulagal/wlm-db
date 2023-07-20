import { VpcListResponse, AdsParams, AdsResponse } from '../types/aws.types';

// Aws schemas
export const GetVpcsListSchema = {
    tags: ['aws'],
    description: 'List Vpcs in a region',
    params: {
        type: 'object',
        properties: {
            accountId: {
                type: 'string',
                description: 'Account ID',
            },
            credentialsId: {
                type: 'string',
                description: 'Credentials ID',
            },
            region: {
                type: 'string',
                description: 'Aws Region',
            },
        },
        required: ['accountId'],
    },
    response: {
        200: VpcListResponse,
    },
};

export const AdsSchema = {
    tags: ['AWS'],
    params: AdsParams,
    description: 'List Active Directories',
    response: {
        200: AdsResponse
    }
}
