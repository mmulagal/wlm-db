import { RouteTags } from '../../utils/consts';
import {
    AmiResponse,
    VpcListResponse,
    AwsParams,
    AwsRegionsParams,
    AwsVpcQueryString,
    AdsResponse,
    SnsResponse,
    AmiQueryString,
    FSxRegionsResponse,
    KeyPairsResponse
} from '../types/aws.types';

// Base Request for AWS Routes
const baseRequest = {
    tags: [RouteTags.AWS],
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

const GetFSxRegionsSchema = {
    tags: [RouteTags.AWS],
    params: AwsRegionsParams,
    descriptions: 'List the AWS regions enabled for the given account and support Amazon FSx for NetApp ONTAP',
    response: {
        200: FSxRegionsResponse
    }
};

const GetKeyPairsSchema = {
    ...baseRequest,
    description: 'List Key-Pairs in the given region',
    response: {
        200: KeyPairsResponse
    }
};

export { GetVpcsListSchema, GetAmiSchema, GetAdsSchema, GetSnsTopics, GetFSxRegionsSchema, GetKeyPairsSchema };
