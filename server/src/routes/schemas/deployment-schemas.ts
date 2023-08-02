import { RouteTags } from '../../utils/consts';
import {
    CloudFormationTemplateRequestBody,
    DeploymentParams,
    CloudFormationTemplateResponse
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

export { CreateCloudFormationTemplateSchema };
