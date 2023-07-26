import { AmiResponse, VpcListResponse, AwsParams, AwsVpcQueryString } from '../types/aws.types';
import headers from './headers';

// Base Request for AWS Routes
const baseRequest = {
    tags: ['aws'],
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

// GET AMI Schema
const GetAmiSchema = {
    ...baseRequest,
    description: 'Get AMIs in a region',
    response: {
        200: AmiResponse
    }
};

export { GetVpcsListSchema, GetAmiSchema };
