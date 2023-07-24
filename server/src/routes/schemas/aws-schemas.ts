import { VpcListResponse, AmiResponse, AwsVpcQueryString, AwsParams, FSxRegionsResponse } from '../types/aws.types';
import { RouteTags } from '../../utils/consts';

// AWS Params
const params = AwsParams;

// Aws schemas
const GetVpcsListSchema = {
    tags: [RouteTags.AWS],
    description: 'List Vpcs in a region',
    params,
    query: AwsVpcQueryString,
    response: {
        200: VpcListResponse
    }
};

const GetAmiSchema = {
    tags: [RouteTags.AWS],
    description: 'Get AMIs in a region',
    params,
    response: {
        200: AmiResponse
    }
};

const GetFSxRegionsSchema = {
    tags: [RouteTags.AWS],
    params: AwsParams,
    descriptions: 'List the AWS regions enabled for the given account and support Amazon FSx for NetApp ONTAP',
    response: {
        200: FSxRegionsResponse
    }
};
export { GetVpcsListSchema, GetAmiSchema, GetFSxRegionsSchema };
