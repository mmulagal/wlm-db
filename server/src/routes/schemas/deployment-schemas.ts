import { RouteTags } from '../../utils/consts';
import { AwsParams } from '../types/aws.types';
import {
    CloudFormationTemplateRequestBody,
    CloudFormationTemplateResponse,
    DeployTemplateResponse,
    DeploymentStatusListResponse,
    DeploymentStatusResponse,
    DeploymentStatusObjectParams
} from '../types/deployment.types';

// Base Request for Deployment Routes
const baseRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: AwsParams
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

export { CreateCloudFormationTemplateSchema, DeployTemplateSchema, DeploymentStatusListSchema, DeploymentStatusSchema };
