import { RouteTags } from '../../utils/consts';
import { AwsParamsWithRegion } from '../types/aws.types';
import {
    CloudFormationTemplateRequestBody,
    CloudFormationDeploymentResponse,
    DeploymentStatusListResponse,
    DeploymentStatusResponse,
    DeploymentStatusObjectParams,
    CloudFormationStaticTemplateRequestBody,
    CloudFormationStaticTemplateResponse,
    DeploymentSummaryQueryString,
    DeploymentSummaryListResponse
} from '../types/deployment.types';
import { AccountIdParams } from '../types/generic.types';

// Base Request for Deployment Routes
const baseRequest = {
    tags: [RouteTags.DEPLOYMENT],
    params: AwsParamsWithRegion
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

const DeploymentSummaryListSchema = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams,
    summary: 'Get deployment jobs summary',
    description: 'API to get deployment jobs summary for given deployment status types',
    querystring: DeploymentSummaryQueryString,
    response: {
        200: DeploymentSummaryListResponse
    }
};

// Create CloudFormation template or Deploy Schema
const DeployTemplateSchema = {
    ...baseRequest,
    summary: 'Deploy CloudFormation template',
    description: 'Deploy CloudFormation template to provision SQL FCI',
    body: CloudFormationTemplateRequestBody,
    response: {
        200: CloudFormationDeploymentResponse
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
    DeployTemplateSchema,
    DeploymentStatusListSchema,
    DeploymentStatusSchema,
    CloudFormationTemplateSchema,
    DeploymentSummaryListSchema
};
