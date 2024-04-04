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
    DeploymentSummaryListResponse,
    CloudFormationTemplateHeader,
    FsxAvailableRegionsForThroughputListResponse,
    CollationListResponse,
    CollationListQueryString
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
    headers: CloudFormationTemplateHeader,
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
    headers: CloudFormationTemplateHeader,
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

const FsxAvailableRegionsForThroughputSchema = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams,
    summary: 'Get list of fsx available regions for 4 GBps of throughput capacity',
    description: 'API to get region list to provision FSX 4 GBps of throughput capacity',
    response: {
        200: FsxAvailableRegionsForThroughputListResponse
    }
};

const CollationListSchema = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams,
    summary: 'Get collation list for mssql deployment',
    description: 'API to get collation details for given mssql version deployment',
    querystring: CollationListQueryString,
    response: {
        200: CollationListResponse
    }
};

export {
    DeployTemplateSchema,
    DeploymentStatusListSchema,
    DeploymentStatusSchema,
    CloudFormationTemplateSchema,
    DeploymentSummaryListSchema,
    FsxAvailableRegionsForThroughputSchema,
    CollationListSchema
};
