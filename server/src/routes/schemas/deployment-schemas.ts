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
    CloudFormationTemplateHeader,
    FsxAvailableRegionsForThroughputListResponse,
    CollationListResponse,
    CollationListQueryString,
    PgSqlCloudFormationTemplateRequestBody,
    PgSqlCloudFormationDeploymentResponse,
    TerraformSetupRequestBody,
    TerraformSetupResponse
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

// PGSQL CloudFormation template
const PgSqlCloudFormationTemplateSchema = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams,
    summary: 'Create PgSQL CloudFormation template',
    headers: CloudFormationTemplateHeader,
    description: 'Create CloudFormation template in URL, YAML and CLI format for PgSql deployment',
    body: PgSqlCloudFormationTemplateRequestBody,
    response: {
        200: CloudFormationStaticTemplateResponse
    }
};

// Create CloudFormation template or Deploy Schema
const DeployTemplateSchema = {
    ...baseRequest,
    headers: CloudFormationTemplateHeader,
    summary: 'Deploy CloudFormation template for ms sql',
    description: 'Deploy CloudFormation template to provision MS SQL',
    body: CloudFormationTemplateRequestBody,
    response: {
        202: CloudFormationDeploymentResponse
    }
};

const PgSqlDeployTemplateSchema = {
    ...baseRequest,
    headers: CloudFormationTemplateHeader,
    summary: 'Deploy CloudFormation template for pgsql',
    description: 'Deploy CloudFormation template to provision PGSQL',
    body: PgSqlCloudFormationTemplateRequestBody,
    response: {
        202: PgSqlCloudFormationDeploymentResponse
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
    tags: [RouteTags.AWS],
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

const TerraformSetupSchema = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams,
    summary: 'Create Terraform Setup for MSSQL',
    headers: CloudFormationTemplateHeader,
    description: 'Create Terraform Setup in URL for MSSQL user deployment',
    body: TerraformSetupRequestBody,
    response: {
        200: TerraformSetupResponse
    }
};

const PgSqlTerraformSetupSchema = {
    tags: [RouteTags.DEPLOYMENT],
    params: AccountIdParams,
    headers: CloudFormationTemplateHeader,
    summary: 'Create Terraform setup for PGSQL',
    description: 'Create Terraform setup in URL for pgsql user deploymen',
    body: PgSqlCloudFormationTemplateRequestBody,
    response: {
        202: TerraformSetupResponse
    }
};

export {
    DeployTemplateSchema,
    DeploymentStatusListSchema,
    DeploymentStatusSchema,
    CloudFormationTemplateSchema,
    FsxAvailableRegionsForThroughputSchema,
    CollationListSchema,
    PgSqlDeployTemplateSchema,
    TerraformSetupSchema,
    PgSqlCloudFormationTemplateSchema,
    PgSqlTerraformSetupSchema
};
