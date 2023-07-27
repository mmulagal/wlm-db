import { AWS_TAG } from '../../utils/consts';
import {
    AmiResponse,
    VpcListResponse,
    AwsParams,
    AwsVpcQueryString,
    AdsParams,
    AdsResponse,
    KmsKeysListResponse
} from '../types/aws.types';
import headers from './headers';

// Base Request for AWS Routes
const baseRequest = {
    tags: [AWS_TAG],
    headers,
    params: AwsParams
};

// GET VPC List Schema
const GetVpcsListSchema = {
    ...baseRequest,
    description: 'List Vpcs in a region',
    querystring: AwsVpcQueryString,
    response: {
        200: VpcListResponse
    }
};

// Get AD Schema
const GetAdsSchema = {
    tags: [AWS_TAG],
    params: AdsParams,
    description: 'List Active Directories',
    response: {
        200: AdsResponse
    }
};

// GET AMI Schema
const GetAmiSchema = {
    ...baseRequest,
    description: 'Get AMIs in a region',
    response: {
        200: AmiResponse
    }
};

// GET Kms Keys List Schema
const GetKmsKeysListSchema = {
    ...baseRequest,
    description: 'List Kms Keys in a region',
    response: {
        200: KmsKeysListResponse
    }
};

export { GetVpcsListSchema, GetAmiSchema, GetAdsSchema, GetKmsKeysListSchema };
