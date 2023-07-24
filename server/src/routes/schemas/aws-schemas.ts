import {
    AwsParams,
    FSxRegionsResponse,
    VpcListResponse
} from '../types/aws.types';
import { RouteTags } from '../../utils/consts';

// Aws schemas
export const GetVpcsListSchema = {
    tags: [RouteTags.AWS],
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

// Schema for FSx supported regions
export const GetFSxRegionsSchema = {
    tags: [RouteTags.AWS],
    params: AwsParams,
    descriptions: 'List the AWS regions enabled for the given account and support Amazon FSx for NetApp ONTAP',
    response: {
        200: FSxRegionsResponse
    }
};
