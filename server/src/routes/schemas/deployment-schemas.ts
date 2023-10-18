import { RouteTags } from '../../utils/consts';
import { AwsParamsWithRegion } from '../types/aws.types';
import {
    CloudFormationTemplateRequestBody,
    CloudFormationTemplateResponse,
    DeployTemplateResponse,
    DeploymentStatusListResponse,
    DeploymentStatusResponse,
    DeploymentStatusObjectParams,
    CloudFormationTemplateYamlResponse
} from '../types/deployment.types';

// Base Request for Deployment Routes
const baseRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: AwsParamsWithRegion
};

// Create cloud formation template for user deployment Schema
const CreateCloudFormationTemplateSchema = {
    ...baseRequest,
    description: 'Create Cloud Formation template in a region for existing vpc',
    body: CloudFormationTemplateRequestBody,
    response: {
        200: CloudFormationTemplateResponse
    }
};

// Cloud formation template
const CloudFormationTemplateSchema = {
    ...baseRequest,
    description: 'Cloud Formation template in yaml and cli format for user deployment',
    body: CloudFormationTemplateRequestBody,
    response: {
        200: CloudFormationTemplateYamlResponse
    }
};

// Create cloud formation template for user deployment Schema
const DeployTemplateSchema = {
    ...baseRequest,
    description: 'Deploy Cloud Formation template to provision SQL FCI',
    body: CloudFormationTemplateRequestBody,
    response: {
        200: DeployTemplateResponse
    }
};

// Get status of all Cloudformation stacks
const DeploymentStatusListSchema = {
    ...baseRequest,
    response: {
        200: DeploymentStatusListResponse
    }
};

// Get Cloudformation stack by id or name
const DeploymentStatusSchema = {
    ...baseRequest,
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
