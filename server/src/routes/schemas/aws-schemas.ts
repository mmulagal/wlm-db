import { VpcListResponse, AmiResponse } from '../types/aws.types';

const params = {
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
};

// Aws schemas
const GetVpcsListSchema = {
    tags: ['aws'],
    description: 'List Vpcs in a region',
    params,
    response: {
        200: VpcListResponse
    }
};

const GetAmiSchema = {
    tags: ['aws'],
    description: 'Get AMIs in a region',
    params,
    response: {
        200: AmiResponse
    }
};

export { GetVpcsListSchema, GetAmiSchema };
