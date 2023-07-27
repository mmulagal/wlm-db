import { AWS_TAG } from '../../utils/consts';
import {
    AmiResponse,
    VpcListResponse,
    AwsParams,
    AwsVpcQueryString,
    AdsResponse,
    SnsResponse,
    AmiQueryString
} from '../types/aws.types';

// Base Request for AWS Routes
const baseRequest = {
    tags: [AWS_TAG],
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
    ...baseRequest,
    description: 'List Active Directories',
    response: {
        200: AdsResponse
    }
};

// GET AMI Schema
const GetAmiSchema = {
    ...baseRequest,
    description: 'Get AMIs in a region',
    querystring: AmiQueryString,
    response: {
        200: AmiResponse
    }
};

// GET SNS Topics
const GetSnsTopics = {
    ...baseRequest,
    description: 'Get SNS Topics in the region',
    response: {
        200: SnsResponse
    }
};

export { GetVpcsListSchema, GetAmiSchema, GetAdsSchema, GetSnsTopics };
