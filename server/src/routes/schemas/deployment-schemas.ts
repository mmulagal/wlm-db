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

// Create CloudFormation template for user deployment Schema
const CreateCloudFormationTemplateSchema = {
    ...baseRequest,
    summary: 'Create CloudFormation template URL',
    description: 'Create CloudFormation template in a region for existing VPC',
    body: CloudFormationTemplateRequestBody,
    response: {
        200: CloudFormationTemplateResponse
    }
};

// CloudFormation template
const CloudFormationTemplateSchema = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams,
    summary: 'Create CloudFormation template',
    description: 'Create CloudFormation template in URL, YAML and CLI format for user deployment',
    body: CloudFormationStaticTemplateRequestBody,
    response: {
        200: CloudFormationStaticTemplateResponse
    }
};

// Create CloudFormation template for user deployment Schema
const DeployTemplateSchema = {
    ...baseRequest,
    summary: 'Deploy CloudFormation template',
    description: 'Deploy CloudFormation template to provision SQL FCI',
    body: CloudFormationTemplateRequestBody,
    response: {
        200: DeployTemplateResponse
    }
};

// Get status of all Cloudformation stacks
const DeploymentStatusListSchema = {
    ...baseRequest,
    summary: 'List CloudFormation deployments',
    description: 'List CloudFormation deployment details',
    response: {
        200: DeploymentStatusListResponse
    }
};

// Get Cloudformation stack by id or name
const DeploymentStatusSchema = {
    ...baseRequest,
    summary: 'Get CloudFormation deployment details',
    description: 'Get CloudFormation deployment details for a given deployment Id',
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
