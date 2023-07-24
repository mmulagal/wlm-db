import { VpcListResponse, AmiResponse, AwsVpcQueryString, AwsParam, AdsParams, AdsResponse } from '../types/aws.types';
import { AWS_TAG } from '../../utils/consts';

// AWS Params
const params = AwsParam;

// Aws schemas
const GetVpcsListSchema = {
    tags: [AWS_TAG],
    description: 'List Vpcs in a region',
    params,
    query: AwsVpcQueryString,
    response: {
        200: VpcListResponse
    }
};

const AdsSchema = {
    tags: [AWS_TAG],
    params: AdsParams,
    description: 'List Active Directories',
    response: {
        200: AdsResponse
    }
};

const GetAmiSchema = {
    tags: [AWS_TAG],
    description: 'Get AMIs in a region',
    params,
    response: {
        200: AmiResponse
    }
};

export { GetVpcsListSchema, GetAmiSchema, AdsSchema };
