import { readFileSync } from 'fs';
import config from 'config';
import { join } from 'path';
import moment from 'moment';
import { DEPLOYMENT_STATUS } from '@prisma/client';
import { MissingPermission } from './common-types';

type SubJobDescriptions = {
    [key: string]: string;
};

// General
const APP_NAME = 'Workload Manager for DB';
const API_TITLE = 'Workload Manager for DB API';

// local storage keys
const USER_TOKEN = 'USER_TOKEN';
const REQUEST_ID = 'REQUEST_ID';
const ACCOUNT_ID = 'ACCOUNT_ID';
const AGENT_ID = 'AGENT_ID';
const AUDIT_GROUP = 'AUDIT_GROUP';
const WORKSPACE_ID = 'WORKSPACE_ID';
const SERVICE_TOKEN = 'SERVICE_TOKEN';
const TOKEN_EXPIRATION_TIME = 'TOKEN_EXPIRATION_TIME';

// Attributes used to determine Amazon FSx for NetApp ONTAP.
const FSX_FILESYSTEM_TYPE = 'ONTAP';
const FSX_STORAGE_TYPE = 'SSD';
const FSX_RESOURCE_TYPE = 'FSX_ONTAP';
const FSX_BATCH_CONCURRENCY_VALUE = 10;

enum FileSystemDeploymentType {
    SINGLE_AZ_1,
    MULTI_AZ_1,
    SINGLE_AZ_2
}

// version
const VERSION: string = JSON.parse(readFileSync(join(process.cwd(), 'package.json')).toString()).version;

const AUTH0_SERVER_ADDRESS = process.env.AUTH0_ENDPOINT
    ? `https://${process.env.AUTH0_ENDPOINT}`
    : config.get<string>('urls.auth0');

enum HEADERS {
    AUTHORIZATION = 'authorization',
    REQUEST_ID_HEADER = 'x-request-id',
    SERVICE_REQUEST_ID = 'x-service-request-id',
    TENANCY_ACCOUNT_ID = 'x-tenancy-account-id',
    CERTIFICATE_AUTHORITY = 'x-certificate-authority',
    WORKSPACE_ID_HEADER = 'x-workspace-id',
    TOKEN = 'x-token',
    ENDPOINT = 'x-endpoint',
    CERTIFICATE = 'x-certificate',
    KEY = 'x-key',
    REGION = 'x-region',
    NETAPP_WLMSQL_REQUEST_ID = 'x-netapp-wlmsql-request-id',
    SIMULATOR = 'x-simulator',
    REFERER = 'referer',
    ACTIVE_TRACE_ID = 'active-trace-id',
    X_NETAPP_REFERER = 'x-netapp-referer'
}

const API_PATH_HEALTH: string = '/health';

// TODO: These variables are not used anywhere. Remove them later.
// const CONNECTOR_ENDPOINT: string = process.env.CLOUD_MANAGER_ENDPOINT
//     ? `http://${process.env.CLOUD_MANAGER_ENDPOINT}`
//     : !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
//     ? config.get<string>('urls.local-connector')
//     : config.get<string>('urls.cloud-manager');

const CLOUD_MANAGER_SERVER_ADDRESS = config.get<string>('urls.cloud-manager');

// Audit
const AUDIT_EXCLUDE_LIST = ['/batch', '/prompt', '/pricing'];
const DEFAULT_AWS_REGION = process.env.REGION || 'us-east-1';

const DEFAULT_AWS_CREDENTIALS_TYPE = 'aws_assume_role';

const CLOUD_MANAGER_ENDPOINT: string = process.env.CLOUD_MANAGER_ENDPOINT
    ? `https://${process.env.CLOUD_MANAGER_ENDPOINT}`
    : config.get<string>('urls.cloud-manager');
const TENANCY_ENDPOINT: string = `${CLOUD_MANAGER_ENDPOINT}/tenancy`;
const AGENTS_MANAGEMENT_ENDPOINT: string = `${CLOUD_MANAGER_ENDPOINT}/agents-mgmt`;
const SIGNOZ_ENDPOINT: string = process.env.SIGNOZ_ENDPOINT
    ? `http://${process.env.SIGNOZ_ENDPOINT}`
    : config.get<string>('urls.signoz');
const WORKLOAD_FACTORY_ENDPOINT: string = process.env.WORKLOAD_FACTORY_ENDPOINT
    ? `https://${process.env.WORKLOAD_FACTORY_ENDPOINT}`
    : config.get<string>('urls.workload-factory');
const WLMDB_ABSOLUTE_ENDPOINT: string = process.env.WLMDB_ABSOLUTE_ENDPOINT
    ? `https://${process.env.WLMDB_ABSOLUTE_ENDPOINT}`
    : config.get('urls.wlm-db-redirect-url');
const WF_CONSOLE_ENDPOINT: string = config.get('urls.workload-factory-console');

const CREDENTIALS_ENDPOINT: string = CLOUD_MANAGER_ENDPOINT || config.get<string>('urls.cloud-manager');

const CLOUD_MANAGER_GET_CVO_WE_PREFIX = '/occm/api/working-environments';

const RESOURCE_CLASS = 'STORAGE_SERVICES';
const WLMDB_RESOURCE_CLASS = 'WLMDB';
enum DatabaseTypes {
    MS_SQL_SERVER = 'MSSQL'
}

const AWS_RESOURCE_NAME_TAG = 'Name';
// Kinesis
const KINESIS_STREAM_NAME = process.env.KINESIS_STREAM_NAME || config.get('kinesis.stream-name');

enum CredentialsType {
    AWS = 'aws_assume_role',
    AZURE = 'azure_service_principal'
}

enum CloudProviders {
    AWS = 'AWS',
    AZURE = 'AZURE',
    GCP = 'GCP'
}

enum DeploymentState {
    INITIALIZING = 'Initializing',
    SUCCESS = 'Success',
    FAILED = 'Failed'
}

enum RouteTags {
    AWS = 'AWS',
    BATCH = 'Batch',
    CHATBOT = 'Chatbot',
    DATABASE = 'Database',
    DEPLOYMENT = 'Deployment',
    DISCOVER = 'Discover',
    GENERIC = 'Generic',
    JOB_MONITORING = 'Job Monitoring',
    PRICING = 'Pricing',
    RESOURCE = 'Resource',
    SYSTEM = 'System',
    WORKING_ENVIRONMENT = 'Working Environment',
    STORAGE_SAVINGS = 'Storage Savings',
    SANDBOX = 'Sandbox'
}

enum HttpErrorCodes {
    // Client errors
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    VALIDATION_ERROR = 422,
    FAILED_DEPENDENCY = 424,

    // Server errors
    INTERNAL_SERVER_ERROR = 500,
    SERVICE_UNAVAILABLE = 503
}

enum SqlServerDeploymentModel {
    SQL_STANDALONE = 'Standalone Instance',
    SQL_FCI = 'Always On Failover Cluster Instance',
    SQL_STANDALONE_SHORT = 'Standalone',
    SQL_FCI_SHORT = 'FCI'
}

const VPC_COUNT_QUOTANAME = 'VPCs per Region';

const CF_STACK_COUNT_QUOTANAME = 'Stack count';

// Carries number of stacks that will be deployed.
const STACKS_DEPLOYED = 5;

enum AWSServiceNames {
    VPC = 'vpc',
    CLOUDFORMATION = 'cloudformation'
}

const CARGO = 'cargo';

const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE
    ? `https://${process.env.AUTH0_AUDIENCE}`
    : config.get<string>('jwt.audience.tenancy');

const SECRETS: Record<string, string | undefined> = {
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
    DATABASE_URL: process.env.DATABASE_URL
};

const SECRETS_MANAGER_KEYS: Record<string, string> = {
    CLIENT_ID: 'CLIENT_ID',
    CLIENT_SECRET: 'CLIENT_SECRET',
    DATABASE_URL: 'DATABASE_URL',
    SIGNURL_ACCESS_KEY: 'SIGNURL_ACCESS_KEY',
    SIGNURL_SECRET_KEY: 'SIGNURL_SECRET_KEY',
    AUTH_CLIENT_ID: 'AUTH-CLIENT-ID',
    AUTH_CLIENT_SECRET: 'AUTH-CLIENT-SECRET'
};

const DEMO_ACCOUNT_ID = 'account-j3aZttuL';

const SECRET_WORDS = [
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
    'username',
    'domainPassword',
    'fsxPassword',
    'serviceAccountPassword',
    'fsxNPassword',
    'fsxSecret',
    'domainAdminSecret',
    'sqlServiceAccountSecret'
];

const SECRET_STRING_WORDS = [
    'param_FSxAdminPassword',
    'param_SQLServiceAccountPassword',
    'param_DomainAdminPassword',
    'domainPassword',
    'serviceAccountPassword',
    'fsxPassword',
    'password'
];

const SQL_AMI_NAMES = [
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

enum AWSQueryFields {
    SUBNET = 'subnet',
    SECURITY_GROUP = 'securitygroup'
}

enum RESOURCESTYPE {
    MSSQL = 'MSSQL',
    FSX = 'FSX'
}

const SERVER_TYPE_MAPPING = new Map<string, string>([[RESOURCESTYPE.MSSQL, 'Microsoft SQL Server']]);

enum FileSystemTypes {
    EBS = 'EBS',
    FSXONTAP = 'FSx for ONTAP',
    FSXWINDOWS = 'FSx for Windows'
}

const SECRETS_MANAGER = 'secretsmanager';
const SECRECTS_MANAGER_ACTION_NAMES = ['CreateSecret', 'GetSecretValue', 'ListSecrets'].map(
    action => `${SECRETS_MANAGER}:${action}`
);

const SSM = 'ssm';
const SSM_ACTION_NAMES = [
    'Describe*',
    'Get*',
    'List*',
    'PutComplianceItems',
    'PutConfigurePackageResult',
    'PutInventory',
    'SendCommand',
    'UpdateAssociationStatus',
    'UpdateInstanceAssociationStatus',
    'UpdateInstanceInformation'
].map(action => `${SSM}:${action}`);

const KMS = 'kms';
const KMS_ACTION_NAMES = ['CreateGrant', 'Describe*', 'List*'].map(action => `${KMS}:${action}`);

const LOGS = 'logs';
const LOGS_ACTION_NAMES = [
    'CreateLogGroup',
    'CreateLogStream',
    'DescribeLog*',
    'GetLog*',
    'ListLogDeliveries',
    'PutLogEvents',
    'TagResource'
].map(action => `${LOGS}:${action}`);

const PRICING = 'pricing';
// const PRICING_ACTION_NAMES = ['GetProducts'].map(action => `${PRICING}:${action}`);
const BILLING = 'billing';

const EC2 = 'ec2';
const EC2_ACTION_NAMES = [
    'AuthorizeSecurityGroupEgress',
    'AuthorizeSecurityGroupIngress',
    'CreateLaunchTemplate',
    'CreateLaunchTemplateVersion',
    'CreateNetworkInterface',
    'CreateSecurityGroup',
    'CreateTags',
    'DeleteSecurityGroup',
    'Describe*',
    'Get*',
    'RevokeSecurityGroupEgress',
    'RevokeSecurityGroupIngress',
    'RunInstances'
].map(action => `${EC2}:${action}`);

const CLOUDFORMATION = 'cloudformation';
const CLOUDFORMATION_ACTION_NAMES = [
    'CreateStack',
    'DescribeStackEvents',
    'DescribeStacks',
    'ListStacks',
    'ValidateTemplate'
].map(action => `${CLOUDFORMATION}:${action}`);

const IAM = 'iam';
const IAM_ACTION_NAMES = [
    'AddRoleToInstanceProfile',
    'CreateInstanceProfile',
    'CreateRole',
    'DeleteInstanceProfile',
    'GetPolicy',
    'GetPolicyVersion',
    'GetRole',
    'GetRolePolicy',
    'GetUser',
    'PutRolePolicy',
    'RemoveRoleFromInstanceProfile',
    'SimulatePrincipalPolicy'
].map(action => `${IAM}:${action}`);

const DS = 'ds';
const DS_ACTION_NAMES = ['DescribeDirectories'].map(action => `${DS}:${action}`);

const EC2_MESSAGES = 'ec2messages';
const EC2_MESSAGES_ACTION_NAMES = ['*'].map(action => `${EC2_MESSAGES}:${action}`);

const SSM_MESSAGES = 'ssmmessages';
const SSM_MESSAGES_ACTION_NAMES = ['*'].map(action => `${SSM_MESSAGES}:${action}`);

const SNS = 'sns';
const SNS_ACTION_NAMES = ['ListTopics', 'Publish'].map(action => `${SNS}:${action}`);

const FSX = 'fsx';
const FSX_ACTION_NAMES = ['CreateFileSystem', 'CreateStorageVirtualMachine', 'CreateVolume', 'Describe*', 'List*'].map(
    action => `${FSX}:${action}`
);

const SERVICE_QUOTAS = 'servicequotas';
const SERVICE_QUOTAS_ACTION_NAMES = ['ListServiceQuotas'].map(action => `${SERVICE_QUOTAS}:${action}`);

// strict actions
const SECRECTS_MANAGER_STRICT_ACTION_NAMES = ['PutResourcePolicy', 'TagResource'].map(
    action => `${SECRETS_MANAGER}:${action}`
);

const CLOUDFORMATION_STRICT_ACTION_NAMES = ['SignalResource'].map(action => `${CLOUDFORMATION}:${action}`);

const EC2_STRICT_CONDITION_ACTION_NAMES = [
    'AllocateAddress',
    'AllocateHosts',
    'AssignPrivateIpAddresses',
    'AssociateAddress',
    'AssociateRouteTable',
    'AssociateSubnetCidrBlock',
    'AssociateVpcCidrBlock',
    'AttachInternetGateway',
    'AttachNetworkInterface',
    'AttachVolume',
    'AuthorizeSecurityGroupEgress',
    'AuthorizeSecurityGroupIngress',
    'CreateVolume',
    'DeleteNetworkInterface',
    'DeleteSecurityGroup',
    'DeleteTags',
    'DeleteVolume',
    'DetachNetworkInterface',
    'DetachVolume',
    'DisassociateAddress',
    'DisassociateIamInstanceProfile',
    'DisassociateRouteTable',
    'DisassociateSubnetCidrBlock',
    'DisassociateVpcCidrBlock',
    'ModifyInstanceAttribute',
    'ModifyInstancePlacement',
    'ModifyNetworkInterfaceAttribute',
    'ModifySubnetAttribute',
    'ModifyVolume',
    'ModifyVolumeAttribute',
    'ModifyVpcAttribute',
    'ReleaseAddress',
    'ReplaceRoute',
    'ReplaceRouteTableAssociation',
    'RevokeSecurityGroupEgress',
    'RevokeSecurityGroupIngress',
    'StartInstances',
    'StopInstances'
].map(action => `${EC2}:${action}`);

const FSX_STRICT_CONDITION_ACTION_NAMES = ['TagResource'].map(action => `${FSX}:${action}`);

const IAM_STRICT_CONDITION_ACTION_NAMES = ['CreateServiceLinkedRole', 'PassRole'].map(action => `${IAM}:${action}`);

const AWS_RESOURCES_ACTION_MAP = {
    [SECRETS_MANAGER]: SECRECTS_MANAGER_ACTION_NAMES,
    [SSM]: SSM_ACTION_NAMES,
    [LOGS]: LOGS_ACTION_NAMES,
    // [PRICING]: PRICING_ACTION_NAMES,
    [KMS]: KMS_ACTION_NAMES,
    [DS]: DS_ACTION_NAMES,
    [EC2_MESSAGES]: EC2_MESSAGES_ACTION_NAMES,
    [SSM_MESSAGES]: SSM_MESSAGES_ACTION_NAMES,
    [EC2]: EC2_ACTION_NAMES,
    [CLOUDFORMATION]: CLOUDFORMATION_ACTION_NAMES,
    [IAM]: IAM_ACTION_NAMES,
    [SNS]: SNS_ACTION_NAMES,
    [FSX]: FSX_ACTION_NAMES,
    [SERVICE_QUOTAS]: SERVICE_QUOTAS_ACTION_NAMES
};

const AWS_RESOURCES_STRICT_ACTION_MAP = {
    [SECRETS_MANAGER]: SECRECTS_MANAGER_STRICT_ACTION_NAMES,
    [CLOUDFORMATION]: CLOUDFORMATION_STRICT_ACTION_NAMES
};

const AWS_RESOURCES_STRICT_CONDITION_ACTION_MAP = {
    [EC2]: EC2_STRICT_CONDITION_ACTION_NAMES,
    [FSX]: FSX_STRICT_CONDITION_ACTION_NAMES,
    [IAM]: IAM_STRICT_CONDITION_ACTION_NAMES
};

const SECRET_MANAGER_ARN = 'arn:aws:secretsmanager:*:*:secret:wlmdb*';
const CLOUD_FORMATION_ARN = 'arn:aws:cloudformation:*:*:stack/WLMDB*';
const LOG_GROUP_ARN = 'arn:aws:logs:*:*:log-group:WLMDB*';
const EC2_TAG_CONDITION = 'ec2:ResourceTag/aws:cloudformation:stack-name';
const FSX_TAG_CONDITION = 'aws:ResourceTag/aws:cloudformation:stack-name';
const WLMDB_RESOURCE_TAG_VALUE = 'WLMDB*';
const IAM_LINKEDROLE_CONDITION = 'iam:AWSServiceName';
const IAM_PASSROLE_CONDITION = 'iam:PassedToService';
const IAM_EC2_SERVICE = 'ec2.amazonaws.com';

// List of AWS regions - taken from https://www.aws-services.info/regions.html
const AWS_REGIONS = new Map<string, string>([
    // "Region Code"    "Region Name"
    // -------------    -------------
    ['af-south-1', 'Africa (Cape Town)'],
    ['ap-east-1', 'Asia Pacific (Hong Kong)'],
    ['ap-northeast-1', 'Asia Pacific (Tokyo)'],
    ['ap-northeast-2', 'Asia Pacific (Seoul)'],
    ['ap-northeast-3', 'Asia Pacific (Osaka)'],
    ['ap-south-1', 'Asia Pacific (Mumbai)'],
    ['ap-south-2', 'Asia Pacific (Hyderabad)'],
    ['ap-southeast-1', 'Asia Pacific (Singapore)'],
    ['ap-southeast-2', 'Asia Pacific (Sydney)'],
    ['ap-southeast-3', 'Asia Pacific (Jakarta)'],
    ['ap-southeast-4', 'Asia Pacific (Melbourne)'],
    ['ca-central-1', 'Canada (Central)'],
    ['cn-north-1', 'China (Beijing)'],
    ['cn-northwest-1', 'China (Ningxia)'],
    ['eu-central-1', 'Europe (Frankfurt)'],
    ['eu-central-2', 'Europe (Zurich)'],
    ['eu-north-1', 'Europe (Stockholm)'],
    ['eu-south-1', 'Europe (Milan)'],
    ['eu-south-2', 'Europe (Spain)'],
    ['eu-west-1', 'Europe (Ireland)'],
    ['eu-west-2', 'Europe (London)'],
    ['eu-west-3', 'Europe (Paris)'],
    ['il-central-1', 'Israel (Tel Aviv)'],
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

const WLMDB = 'wlmdb';

const ARTIFACT_BUCKET_NAME = process.env.ARTIFACT_BUCKET_NAME || config.get<string>('bucket.artifacts');
const SIGNED_TEMPLATES_BUCKET_NAME = process.env.TEMPLATE_BUCKET_NAME || config.get<string>('bucket.signedTemplates');
const TEMPLATE_BUCKET_REGION = process.env.WLMDB_BUCKET_REGION || config.get<string>('bucket.region');
const CF_DEPLOY_ROLE_NAME = 'CfDeployRoleName';
const VALIDATION_AMI = 'ValidationAmi';
const VALIDATION_INSTANCE_TYPE = 'ValidationNodeInstanceType';
const MSSQL_MEDIA_BUCKET_NAME = 'LaunchWizard-sqlha';
const MSSQL_MEDIA_PATH_KEY = 'launchwizardscripts/sqlmedia/sqlserver.iso';
const MASTER_TEMPLATE_PATH = 'templates/wlm-master.yaml';
const CLOUD_FORMATION_STACK_URL = `https://${DEFAULT_AWS_REGION}.console.aws.amazon.com/cloudformation/home`;
const CLOUD_FORMATION_CLI_COMMAND = 'aws cloudformation create-stack';
const DISABLE_ROLLBACK = true;
// In private network, time taken is longer
const MASTER_STACK_TIMEOUT_MINUTES = 240;
const FSX_SSD_MIN_SIZE = 1024; // in GiB
const FSX_SSD_MAX_SIZE = 211106; // in GiB

const TEMPLATE_USERNAME_MAPPING: Record<string, string> = {
    DomainAdminUser: 'DomainAdminUser',
    FSxAdminUsername: 'FSxAdminUsername',
    SQLServiceAccountName: 'SQLServiceAccountName'
};

const TEMPLATE_CONFIGURATION_MAPPING: Record<string, string> = {
    vpcId: 'VPCID',
    vpcCidr: 'VPCCIDR',
    vpcName: 'VPCName',
    privateSubnet1Id: 'PrivateSubnet1ID',
    routeTable1Id: 'RouteTable1Id',
    privateSubnet2Id: 'PrivateSubnet2ID',
    routeTable2Id: 'RouteTable2Id',

    adScenarioType: 'ADScenarioType',
    domainPassword: 'DomainAdminPassword',
    domainDnsname: 'DomainDNSName',
    dnsIpaddress: 'DNSIpAddresses',
    securityGroupId: 'DomainMemberSGID',

    fsxDeploymentMode: 'DeploymentMode',
    fsxFileSystemId: 'FSxFileSystemId',
    fsxPassword: 'FSxAdminPassword',
    fsxVolThroughput: 'FSxVolumeThroughputCapacity',
    fsxIOPS: 'FSxDiskIops',
    ontapSgGroupId: 'ONTAPSecurityGroupID',
    encryptionKey: 'FileSystemEncryptionKeyId',

    sqlDeploymentMode: 'SQLDeploymentMode',
    sqlAmiId: 'SQLAMIID',
    serviceAccountPassword: 'SQLServiceAccountPassword',
    sqlServerName: 'SqlServerName',
    sqlCollation: 'SqlCollation',

    workloadInstanceType: 'WorkloadInstanceType',
    keyPairName: 'KeyPairName',

    topicArn: 'NotificationARN',
    enableCloudWatch: 'EnableCloudWatchLogFeature',
    metrics: 'Metrics'
};

const TEMPLATE_OPTIONAL_PARAMETERS: Record<string, string> = {
    encryptionKey: 'FileSystemEncryptionKeyId',
    securityGroupId: 'DomainMemberSGID',
    privateSubnet1Id: 'PrivateSubnet1ID',
    routeTable1Id: 'RouteTable1Id',
    privateSubnet2Id: 'PrivateSubnet2ID',
    routeTable2Id: 'RouteTable2Id'
};

const WLM_ASSETS: Record<string, string> = {
    MSSQLMediaBucketName: MSSQL_MEDIA_BUCKET_NAME,
    MSSQLMediaPathKey: MSSQL_MEDIA_PATH_KEY
};

// Template error messages
const MISSING_PERMISSIONS = (implicitlyDenied: MissingPermission[], explicitlyDenied: MissingPermission[]) =>
    `Required permissions are not available to deploy cloud formation template. Implicitly denied: ${implicitlyDenied}. Explicitly denied: ${explicitlyDenied}`;

const CF_QUOTA_REACHED = `Cloud Formation for stacks has reached or about to reach region quota. Around ${STACKS_DEPLOYED} may be deployed as part of deployment.`;
const STANDALONE_NETWORK_VIOLATION_MESSAGE =
    'For standalone deployment, private subnet 1 Id and route table 1 Id cannot be empty.';

const FCI_NETWORK_EMPTY_VIOLATION_MESSAGE =
    'For FCI deployment, private subnet 1 Id, route table 1 Id, private subnet 2 Id and route table 2 Id cannot be empty.';

const FCI_NETWORK_ROUTE_TABLE_VIOLATION_MESSAGE =
    'The subnets in the selected Availability Zone are sharing the same route table. A multi-zone FSx for ONTAP deployment requires different route tables for each subnet. Modify the route table configuration or select a different subnet and try again.';

const FCI_NETWORK_VIOLATION_MESSAGE =
    'For fci deployment, privateSubnet1Id, routeTable1Id, privateSubnet2Id and routeTable2Id cannot be empty.The subnets in the selected Availability Zone are sharing the same route table. A multi-zone FSx for ONTAP deployment requires different route tables for each subnet. Modify the route table configuration or select a different subnet and try again.';

const STACK_NOT_FOUND = (stack: string) => `Cloud Formation stack ${stack} not found.`;
const CONFIG_NOT_FOUND = (configId: string) => `Saved config ${configId} not found.`;

const CAPABILITY_IAM = 'CAPABILITY_IAM';
const CAPABILITY_NAMED_IAM = 'CAPABILITY_NAMED_IAM';

// Signed URL Valid for 24 hours
const S3_BUCKET_SIGNED_URL_EXPIRY = moment.duration(`${config.get('signed-url-expiry-hours')}`, 'hours').asSeconds();

// HTTP Request types
const HTTP_GET = 'GET';
const HTTP_POST = 'POST';
const HTTP_DELETE = 'DELETE';
const HTTP_PUT = 'PUT';
const HTTP_PATCH = 'PATCH';

// Custom error messages
const INVALID_REGION_AWS = 'getaddrinfo ENOTFOUND';
const INVALID_REGION_MESSAGE = 'AWS region is invalid. Error:';
const SIGNED_URL_ERROR_MESSAGE = (url: string, region: string, error: string) =>
    `Error creating signed url for ${url} in region ${region}. ${error}`;
const RESOURCE_RETRIVAL_ERROR = 'Unable to fetch credentials, region, server instance id details.';

const AWS_FSX = 'aws/fsx';
const TEMPLATE_CLOUD_PROVIDER_ID = 'CloudProviderAccountId';
const TEMPLATE_JWT_TOKEN = 'JwtToken';
const TEMPLATE_CREDENTIALS_ID = 'RoleCredentialsId';
const TEMPLATE_ACCOUNT_ID = 'AccountId';
const TEMPLATE_SNS_SERVICE_TOKEN = 'SnsServiceToken';
const TEMPLATE_WLMDB_AWS_ACCOUT_ID = 'WlmdbAwsAccountId';
const TEMPLATE_FSX_PASSWORD = 'EncryptedFsxPassword';
const TEMPLATE_METRICS = 'Metrics';
const TEMPLATE_S3_ENDPOINT = 'S3EndpointExists';
const TEMPLATE_CLOUDFORMATION_ENDPOINT = 'CloudformationEndpointExists';
const TEMPLATE_SSM_ENDPOINT = 'SsmEndpointExists';
const TEMPLATE_SQS_ENDPOINT = 'SqsEndpointExists';
const TEMPLATE_CLOUDWATCH_LOGS_ENDPOINT = 'CloudwatchLogsEndpointExists';
const TEMPLATE_FSX_ENDPOINT = 'FsxEndpointExists';
const TEMPLATE_EC2_ENDPOINT = 'Ec2EndpointExists';
const TEMPLATE_EC2MESSAGES_ENDPOINT = 'Ec2MessagesEndpointExists';
const TEMPLATE_SSMMESSAGES_ENDPOINT = 'SSMMessagesEndpointExists';
const TEMPLATE_S3GATEWAY_ROUTETABLES = 'S3EndpointRouteTables';

const MAP_SERVICE_TEMPLATE_PARAMETER: Record<string, string> = {
    s3: TEMPLATE_S3_ENDPOINT,
    cloudformation: TEMPLATE_CLOUDFORMATION_ENDPOINT,
    ssm: TEMPLATE_SSM_ENDPOINT,
    sqs: TEMPLATE_SQS_ENDPOINT,
    logs: TEMPLATE_CLOUDWATCH_LOGS_ENDPOINT,
    fsx: TEMPLATE_FSX_ENDPOINT,
    ec2: TEMPLATE_EC2_ENDPOINT,
    ec2messages: TEMPLATE_EC2MESSAGES_ENDPOINT,
    ssmmessages: TEMPLATE_SSMMESSAGES_ENDPOINT
};

const SQL_RESOURCE_ASSETS = [
    {
        name: 'DSC',
        url: `${WLMDB}/scripts/DSC.zip`
    },
    // {
    //     name: 'DSCSignature',
    //     url: 'DSC.zip.sig'
    // },
    {
        name: 'PowerShell',
        url: `${WLMDB}/Installer/powershell.zip`
    },
    // {
    //     name: 'PowerShellSignature',
    //     url: 'Installer/powershell.zip.sig'
    // },
    {
        name: 'Sqlspcu',
        url: `${WLMDB}/Installer/sqlspcu.zip`
    },
    // {
    //     name: 'SqlspcuSignature',
    //     url: 'Installer/sqlspcu.zip.sig'
    // },
    {
        name: 'AmazonFailoverCluster',
        url: `${WLMDB}/modules/AmznFailoverCluster.zip`
    },
    // {
    //     name: 'AmazonFailoverClusterSignature',
    //     url: 'modules/AmznFailoverCluster.zip.sig'
    // },
    {
        name: 'AmazonLaunchWizardForCFN',
        url: `${WLMDB}/modules/AWSLaunchWizardForCFN.zip`
    },
    // {
    //     name: 'AmazonLaunchWizardForCFNSignature',
    //     url: 'modules/AWSLaunchWizardForCFN.zip.sig'
    // },
    {
        name: 'AmazonLaunchWizardForSSM',
        url: `${WLMDB}/modules/AWSLaunchWizardForSSM.zip`
    },
    // {
    //     name: 'AmazonLaunchWizardForSSMSignature',
    //     url: 'modules/AWSLaunchWizardForSSM.zip.sig'
    // },
    {
        name: 'ScriptVerifySignature',
        url: `${WLMDB}/scripts/Verify-Signature.ps1`
    },
    {
        name: 'ScriptUnzipArchive',
        url: `${WLMDB}/scripts/Unzip-Archive.ps1`
    },
    {
        name: 'ScriptCommon',
        url: `${WLMDB}/scripts/common.zip`
    },
    // {
    //     name: 'ScriptCommonSignature',
    //     url: 'scripts/common.zip.sig'
    // },
    {
        name: 'ScriptSQLFCI',
        url: `${WLMDB}/scripts/sqlfci.zip`
    },
    // {
    //     name: 'ScriptSQLFCISignature',
    //     url: 'scripts/sqlfci.zip.sig'
    // },
    {
        name: 'ScriptSQLONTAP',
        url: `${WLMDB}/scripts/sqlontap.zip`
    },
    // {
    //     name: 'ScriptSQLONTAPSignature',
    //     url: 'scripts/sqlontap.zip.sig'
    // },
    {
        name: 'ScriptDBCREATE',
        url: `${WLMDB}/scripts/dbcreate.zip`
    },
    {
        name: 'ScriptVpcCheck',
        url: `${WLMDB}/validation/Validate-VPCConnectivity.ps1`
    },
    {
        name: 'ScriptUpdateDnsServers',
        url: `${WLMDB}/validation/Update-DNSServers.ps1`
    },
    {
        name: 'ScriptRenameComputer',
        url: `${WLMDB}/validation/Rename-Computer.ps1`
    },
    {
        name: 'ScriptRestartComputer',
        url: `${WLMDB}/validation/Restart-Computer.ps1`
    },
    {
        name: 'ScriptAdValidation',
        url: `${WLMDB}/validation/Validate-Credentials.ps1`
    },
    {
        name: 'ScriptFSxValidation',
        url: `${WLMDB}/validation/Validate-FsxConnectivity.ps1`
    },
    {
        name: 'DependentPackages',
        url: `${WLMDB}/Installer/dependent-packages.zip`
    }
];

const SQL_TEMPLATES_ASSETS = [
    {
        name: 'FSXNewTemplate',
        url: 'templates/fsx-new.yaml'
    },

    {
        name: 'FSXExistingTemplate',
        url: 'templates/fsx-existing.yaml'
    },

    {
        name: 'ValidationTemplate',
        url: 'templates/vpc-ad-validation.yaml'
    },
    {
        name: 'SQLTemplate',
        url: 'templates/sql-windows-fci-config_nosignal.yaml'
    },
    {
        name: 'SQLStandaloneTemplate',
        url: 'templates/standalone-deployment.yaml'
    },
    {
        name: 'VpcEndpointTemplate',
        url: 'templates/vpc-endpoints.yaml'
    }
];

const SQL_TEMPLATE_TAGS_INDENTATION = 6;
const DEFAULT_TAGS = [
    {
        Key: 'created_by_flow',
        Value: 'WLMDB'
    }
];

enum TEMPLATE_TYPES {
    MASTER = 'master',
    SQLSTACK = 'sqlstack',
    VALIDATION = 'validation',
    SQLSTANDALONE = 'sqlstandalone',
    ENDPOINT = 'endpoint',
    NEWFSX = 'newfsx',
    EXISTINGFSX = 'existingfsx'
}

const SQL_TEMPLATES_DISTRIBUTION = [
    {
        name: TEMPLATE_TYPES.VALIDATION,
        location: './resources/mssql/templates/vpc-ad-validation.yaml'
    },
    {
        name: TEMPLATE_TYPES.SQLSTACK,
        location: './resources/mssql/templates/sql-windows-fci-config_nosignal.yaml'
    },
    {
        name: TEMPLATE_TYPES.SQLSTANDALONE,
        location: './resources/mssql/templates/standalone-deployment.yaml'
    },
    {
        name: TEMPLATE_TYPES.ENDPOINT,
        location: './resources/mssql/templates/vpc-endpoints.yaml'
    },
    {
        name: TEMPLATE_TYPES.NEWFSX,
        location: './resources/mssql/templates/fsx-new.yaml'
    },
    {
        name: TEMPLATE_TYPES.EXISTINGFSX,
        location: './resources/mssql/templates/fsx-existing.yaml'
    }
];

const MASTER_TEMPLATE_DISTRIBUTION = {
    name: TEMPLATE_TYPES.MASTER,
    location: './resources/mssql/templates/wlm-master.yaml'
};

enum DATABASE_METRIC_TYPE {
    CPU = 'cpu',
    DISK = 'disk',
    MEMORY = 'memory'
}

enum SSM_QUERY_EXECUTION_STATUS {
    FAILED = 'Failed',
    SUCCESS = 'Success'
}

enum CF_CUSTOM_RESOURCE_CODES {
    CREATE = 'Create',
    DELETE = 'Delete',
    FAILED = 'FAILED',
    SUCCESS = 'SUCCESS'
}

const TRACK_STATUS_CUSTOM_RESOURCE = 'TrackStackDeployment';
const JWKS_FULL_NAME = 'http://cloud.netapp.com/full_name';

const CF_NOTIFICATION = 'AWS CloudFormation Notification';
const ERROR_CODE_SQS_NON_EXISTENT_QUEUE = 'AWS.SimpleQueueService.NonExistentQueue';
const ERROR_CODE_SQS_INVALID_TOKEN = 'InvalidClientTokenId';
const METHODS_WITH_PAYLOAD = ['POST', 'PUT', 'PATCH'];
const BATCH_API_CONCURRENCY_LIMIT = 10;
const API_PAGE_SIZE = 100;
const SANDBOX_API_SIZE = 25;
const INVALID_PARAMETER_VALUE = 'InvalidParameterValue';

const FCI_STACKNAME = 'SqlFciStack';
const STANDALONE_STACKNAME = 'SqlStandaloneStack';

// Notification
const CRITICAL = 'critical';
const RESOURCE_ID = 'WLMDB-Resource-1';
const PUBLISH = 'publish';
const MOREINFO = 'More information';
const ACTION_BUTTON_DASHBOARD = 'Go to Dashboard';
const ACTION_BUTTON_DATABASE = 'WLMDB - Database';
const SUCCESS = 'success';
const ERROR = 'error';
const REDIRECT_URL = '/database-services';
const STANDARD_DEPLOYMENT_ACTION = 'standard_deployment';
const SQL_DEPLOYMENT_FAILED_SUBJECT = 'Microsoft SQL Server and FSxN for ONTAP deployment failed';
const SQL_DEPLOYMENT_COMPLETED_SUBJECT = 'Microsoft SQL Server and FSxN for ONTAP deployment successful';
const SQL_DEPLOYMENET_INITIATED_SUBJECT = 'Microsoft SQL Server and FSxN for ONTAP deployment initiated';

const MAX_READ_REQUEST_FSXN = 1000000;
const MAX_WRITE_REQUEST_FSXN = 100000;
const MIN_DISKSIZE = 1024;
const MIN_THROUGHPUT = 128;
const STANDALONE = 'standalone';
const FCI = 'fci';
const SINGLE_AZ = 'SINGLE_AZ_1';
const MULTI_AZ = 'MULTI_AZ_1';

const WF = 'WORKLOAD_FACTORY';
const BXP = 'BlueXP';

const USER_TENANCY_CACHE_TYPE = 'USER_TENANCY';
const WF_USER_CRED_TYPE = 'WF_USER_CRED';
const BXP_USER_CRED_TYPE = 'BXP_USER_CRED';
const WF_SVC_TOKEN_TYPE = 'WF_SVC_TOKEN';
const BXP_SVC_TOKEN_TYPE = 'BXP_SVC_TOKEN';
const SSM_COMMAND_CACHE_TYPE = 'SSM_COMMAND';
const REQUEST_IN_PROGRESS_TYPE = 'REQUEST_IN_PROGRESS';
const AWS_PRICING_TYPE = 'AWS_PRICING';
const AWS_FSX_TYPE = 'AWS_FSX';

const ADMIN_ROLE = 'Role-1';
const USER_ROLE = 'Role-2';
enum DatabaseHostsQueryFields {
    TOPOLOGY = 'topology',
    PERFORMANCE = 'performance',
    PROTECTION = 'protection',
    STORAGE = 'storage',
    USAGE_ESTIMATION = 'usageEstimation',
    RESOURCE_UTILIZATION = 'resourceUtilization',
    DB_COUNT = 'dbCount',
    SERVER_DETAILS = 'serverDetails'
}

enum ServerState {
    UP = 'Up',
    DOWN = 'Down'
}

const DEPLOYMENT_JOBS_STATUS_FILTER: Array<DEPLOYMENT_STATUS> = [
    'CREATE_IN_PROGRESS',
    'CREATE_COMPLETE',
    'CREATE_FAILED',
    'UPDATE_IN_PROGRESS',
    'UPDATE_COMPLETE',
    'UPDATE_FAILED'
];

const DEPLOYMENT_JOBS_FAILED_STATUS = [
    'CREATE_FAILED',
    'DELETE_FAILED',
    'ROLLBACK_FAILED',
    'UPDATE_FAILED',
    'UPDATE_ROLLBACK_FAILED'
];

const DEPLOYMENT_JOBS_LIST_FILTER: Array<DEPLOYMENT_STATUS> = [
    'CREATE_IN_PROGRESS',
    'CREATE_FAILED',
    'UPDATE_IN_PROGRESS',
    'UPDATE_FAILED'
];

const NOT_AVAILABLE = 'N/A';

const DOMAIN_ADMIN_PASSWORD = 'DomainAdminPassword';
const SQL_SA_PASSWORD = 'SQLServiceAccountPassword';
const FSX_ADMIN_PASSWORD = 'FSxAdminPassword';

const SKIP_TEMPLATE_PASSWORD_PARAMETERS: Array<string> = [DOMAIN_ADMIN_PASSWORD, SQL_SA_PASSWORD, FSX_ADMIN_PASSWORD];

const DATABASE_TYPE = 'Microsoft SQL Server';

// SQL software types
const SQL_STD = 'SQL std';
const SQL_ENT = 'SQL ent';
const SQL_WEB = 'SQL web';
const CUSTOM = 'custom';

const SQL_SOFTWARE_TYPES = new Map<string, string>([
    [SQL_STD, SQL_STD],
    [SQL_ENT, SQL_ENT],
    [SQL_WEB, SQL_WEB]
]);
const WLMDB_COST_ALLOCATION_TAG = 'wlmdb-cost-resource';

const SQS_MSG_RETENTION = '3600'; // Amazon SQS automatically deletes messages that have been in a queue for more than the maximum message retention period.
const MSSQL_SYSTEM_DATABASES = [
    'master',
    'mastlog',
    'tempdb',
    'tempdev',
    'templog',
    'modeldev',
    'model',
    'modellog',
    'msdbdata',
    'msdblog',
    'msdb'
];

const MSSQL_DATABASE_TYPES = {
    SYSTEM: 'System Database',
    USER: 'User Database'
};

const WF_TOKEN = 'WF_TOKEN';
const BXP_TOKEN = 'BXP_TOKEN';

const KMS_KEY_ALIAS = process.env.KEY_ALIAS;
// Metrics data const
const TRIGGERED_FROM = 'triggered-from';
const DEPLOYED_FROM = 'deployed-from';
const INSTANCE_TYPE = 'instance-type';
const SQL_VERSION = 'sql-version';
const DATABASE_SIZE = 'database-size';
const SQL_HOST_NAME = 'sql-host-name';

const OPERATE = 'operate';
const VIEW = 'view';
const JOBS_DEFAULT_TIME_RANGE = '30d';

const subJobDescriptions: SubJobDescriptions = {
    SQLStandaloneStack: 'Deploying an SQL Server standalone instance with recommended best practices',
    SQLServerStack: 'Deploying an SQL Server FCI with recommended best practices',
    NewFSxStack: 'Deploying new FSx for ONTAP file system for SQL Server workload',
    ExistingFSxStack:
        'Deploying a storage virtual machine for the SQL Server workload on the FSx for ONTAP file system',
    'ValidationStack1-standalone': 'Subnet Validation for deployment',
    'ValidationStack1-fci': 'Primary subnet validation for SQL Server FCI deployment',
    ValidationStack2: 'Standby subnet validation for SQL Server FCI deployment',
    'SqlNode(AWS::EC2::Instance)': 'Configuring SQL Server standalone on an EC2 instance',
    'NetworkInterface(AWS::EC2::NetworkInterface)': 'Creating network interfaces for the EC2 instance',
    'WorkloadSecurityGroup(AWS::EC2::SecurityGroup)': 'Creating a security group for SQL Server workloads',
    'LaunchWizardSqlFSxProfile(AWS::IAM::InstanceProfile)':
        'Attaching an instance profile to EC2 instances for SQL Server nodes',
    'DisableIMDSv1(AWS::EC2::LaunchTemplate)': 'Disabling instance metadata service v1 to use more secure v2',
    'FSxTempDbVolumeConfiguration(AWS::FSx::Volume)': 'Creating a volume to host tempdb',
    'FSxClusterQuorumVolumeConfiguration(AWS::FSx::Volume)':
        'Creating a volume to host witness disk for Windows Cluster',
    'FSxDataVolumeConfiguration(AWS::FSx::Volume)': 'Creating a volume to host data files',
    'FSxLogVolumeConfiguration(AWS::FSx::Volume)': 'Creating a volume to host log files',
    'FSxSvmConfiguration(AWS::FSx::StorageVirtualMachine)':
        'Creating a dedicated storage virtual machine (SVM) for the database workload',
    'FSxFileSystemConfiguration(AWS::FSx::FileSystem)': 'Creating a new FSx for ONTAP file system',
    'ONTAPSecurityGroup(AWS::EC2::SecurityGroup)': 'Creating a security group for FSx for ONTAP',
    'ValidationNode1(AWS::EC2::Instance)':
        'Validating outbound connection to deployment resources in Amazon S3, Active Directory, and FSx for ONTAP',
    'ValidationNode1WaitCondition(AWS::CloudFormation::WaitCondition)': 'Waiting for validation completion',
    'DomainMemberSG(AWS::EC2::SecurityGroup)': 'Creating a security group for the validation instance',
    'ValidationInstanceProfile(AWS::IAM::InstanceProfile)': 'Attaching an instance profile to the validation instance',
    'ValidationNode1WaitHandler(AWS::CloudFormation::WaitConditionHandle)':
        'Signaling wait condition to resume next steps',
    'SqlFSxInstanceMAD1(AWS::EC2::Instance)': 'Configuring Windows Cluster and SQL FCI instance on primary node',
    'SqlFSxInstanceMAD2(AWS::EC2::Instance)': 'Configuring Windows Cluster and SQL FCI instance on standby node',
    'NetworkInterface2(AWS::EC2::NetworkInterface)':
        'Creating network interfaces for the EC2 instance in standby subnet',
    'NetworkInterface1(AWS::EC2::NetworkInterface)':
        'Creating network interfaces for the EC2 instance in primary subnet',
    'ValidationNode2(AWS::EC2::Instance)':
        'Validating outbound connection to deployment resources in Amazon S3, Active Directory, and FSx for ONTAP',
    'ValidationNode2WaitCondition(AWS::CloudFormation::WaitCondition)': 'Waiting for validation completion',
    'ValidationNode2WaitHandler(AWS::CloudFormation::WaitConditionHandle)':
        'Signaling wait condition to resume next steps',
    VpcEndpointStack: 'Creating VPC endpoints for S3 CloudFormation, SQS, SSM, CloudWatch services',
    'HttpsSecurityGroup(AWS::EC2::SecurityGroup)': 'Creating security group to allow HTTPs access',
    'S3Endpoint(AWS::EC2::VPCEndpoint)': 'Creating S3 gateway endpoint',
    'CloudformationEndpoint(AWS::EC2::VPCEndpoint)': 'Creating CloudFormation endpoint',
    'Ec2MessagesEndpoint(AWS::EC2::VPCEndpoint)': 'Creating EC2Messages endpoint',
    'SqsEndpoint(AWS::EC2::VPCEndpoint)': 'Creating SQS endpoint',
    'SsmEndpoint(AWS::EC2::VPCEndpoint)': 'Creating SSM endpoint',
    'SsmMessagesEndpoint(AWS::EC2::VPCEndpoint)': 'Creating SSMMessages endpoint',
    'FsxEndpoint(AWS::EC2::VPCEndpoint)': 'Creating FSxN endpoint',
    'CloudwatchLogsEndpoint(AWS::EC2::VPCEndpoint)': 'Creating CloudWatch logs endpoint',
    'Ec2Endpoint(AWS::EC2::VPCEndpoint)': 'Creating EC2 endpoint'
};
const CF_STACK_RESOURCE_TYPE = 'AWS::CloudFormation::Stack';
const RESOURCE_SOURCE = {
    DEPLOY: 'deployment',
    DISCOVER: 'discovery'
};

const ENDPOINTS_DEPLOYMENT = ['s3', 'cloudformation', 'sqs', 'ssm', 'ssmmessages', 'ec2messages', 'logs', 'fsx', 'ec2'];

const SSM_PARAMETERS_BASE_PATH = '/netapp/wlmdb';
const COMPLETE = 'Complete';

const CUSTOM_SSM_EXECUTION_TIMEOUT = '180';

const VALIDATION_NODE_INSTANCETYPE = {
    T2MICRO: 't2.micro',
    T3MICRO: 't3.micro'
};

const ONLINE = 'ONLINE';

const BLOCKED_BY_SCP = 'blocked by scp';

const SIMULATE_IAM_POLICY = 'SimulatePrincipalPolicy';

const MAX_FSX_STORAGE_IN_GIB = 196608;
const FSX_VOL_THROUGHPUT = 4096;
const FSX_STORAGE_MIN_CAPACITY_IN_GIB = 5120;
const FSX_IOPS = 160000;
const DATABASE_MAX_LUN_SIZE_IN_GIB = 133120;
const DATABASE_MIN_LUN_SIZE_IN_GIB = 120;
const FAIL_LONGRUNNING_DEPLOYMENT_JOB_INTERVAL = '5h';
const DBCREATE_RELATIVE_PATH = `${WLMDB}/scripts/dbcreate.zip`;
const DEFAULT_INSTANCE_NAME = 'MSSQLSERVER';

const PERMISSION_DENIAL_POSSIBLE_REASONS = {
    MISSING: 'permission statement is missing',
    BLOCKED_SCP: 'permission blocked by SCP',
    BLOCKED_BOUNDARY: 'permission blocked due to boundary',
    OTHERS: 'permission is denied in "Effect" or due to other reasons'
};

const NO_SANDBOX_CREATED = 'No sandboxes created for the instance';

const STORAGE_PROTOCOLS = { SMB: 'SMB', ISCSI: 'iSCSI' };

export {
    WLMDB,
    AWS_REGIONS,
    AWS_RESOURCES_ACTION_MAP,
    SERVICE_QUOTAS_ACTION_NAMES,
    SERVICE_QUOTAS,
    FSX_ACTION_NAMES,
    FSX,
    FSX_BATCH_CONCURRENCY_VALUE,
    SNS_ACTION_NAMES,
    SNS,
    IAM_ACTION_NAMES,
    IAM,
    CLOUDFORMATION_ACTION_NAMES,
    CLOUDFORMATION,
    EC2_ACTION_NAMES,
    EC2,
    KMS_ACTION_NAMES,
    KMS,
    SECRECTS_MANAGER_ACTION_NAMES,
    SECRETS_MANAGER,
    AWSQueryFields,
    SQL_AMI_NAMES,
    SECRET_WORDS,
    SECRET_STRING_WORDS,
    DEMO_ACCOUNT_ID,
    SECRETS,
    AUTH0_AUDIENCE,
    CARGO,
    AWSServiceNames,
    STACKS_DEPLOYED,
    CF_STACK_COUNT_QUOTANAME,
    VPC_COUNT_QUOTANAME,
    HttpErrorCodes,
    RouteTags,
    CloudProviders,
    CredentialsType,
    KINESIS_STREAM_NAME,
    RESOURCE_CLASS,
    CLOUD_MANAGER_GET_CVO_WE_PREFIX,
    CREDENTIALS_ENDPOINT,
    SIGNOZ_ENDPOINT,
    AGENTS_MANAGEMENT_ENDPOINT,
    TENANCY_ENDPOINT,
    CLOUD_MANAGER_ENDPOINT,
    DEFAULT_AWS_CREDENTIALS_TYPE,
    DEFAULT_AWS_REGION,
    CLOUD_MANAGER_SERVER_ADDRESS,
    API_PATH_HEALTH,
    HEADERS,
    AUTH0_SERVER_ADDRESS,
    VERSION,
    USER_TOKEN,
    REQUEST_ID,
    ACCOUNT_ID,
    AGENT_ID,
    AUDIT_GROUP,
    AUDIT_EXCLUDE_LIST,
    WORKSPACE_ID,
    API_TITLE,
    APP_NAME,
    MASTER_TEMPLATE_PATH,
    CLOUD_FORMATION_STACK_URL,
    TEMPLATE_CONFIGURATION_MAPPING,
    WLM_ASSETS,
    CF_DEPLOY_ROLE_NAME,
    MISSING_PERMISSIONS,
    CF_QUOTA_REACHED,
    DISABLE_ROLLBACK,
    MASTER_STACK_TIMEOUT_MINUTES,
    SECRETS_MANAGER_KEYS,
    AWS_RESOURCE_NAME_TAG,
    FSX_FILESYSTEM_TYPE,
    FSX_STORAGE_TYPE,
    CAPABILITY_IAM,
    S3_BUCKET_SIGNED_URL_EXPIRY,
    HTTP_GET,
    HTTP_POST,
    HTTP_DELETE,
    HTTP_PUT,
    HTTP_PATCH,
    TEMPLATE_OPTIONAL_PARAMETERS,
    INVALID_REGION_AWS,
    INVALID_REGION_MESSAGE,
    AWS_FSX,
    SQL_TEMPLATES_ASSETS,
    SQL_RESOURCE_ASSETS,
    SQL_TEMPLATE_TAGS_INDENTATION,
    DEFAULT_TAGS,
    FileSystemDeploymentType,
    FSX_RESOURCE_TYPE,
    RESOURCESTYPE,
    FSX_SSD_MIN_SIZE,
    FSX_SSD_MAX_SIZE,
    VALIDATION_AMI,
    DatabaseTypes,
    WLMDB_RESOURCE_CLASS,
    TEMPLATE_TYPES,
    SQL_TEMPLATES_DISTRIBUTION,
    MASTER_TEMPLATE_DISTRIBUTION,
    DATABASE_METRIC_TYPE,
    SSM_QUERY_EXECUTION_STATUS,
    SqlServerDeploymentModel,
    TEMPLATE_CLOUD_PROVIDER_ID,
    TEMPLATE_JWT_TOKEN,
    TEMPLATE_CREDENTIALS_ID,
    DeploymentState,
    SIGNED_URL_ERROR_MESSAGE,
    TRACK_STATUS_CUSTOM_RESOURCE,
    JWKS_FULL_NAME,
    CF_CUSTOM_RESOURCE_CODES,
    TEMPLATE_ACCOUNT_ID,
    TEMPLATE_SNS_SERVICE_TOKEN,
    TEMPLATE_WLMDB_AWS_ACCOUT_ID,
    TEMPLATE_FSX_PASSWORD,
    CF_NOTIFICATION,
    ERROR_CODE_SQS_NON_EXISTENT_QUEUE,
    ERROR_CODE_SQS_INVALID_TOKEN,
    METHODS_WITH_PAYLOAD,
    SERVICE_TOKEN,
    TOKEN_EXPIRATION_TIME,
    WORKLOAD_FACTORY_ENDPOINT,
    BATCH_API_CONCURRENCY_LIMIT,
    API_PAGE_SIZE,
    SANDBOX_API_SIZE,
    FCI_STACKNAME,
    STANDALONE_STACKNAME,
    CRITICAL,
    PUBLISH,
    MOREINFO,
    ACTION_BUTTON_DASHBOARD,
    ACTION_BUTTON_DATABASE,
    RESOURCE_ID,
    WLMDB_ABSOLUTE_ENDPOINT,
    WF_CONSOLE_ENDPOINT,
    SUCCESS,
    ERROR,
    MAX_READ_REQUEST_FSXN,
    MAX_WRITE_REQUEST_FSXN,
    MIN_DISKSIZE,
    STANDALONE,
    FCI,
    SINGLE_AZ,
    MULTI_AZ,
    MIN_THROUGHPUT,
    REDIRECT_URL,
    STANDARD_DEPLOYMENT_ACTION,
    SQL_DEPLOYMENT_FAILED_SUBJECT,
    SQL_DEPLOYMENT_COMPLETED_SUBJECT,
    SQL_DEPLOYMENET_INITIATED_SUBJECT,
    WF,
    BXP,
    USER_TENANCY_CACHE_TYPE,
    WF_USER_CRED_TYPE,
    BXP_USER_CRED_TYPE,
    WF_SVC_TOKEN_TYPE,
    BXP_SVC_TOKEN_TYPE,
    ADMIN_ROLE,
    USER_ROLE,
    STACK_NOT_FOUND,
    RESOURCE_RETRIVAL_ERROR,
    DatabaseHostsQueryFields,
    ServerState,
    SERVER_TYPE_MAPPING,
    FileSystemTypes,
    EC2_STRICT_CONDITION_ACTION_NAMES,
    CLOUDFORMATION_STRICT_ACTION_NAMES,
    FSX_STRICT_CONDITION_ACTION_NAMES,
    SECRECTS_MANAGER_STRICT_ACTION_NAMES,
    AWS_RESOURCES_STRICT_ACTION_MAP,
    AWS_RESOURCES_STRICT_CONDITION_ACTION_MAP,
    SECRET_MANAGER_ARN,
    CLOUD_FORMATION_ARN,
    EC2_TAG_CONDITION,
    FSX_TAG_CONDITION,
    CLOUD_FORMATION_CLI_COMMAND,
    DEPLOYMENT_JOBS_STATUS_FILTER,
    NOT_AVAILABLE,
    SKIP_TEMPLATE_PASSWORD_PARAMETERS,
    STANDALONE_NETWORK_VIOLATION_MESSAGE,
    FCI_NETWORK_EMPTY_VIOLATION_MESSAGE,
    FCI_NETWORK_ROUTE_TABLE_VIOLATION_MESSAGE,
    FCI_NETWORK_VIOLATION_MESSAGE,
    DEPLOYMENT_JOBS_FAILED_STATUS,
    DEPLOYMENT_JOBS_LIST_FILTER,
    DATABASE_TYPE,
    SSM_COMMAND_CACHE_TYPE,
    REQUEST_IN_PROGRESS_TYPE,
    CONFIG_NOT_FOUND,
    DOMAIN_ADMIN_PASSWORD,
    SQL_SA_PASSWORD,
    FSX_ADMIN_PASSWORD,
    CAPABILITY_NAMED_IAM,
    SQL_SOFTWARE_TYPES,
    SQL_STD,
    SQL_ENT,
    SQL_WEB,
    INVALID_PARAMETER_VALUE,
    LOG_GROUP_ARN,
    WLMDB_RESOURCE_TAG_VALUE,
    MSSQL_SYSTEM_DATABASES,
    MSSQL_DATABASE_TYPES,
    WLMDB_COST_ALLOCATION_TAG,
    BILLING,
    PRICING,
    SQS_MSG_RETENTION,
    WF_TOKEN,
    BXP_TOKEN,
    IAM_LINKEDROLE_CONDITION,
    IAM_PASSROLE_CONDITION,
    IAM_EC2_SERVICE,
    KMS_KEY_ALIAS,
    TEMPLATE_METRICS,
    TRIGGERED_FROM,
    DEPLOYED_FROM,
    INSTANCE_TYPE,
    SQL_VERSION,
    DATABASE_SIZE,
    SQL_HOST_NAME,
    OPERATE,
    VIEW,
    JOBS_DEFAULT_TIME_RANGE,
    subJobDescriptions,
    CF_STACK_RESOURCE_TYPE,
    AWS_PRICING_TYPE,
    RESOURCE_SOURCE,
    AWS_FSX_TYPE,
    ENDPOINTS_DEPLOYMENT,
    TEMPLATE_S3_ENDPOINT,
    TEMPLATE_CLOUDFORMATION_ENDPOINT,
    TEMPLATE_SSM_ENDPOINT,
    TEMPLATE_SQS_ENDPOINT,
    MAP_SERVICE_TEMPLATE_PARAMETER,
    ARTIFACT_BUCKET_NAME,
    SIGNED_TEMPLATES_BUCKET_NAME,
    TEMPLATE_BUCKET_REGION,
    SSM_PARAMETERS_BASE_PATH,
    COMPLETE,
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    VALIDATION_NODE_INSTANCETYPE,
    VALIDATION_INSTANCE_TYPE,
    ONLINE,
    BLOCKED_BY_SCP,
    SIMULATE_IAM_POLICY,
    TEMPLATE_S3GATEWAY_ROUTETABLES,
    MAX_FSX_STORAGE_IN_GIB,
    FSX_VOL_THROUGHPUT,
    FSX_STORAGE_MIN_CAPACITY_IN_GIB,
    FSX_IOPS,
    DATABASE_MAX_LUN_SIZE_IN_GIB,
    DATABASE_MIN_LUN_SIZE_IN_GIB,
    TEMPLATE_USERNAME_MAPPING,
    FAIL_LONGRUNNING_DEPLOYMENT_JOB_INTERVAL,
    DBCREATE_RELATIVE_PATH,
    DEFAULT_INSTANCE_NAME,
    PERMISSION_DENIAL_POSSIBLE_REASONS,
    NO_SANDBOX_CREATED,
    STORAGE_PROTOCOLS,
    CUSTOM
};
