import { AmiResponse, VpcListResponse, AwsParams, AwsVpcQueryString, SnsResponse } from '../types/aws.types';

// Base Request for AWS Routes
const baseRequest = {
    tags: ['aws'],
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

// GET AMI Schema
const GetAmiSchema = {
    ...baseRequest,
    description: 'Get AMIs in a region',
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

export { GetVpcsListSchema, GetAmiSchema, GetSnsTopics };
