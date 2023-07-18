import { HealthResponse, AboutResponse, VpcListResponse } from '../types/route-types';

// System schemas:
const getHealthinessSchema = {
    tags: ['System'],
    hide: true,
    description: 'Health and liveness',
    response: { 200: HealthResponse }
};

const getSystemInfoSchema = {
    tags: ['System'],
    description: 'Get system information',
    response: {
        200: AboutResponse
    }
};

// Aws schemas
const getVpcsListSchema = {
    tags: ['aws'],
    description: 'List Vpcs in a region',
    params: {
        type: 'object',
        properties: {
            accountId: {
                type: 'string',
                description: 'Account ID'
            },
            credentialsId: {
                type: 'string',
                description: 'Credentials ID'
            },
            region: {
                type: 'string',
                description: 'Aws Region'
            }
        },
        required: ['accountId']
    },
    response: {
        200: VpcListResponse
    }
};

export {
    getHealthinessSchema,
    getSystemInfoSchema,
    getVpcsListSchema
}