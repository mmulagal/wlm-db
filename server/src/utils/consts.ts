import { readFileSync } from 'fs';
import config from 'config';
import { join } from 'path';

//General
export const APP_NAME = 'Workload Manager for DB';
export const API_TITLE = 'Workload Manager for DB API';

// local storage keys
export const USER_TOKEN = 'USER_TOKEN';
export const REQUEST_ID = 'REQUEST_ID';
export const ACCOUNT_ID = 'ACCOUNT_ID';
export const AGENT_ID = 'AGENT_ID';
export const AUDIT_GROUP = 'AUDIT_GROUP';
export const WORKSPACE_ID = 'WORKSPACE_ID';

// Attributes used to determine Amazon FSx for NetApp ONTAP.
export const FSX_FILESYSTEM_TYPE = 'ONTAP';
export const FSX_STORAGE_TYPE = 'SSD';

// version
export const VERSION: string = JSON.parse(readFileSync(join(process.cwd(), 'package.json')).toString()).version;

export const AUTH0_SERVER_ADDRESS = process.env.AUTH0_ENDPOINT
    ? `https://${process.env.AUTH0_ENDPOINT}`
    : config.get<string>('urls.auth0');

export enum HEADERS {
    AGENT_ID = 'x-agent-id',
    AUTHORIZATION = 'authorization',
    REQUEST_ID = 'x-request-id',
    SERVICE_REQUEST_ID = 'x-service-request-id',
    TENANCY_ACCOUNT_ID = 'x-tenancy-account-id',
    CERTIFICATE_AUTHORITY = 'x-certificate-authority',
    WORKSPACE_ID = 'x-workspace-id',
    TOKEN = 'x-token',
    ENDPOINT = 'x-endpoint',
    CERTIFICATE = 'x-certificate',
    KEY = 'x-key',
    REGION = 'x-region',
    NETAPP_WLMSQL_REQUEST_ID = 'x-netapp-wlmsql-request-id',
    SIMULATOR = 'x-simulator'
}

export const API_PATH_HEALTH: string = '/health';

export const CONNECTOR_ENDPOINT: string = process.env.CLOUD_MANAGER_ENDPOINT
    ? `http://${process.env.CLOUD_MANAGER_ENDPOINT}`
    : !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
    ? config.get<string>('urls.local-connector')
    : config.get<string>('urls.cloud-manager');

export const CLOUD_MANAGER_SERVER_ADDRESS = config.get<string>('urls.cloud-manager');

// Default values used in test routines.
export const DEFAULT_AWS_CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';
export const DEFAULT_AWS_CREDENTIALS_TYPE = 'aws_assume_role';
export const DEFAULT_AWS_REGION = 'us-east-1';
export const DEFAULT_AWS_VPC_ID = 'vpc-84b3afe6';

export const CLOUD_MANAGER_ENDPOINT: string = config.get<string>('urls.cloud-manager');
export const TENANCY_ENDPOINT: string = `${CLOUD_MANAGER_ENDPOINT}/tenancy`;
export const AGENTS_MANAGEMENT_ENDPOINT: string = `${CLOUD_MANAGER_ENDPOINT}/agents-mgmt`;
export const SIGNOZ_ENDPOINT: string = config.get<string>('urls.signoz');

export const CREDENTIALS_ENDPOINT: string = config.get<string>('urls.cloud-manager');

export const CLOUD_MANAGER_GET_CVO_WE_PREFIX = '/occm/api/working-environments';

export const RESOURCE_CLASS = 'STORAGE_SERVICES';

// Kinesis
export const KINESIS_STREAM_NAME = 'audit-service-staging-stream';

export enum CredentialsType {
    AWS = 'aws_assume_role',
    AZURE = 'azure_service_principal'
}

export enum CloudProviders {
    AWS = 'AWS',
    AZURE = 'AZURE',
    GCP = 'GCP'
}

export enum RouteTags {
    AWS = 'AWS',
    GENERIC = 'Generic',
    SYSTEM = 'System'
}

export enum HttpErrorCodes {
    INTERNAL_SERVER_ERROR = '500',
    NOT_FOUND = '404',
    UNAUTHORIZED = '401',
    FORBIDDEN = '403'
}

export const VPC_COUNT_QUOTANAME = 'VPCs per Region';

export const CF_STACK_COUNT_QUOTANAME = 'Stack count';

// Carries number of stacks that will be deployed.
export const STACKS_DEPLOYED = 5;

export enum AWSServiceNames {
    VPC = 'vpc',
    CLOUDFORMATION = 'cloudformation'
}

export const CARGO = 'cargo';

export const AUTH0_AUDIENCE = config.get<string>('jwt.audience.tenancy');

export const KEY_VAULT_URL: string = process.env.KEY_VAULT_URL as string;

export const SECRETS: Record<string, string | undefined> = {
    CLIENT_ID: process.env.CLIENT_ID
        ? process.env.CLIENT_ID
        : config.has('service-token.client_id')
        ? config.get('service-token.client_id')
        : undefined,
    CLIENT_SECRET: process.env.CLIENT_SECRET
        ? process.env.CLIENT_SECRET
        : config.has('service-token.client_secret')
        ? config.get('service-token.client_secret')
        : undefined,
    AUDIT_ACCESS_KEY: process.env.AUDIT_ACCESS_KEY
        ? process.env.AUDIT_ACCESS_KEY
        : config.has('audit.access-key')
        ? config.get('audit.access-key')
        : undefined,
    AUDIT_SECRET_KEY: process.env.AUDIT_SECRET_KEY
        ? process.env.AUDIT_SECRET_KEY
        : config.has('audit.secret-key')
        ? config.get('audit.secret-key')
        : undefined
};

export const SECRETS_KEY_VAULT_KEYS: Record<string, string> = {
    CLIENT_ID: 'WLM-DB-CLIENT-ID',
    CLIENT_SECRET: 'WLM-DB-CLIENT-SECRET',
    AUDIT_ACCESS_KEY: 'WLM-DB-AUDIT-ACCESS-KEY',
    AUDIT_SECRET_KEY: 'WLM-DB-AUDIT-SECRET-KEY'
};

export const DEMO_ACCOUNT_ID = 'account-j3aZttuL';

export const SECRET_WORDS = [
    'credentials',
    'passphrase',
    'certificateAuthority',
    'clientCertificate',
    'authorization',
    'secretAccessKey',
    'accessKeyId',
    'sessionToken',
    'token',
    'secretkey',
    'accesskey',
    'password',
    'clientSecret',
    'clientId',
    'x-token',
    'x-certificate-authority',
    'clientKey',
    'client_id',
    'client_secret',
    'access_token',
    'secretAccessKey',
    'accessKeyId',
    'authorization',
    'SessionToken',
    'AccessKeyId',
    'SecretAccessKey',
    'username'
];

export const SQL_AMI_NAMES = [
    'Windows_Server-2016-English-Full-SQL_2017_Enterprise*',
    'Windows_Server-2016-English-Full-SQL_2019_Standard*',
    'Windows_Server-2019-English-Full-SQL_2019_Enterprise*',
    'Windows_Server-2019-English-Full-SQL_2019_Standard*',
    'Windows_Server-2022-English-Full-SQL_2017_Standard*',
    'Windows_Server-2022-English-Full-SQL_2017_Enterprise*',
    'Windows_Server-2022-English-Full-SQL_2019_Enterprise*',
    'Windows_Server-2022-English-Full-SQL_2019_Standard*',
    'Windows_Server-2019-English-Full-SQL_2022_Enterprise*',
    'Windows_Server-2019-English-Full-SQL_2022_Standard*',
    'Windows_Server-2022-English-Full-SQL_2022_Enterprise*',
    'Windows_Server-2016-English-Full-SQL_2016_SP*_Enterprise*',
    'Windows_Server-2022-English-Full-SQL_2022_Standard*',
    'Windows_Server-2019-English-Full-SQL_2016_SP*_Enterprise*',
    'Windows_Server-2019-English-Full-SQL_2017_Enterprise*',
    'Windows_Server-2016-English-Full-SQL_2017_Standard*',
    'Windows_Server-2016-English-Full-SQL_2016_SP*_Standard*',
    'Windows_Server-2019-English-Full-SQL_2016_SP*_Standard*',
    'Windows_Server-2019-English-Full-SQL_2017_Standard*',
    'Windows_Server-2016-English-Full-SQL_2019_Enterprise*'
];

export enum AWSQueryFields {
    SUBNET = 'subnet',
    SECURITY_GROUP = 'securitygroup'
}

export const SECRETS_MANAGER = 'secretsmanager';
export const SECRECTS_MANAGER_ACTION_NAMES = [
    'GetSecretValue',
    'CreateSecret',
    'GetRandomPassword',
    'DeleteSecret',
    'ListSecretVersionIds',
    'TagResource',
    'UntagResource',
    'PutResourcePolicy',
    'DeleteResourcePolicy',
    'GetSecretValue',
    'ListSecrets'
].map(action => `${SECRETS_MANAGER}:${action}`);

export const KMS = 'kms';
export const KMS_ACTION_NAMES = ['ListKeys', 'ListAliases'].map(action => `${KMS}:${action}`);

export const EC2 = 'ec2';
export const EC2_ACTION_NAMES = [
    'CreateVpc',
    'AssignPrivateIpAddresses',
    'RunInstances',
    'AttachNetworkInterface',
    'AssociateRouteTable',
    'DeleteSubnet',
    'GetConsoleOutput',
    'CreateKeyPair',
    'AssociateAddress',
    'StartInstances',
    'AttachVolume',
    'AssociateVpcCidrBlock',
    'DetachNetworkInterface',
    'GetPasswordData',
    'CreateRoute',
    'CreateNetworkInterface',
    'ModifyInstanceAttribute',
    'DeleteSecurityGroup',
    'DeleteNetworkAcl',
    'DisassociateAddress',
    'ReplaceRoute',
    'CreateRouteTable',
    'CreateVolume',
    'ModifySubnetAttribute',
    'DeleteVolume',
    'DeleteNetworkInterface',
    'DisassociateVpcCidrBlock',
    'ReleaseAddress',
    'CreateSubnet',
    'CreateVpcEndpoint',
    'ModifyVolumeAttribute',
    'DeleteKeyPair',
    'DeleteNetworkInterfacePermission',
    'ModifyNetworkInterfaceAttribute',
    'ReplaceRouteTableAssociation',
    'AllocateAddress',
    'CreateTags',
    'ModifyVpcAttribute',
    'DeleteVpc',
    'DeleteRoute',
    'ModifyVolume',
    'RevokeSecurityGroupEgress',
    'AllocateHosts',
    'DeleteTags',
    'AssociateSubnetCidrBlock',
    'DetachVolume',
    'DeleteRouteTable',
    'AuthorizeSecurityGroupEgress',
    'RevokeSecurityGroupIngress',
    'DisassociateIamInstanceProfile',
    'DisassociateRouteTable',
    'DisassociateSubnetCidrBlock',
    'ModifyInstancePlacement',
    'DeletePlacementGroup',
    'CreatePlacementGroup',
    'StopInstances',
    'TerminateInstances',
    'Describe*',
    'Get*'
].map(action => `${EC2}:${action}`);

export const CLOUDFORMATION = 'cloudformation';
export const CLOUDFORMATION_ACTION_NAMES = [
    'cloudformation',
    'GetTemplateSummary',
    'DescribeStack*',
    'Get*',
    'ListStacks',
    'SignalResource',
    'DeleteStack',
    'DescribeAccountLimits',
    'DescribeStackDriftDetectionStatus',
    'List*',
    'ValidateTemplate',
    'Describe*',
    'CreateStack'
].map(action => `${CLOUDFORMATION}:${action}`);

export const IAM = 'iam';
export const IAM_ACTION_NAMES = [
    'CreateInstanceProfile',
    'DeleteInstanceProfile	',
    'RemoveRoleFromInstanceProfile',
    'AddRoleToInstanceProfile',
    'GetRole',
    'GetRolePolicy	',
    'GetUser',
    'GetPolicyVersion',
    'GetPolicy',
    'List*'
].map(action => `${IAM}:${action}`);

export const SNS = 'sns';
export const SNS_ACTION_NAMES = [
    'ListSubscriptionsByTopic',
    'Publish',
    'CreateTopic',
    'DeleteTopic',
    'Subscribe',
    'Unsubscribe'
].map(action => `${SNS}:${action}`);

export const RESOURCE_GROUPS = 'resource-groups';
export const RESOURCE_GROUPS_ACTION_NAMES = ['CreateGroup', 'List*', 'DeleteGroup', 'Get*'].map(
    action => `${RESOURCE_GROUPS}:${action}`
);

export const S3 = 's3';
export const S3_ACTION_NAMES = ['CreateBucket', 'PutBucketVersioning', 'DeleteBucket'].map(action => `${S3}:${action}`);

export const FSX = 'fsx';
export const FSX_ACTION_NAMES = [
    'CreateFileSystem',
    'DeleteFileSystem',
    'ListTagsForResource',
    'TagResource',
    'UntagResource',
    'DescribeFileSystems'
].map(action => `${FSX}:${action}`);

export const SERVICE_QUOTAS = 'servicequotas';
export const SERVICE_QUOTAS_ACTION_NAMES = ['GetServiceQuota', 'ListServiceQuotas'].map(
    action => `${SERVICE_QUOTAS}:${action}`
);

export const AWS_RESOURCES_ACTION_MAP = {
    [SECRETS_MANAGER]: SECRECTS_MANAGER_ACTION_NAMES,
    [KMS]: KMS_ACTION_NAMES,
    [EC2]: EC2_ACTION_NAMES,
    [CLOUDFORMATION]: CLOUDFORMATION_ACTION_NAMES,
    [IAM]: IAM_ACTION_NAMES,
    [SNS]: SNS_ACTION_NAMES,
    [RESOURCE_GROUPS]: RESOURCE_GROUPS_ACTION_NAMES,
    [S3]: S3_ACTION_NAMES,
    [FSX]: FSX_ACTION_NAMES,
    [SERVICE_QUOTAS]: SERVICE_QUOTAS_ACTION_NAMES
};
// List of regions having "Amazon FSx for NetApp ONTAP" service.
// List taken from https://www.aws-services.info/fsx-ontap.html
export const FSX_SUPPORTED_REGIONS = new Map<string, string>([
    // "Region Code"    "Region Name"
    // -------------    -------------
    ['af-south-1', 'Africa (Cape Town)'],
    ['ap-east-1', 'Asia Pacific (Hong Kong)'],
    ['ap-northeast-1', 'Asia Pacific (Tokyo)'],
    ['ap-northeast-2', 'Asia Pacific (Seoul)'],
    ['ap-south-1', 'Asia Pacific (Mumbai)'],
    ['ap-south-2', 'Asia Pacific (Hyderabad)'],
    ['ap-southeast-1', 'Asia Pacific (Singapore)'],
    ['ap-southeast-2', 'Asia Pacific (Sydney)'],
    ['ap-southeast-3', 'Asia Pacific (Jakarta)'],
    ['ap-southeast-4', 'Asia Pacific (Melbourne)'],
    ['ca-central-1', 'Canada (Central)'],
    ['eu-central-1', 'Europe (Frankfurt)'],
    ['eu-central-2', 'Europe (Zurich)'],
    ['eu-north-1', 'Europe (Stockholm)'],
    ['eu-south-1', 'Europe (Milan)'],
    ['eu-south-2', 'Europe (Spain)'],
    ['eu-west-1', 'Europe (Ireland)'],
    ['eu-west-2', 'Europe (London)'],
    ['eu-west-3', 'Europe (Paris)'],
    ['me-central-1', 'Middle East (UAE)'],
    ['me-south-1', 'Middle East (Bahrain)'],
    ['sa-east-1', 'South America (Sao Paulo)'],
    ['us-east-1', 'US East (N. Virginia)'],
    ['us-east-2', 'US East (Ohio)'],
    ['us-gov-east-1', 'AWS GovCloud (US-East)'],
    ['us-gov-west-1', 'AWS GovCloud (US-West)'],
    ['us-west-1', 'US West (N. California)'],
    ['us-west-2', 'US West (Oregon)']
]);

export const EC2INSTANCETYPESE_EXCLUDE = [
    '.nano',
    '.micro',
    '.small',
    '.large',
    'gd',
    'gn',
    't3a',
    't3g',
    'mac',
    'm7g',
    'C7g',
    'Im4gn'
];

export const WLMDB = 'wlmdb';
