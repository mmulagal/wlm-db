import { RouteTags } from '../../utils/consts';
import {
    AmiResponse,
    VpcListResponse,
    AwsParams,
    AwsParamsWithRegion,
    AwsVpcQueryString,
    AdsResponse,
    SnsResponse,
    FSxRegionsResponse,
    FSxFileSystemParams,
    FSxFileSystemsResponse,
    KmsKeysListResponse,
    AmiQueryString,
    InstanceTypes,
    KeyPairsResponse
} from '../types/aws.types';

// Base Request for AWS Routes
const baseRequest = {
    tags: [RouteTags.AWS],
    params: AwsParamsWithRegion
};

// GET VPC List Schema
const GetVpcsListSchema = {
    ...baseRequest,
    summary: 'List VPCs',
    description: 'List VPCs in the given region',
    querystring: AwsVpcQueryString,
    response: {
        200: VpcListResponse
    }
};

// Get AD Schema
const GetAdsSchema = {
    ...baseRequest,
    summary: 'List AWS managed Active Directories',
    description: 'List AWS managed Active Directories in the given region',
    response: {
        200: AdsResponse
    }
};

// GET AMI Schema
const GetAmiSchema = {
    ...baseRequest,
    summary: 'List AMIs',
    description: 'List AMIs in the given region for the provided parameters',
    querystring: AmiQueryString,
    response: {
        200: AmiResponse
    }
};

// GET EC2 instance types
const GetInstanceTypesSchema = {
    ...baseRequest,
    summary: 'List EC2 instance types',
    description: 'Get EC2 instance types in the region supported for MS SQL deployment',
    response: {
        200: InstanceTypes
    }
};

// GET SNS Topics
const GetSnsTopicsSchema = {
    ...baseRequest,
    summary: 'Get SNS Topics',
    description: 'Get SNS Topics in the given region',
    response: {
        200: SnsResponse
    }
};

const GetFSxRegionsSchema = {
    tags: [RouteTags.AWS],
    params: AwsParams,
    summary: 'List AWS regions that supports FSx',
    descriptions: 'List the AWS regions enabled for the given account and support Amazon FSx for NetApp ONTAP',
    response: {
        200: FSxRegionsResponse
    }
};

const GetFSxFileSystemsSchema = {
    tags: [RouteTags.AWS],
    params: FSxFileSystemParams,
    summary: 'List FSx for NetApp ONTAP',
    description: 'List Amazon FSx for NetApp ONTAP filesystems',
    response: {
        200: FSxFileSystemsResponse
    }
};

// GET Kms Keys List Schema
const GetKmsKeysListSchema = {
    ...baseRequest,
    summary: 'List KMS keys',
    description: 'List KMS Keys in the given region',
    response: {
        200: KmsKeysListResponse
    }
};

const GetKeyPairsSchema = {
    ...baseRequest,
    summary: 'List key-Pairs',
    description: 'List Key-Pairs in the given region',
    response: {
        200: KeyPairsResponse
    }
};
export {
    GetVpcsListSchema,
    GetAmiSchema,
    GetAdsSchema,
    GetSnsTopicsSchema,
    GetFSxRegionsSchema,
    GetKmsKeysListSchema,
    GetInstanceTypesSchema,
    GetKeyPairsSchema,
    GetFSxFileSystemsSchema
};
