import { RouteTags } from '../../utils/consts';
import {
    CloudFormationTemplateRequestBody,
    DeploymentParams,
    CloudFormationTemplateResponse,
    DeployTemplateResponse
} from '../types/deployment.types';

// Base Request for Deployment Routes
const baseRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: DeploymentParams
};

// Create cloud formation template for user deployment Schema
const CreateCloudFormationTemplateSchema = {
    ...baseRequest,
    description: 'Create Cloud formation template in a region for existing vpc',
    body: CloudFormationTemplateRequestBody,
    response: {
        200: CloudFormationTemplateResponse
    }
};

// Create cloud formation template for user deployment Schema
const DeployTemplateSchema = {
    ...baseRequest,
    description: 'Deploy cloud formation template to provision SQL FCI',
    body: CloudFormationTemplateRequestBody,
    response: {
        200: DeployTemplateResponse
    }
};

export { CreateCloudFormationTemplateSchema, DeployTemplateSchema };
