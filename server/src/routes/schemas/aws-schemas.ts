import { VpcListResponse, AmiResponse, AwsVpcQueryString, AwsParam } from '../types/aws.types';

// AWS Params
const params = AwsParam;

// Aws schemas
const GetVpcsListSchema = {
    tags: ['aws'],
    description: 'List Vpcs in a region',
    params,
    query: AwsVpcQueryString,
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
