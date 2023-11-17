import { RouteTags } from '../../utils/consts';
import { AwsParamsWithRegion } from '../types/aws.types';
import {
    CloudFormationTemplateRequestBody,
    CloudFormationTemplateResponse,
    DeployTemplateResponse,
    DeploymentStatusListResponse,
    DeploymentStatusResponse,
    DeploymentStatusObjectParams,
    CloudFormationStaticTemplateRequestBody,
    CloudFormationStaticTemplateResponse
} from '../types/deployment.types';
import { AccountIdParams } from '../types/generic.types';

// Base Request for Deployment Routes
const baseRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: AwsParamsWithRegion
};

// Create cloud formation template for user deployment Schema
const CreateCloudFormationTemplateSchema = {
    ...baseRequest,
    summary: 'Create Cloud Formation template',
    description: 'Create Cloud Formation template in a region for existing VPC',
    body: CloudFormationTemplateRequestBody,
    response: {
        200: CloudFormationTemplateResponse
    }
};

// Cloud formation template
const CloudFormationTemplateSchema = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams,
    summary: 'Create Cloud Formation template',
    description: 'Cloud Formation template url, yaml and cli format for user deployment',
    body: CloudFormationStaticTemplateRequestBody,
    response: {
        200: CloudFormationStaticTemplateResponse
    }
};

// Create cloud formation template for user deployment Schema
const DeployTemplateSchema = {
    ...baseRequest,
    summary: 'Deploy Cloud Formation template',
    description: 'Deploy Cloud Formation template to provision SQL FCI',
    body: CloudFormationTemplateRequestBody,
    response: {
        200: DeployTemplateResponse
    }
};

// Get status of all Cloudformation stacks
const DeploymentStatusListSchema = {
    ...baseRequest,
    summary: 'List Cloud Formation deployments',
    description: 'List Cloud Formation deployment details',
    response: {
        200: DeploymentStatusListResponse
    }
};

// Get Cloudformation stack by id or name
const DeploymentStatusSchema = {
    ...baseRequest,
    summary: 'Get Cloud Formation deployment details',
    description: 'Get Cloud Formation deployment details for a given deployment Id',
    params: DeploymentStatusObjectParams,
    response: {
        200: DeploymentStatusResponse
    }
};

export {
    CreateCloudFormationTemplateSchema,
    DeployTemplateSchema,
    DeploymentStatusListSchema,
    DeploymentStatusSchema,
    CloudFormationTemplateSchema
};
