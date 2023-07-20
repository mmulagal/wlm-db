import { VpcListResponse, AmiResponse } from '../types/aws.types';

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
    }
};

export const GetAmiSchema = {
    tags: ['aws'],
    description: 'Get AMIs in a region',
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
        200: AmiResponse,
    },
}
