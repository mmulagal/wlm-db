import { VpcListResponse, AmiResponse, AwsVpcQueryString, AwsParam, AdsParams, AdsResponse } from '../types/aws.types';

// AWS Params
const params = AwsParam;

// Aws schemas
const GetVpcsListSchema = {
    tags: ['AWS'],
    description: 'List Vpcs in a region',
    params,
    query: AwsVpcQueryString,
    response: {
        200: VpcListResponse
    }
};

const AdsSchema = {
    tags: ['AWS'],
    params: AdsParams,
    description: 'List Active Directories',
    response: {
        200: AdsResponse
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

export { GetVpcsListSchema, GetAmiSchema, AdsSchema };
