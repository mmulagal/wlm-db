import { readFileSync } from 'fs';
import config from 'config';
import { join } from 'path';

//General
const APP_NAME = 'Workload Manager for DB';
const API_TITLE = 'Workload Manager for DB API';

// local storage keys
const USER_TOKEN = 'USER_TOKEN';
const REQUEST_ID = 'REQUEST_ID';
const ACCOUNT_ID = 'ACCOUNT_ID';
const AGENT_ID = 'AGENT_ID';
const AUDIT_GROUP = 'AUDIT_GROUP';
const WORKSPACE_ID = 'WORKSPACE_ID';

// Attributes used to determine Amazon FSx for NetApp ONTAP.
const FSX_FILESYSTEM_TYPE = 'ONTAP';
const FSX_STORAGE_TYPE = 'SSD';

// version
const VERSION: string = JSON.parse(readFileSync(join(process.cwd(), 'package.json')).toString()).version;

const AUTH0_SERVER_ADDRESS = process.env.AUTH0_ENDPOINT
    ? `https://${process.env.AUTH0_ENDPOINT}`
    : config.get<string>('urls.auth0');

enum HEADERS {
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
    SIMULATOR = 'x-simulator',
    REFERER = 'referer',
    ACTIVE_TRACE_ID = 'active-trace-id'
}

const API_PATH_HEALTH: string = '/health';

const CONNECTOR_ENDPOINT: string = process.env.CLOUD_MANAGER_ENDPOINT
    ? `http://${process.env.CLOUD_MANAGER_ENDPOINT}`
    : !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
    ? config.get<string>('urls.local-connector')
    : config.get<string>('urls.cloud-manager');

const CLOUD_MANAGER_SERVER_ADDRESS = config.get<string>('urls.cloud-manager');

// Audit
const DEFAULT_AWS_REGION = 'us-east-1';

const DEFAULT_AWS_CREDENTIALS_TYPE = 'aws_assume_role';

const CLOUD_MANAGER_ENDPOINT: string = config.get<string>('urls.cloud-manager');
const TENANCY_ENDPOINT: string = `${CLOUD_MANAGER_ENDPOINT}/tenancy`;
const AGENTS_MANAGEMENT_ENDPOINT: string = `${CLOUD_MANAGER_ENDPOINT}/agents-mgmt`;
const SIGNOZ_ENDPOINT: string = config.get<string>('urls.signoz');

const CREDENTIALS_ENDPOINT: string = config.get<string>('urls.cloud-manager');

const CLOUD_MANAGER_GET_CVO_WE_PREFIX = '/occm/api/working-environments';

const RESOURCE_CLASS = 'STORAGE_SERVICES';

const AWS_RESOURCE_NAME_TAG = 'Name';

// Kinesis
const KINESIS_STREAM_NAME = 'audit-service-staging-stream';

enum CredentialsType {
    AWS = 'aws_assume_role',
    AZURE = 'azure_service_principal'
}

enum CloudProviders {
    AWS = 'AWS',
    AZURE = 'AZURE',
    GCP = 'GCP'
}

enum RouteTags {
    AWS = 'AWS',
    GENERIC = 'Generic',
    SYSTEM = 'System',
    DEPLOYMENT = 'Deployment',
    DATABASE = 'DATABASE'
}

enum HttpErrorCodes {
    INTERNAL_SERVER_ERROR = 500,
    NOT_FOUND = 404,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    VALIDATION_ERROR = 422
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

const AUTH0_AUDIENCE = config.get<string>('jwt.audience.tenancy');

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
        : undefined
};

const SECRETS_MANAGER_KEYS: Record<string, string> = {
    CLIENT_ID: 'CLIENT_ID',
    CLIENT_SECRET: 'CLIENT_SECRET'
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
    'serviceAccountPassword'
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

const SECRETS_MANAGER = 'secretsmanager';
const SECRECTS_MANAGER_ACTION_NAMES = [
    'GetSecretValue',
    'CreateSecret',
    'DeleteSecret',
    'TagResource',
    'UntagResource',
    'DeleteResourcePolicy',
    'GetSecretValue',
    'ListSecrets'
].map(action => `${SECRETS_MANAGER}:${action}`);

const KMS = 'kms';
const KMS_ACTION_NAMES = ['ListKeys', 'ListAliases'].map(action => `${KMS}:${action}`);

const EC2 = 'ec2';
const EC2_ACTION_NAMES = [
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

const CLOUDFORMATION = 'cloudformation';
const CLOUDFORMATION_ACTION_NAMES = [
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

const IAM = 'iam';
const IAM_ACTION_NAMES = [
    'CreateInstanceProfile',
    'DeleteInstanceProfile',
    'RemoveRoleFromInstanceProfile',
    'AddRoleToInstanceProfile',
    'GetRole',
    'GetUser',
    'GetPolicyVersion',
    'GetPolicy'
].map(action => `${IAM}:${action}`);

const SNS = 'sns';
const SNS_ACTION_NAMES = [
    'ListSubscriptionsByTopic',
    'Publish',
    'CreateTopic',
    'DeleteTopic',
    'Subscribe',
    'Unsubscribe'
].map(action => `${SNS}:${action}`);

const RESOURCE_GROUPS = 'resource-groups';
const RESOURCE_GROUPS_ACTION_NAMES = ['CreateGroup', 'List*', 'DeleteGroup', 'Get*'].map(
    action => `${RESOURCE_GROUPS}:${action}`
);

const FSX = 'fsx';
const FSX_ACTION_NAMES = [
    'CreateFileSystem',
    'DeleteFileSystem',
    'ListTagsForResource',
    'TagResource',
    'UntagResource',
    'DescribeFileSystems'
].map(action => `${FSX}:${action}`);

const SERVICE_QUOTAS = 'servicequotas';
const SERVICE_QUOTAS_ACTION_NAMES = ['GetServiceQuota', 'ListServiceQuotas'].map(
    action => `${SERVICE_QUOTAS}:${action}`
);

const AWS_RESOURCES_ACTION_MAP = {
    [SECRETS_MANAGER]: SECRECTS_MANAGER_ACTION_NAMES,
    [KMS]: KMS_ACTION_NAMES,
    [EC2]: EC2_ACTION_NAMES,
    [CLOUDFORMATION]: CLOUDFORMATION_ACTION_NAMES,
    [IAM]: IAM_ACTION_NAMES,
    [SNS]: SNS_ACTION_NAMES,
    [RESOURCE_GROUPS]: RESOURCE_GROUPS_ACTION_NAMES,
    [FSX]: FSX_ACTION_NAMES,
    [SERVICE_QUOTAS]: SERVICE_QUOTAS_ACTION_NAMES
};
// List of regions having "Amazon FSx for NetApp ONTAP" service.
// List taken from https://www.aws-services.info/fsx-ontap.html
const FSX_SUPPORTED_REGIONS = new Map<string, string>([
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

const EC2_INSTANCE_TYPE_EXCLUDE_LIST = [
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

const WLMDB = 'wlmdb';

const BUCKET_NAME = 'wlmbucket';
const BUCKET_PREFIX = 'templates';
const EC2_ROLE_NAME = 'Ec2RoleName';
const MSSQL_MEDIA_BUCKET_NAME = 'LaunchWizard-sqlha';
const MSSQL_MEDIA_PATH_KEY = 'launchwizardscripts/sqlmedia/sqlserver.iso';
const ASSETS_REGION_CODE = 's3.ap-southeast-1';
const MASTER_TEMPLATE_PATH = 'templates/wlm-master.yaml';
const CLOUD_FORMATION_STACK_URL = 'https://ap-southeast-1.console.aws.amazon.com/cloudformation/home';
const MASTER_TEMPLATE_URL = `https://${BUCKET_NAME}.s3.ap-southeast-1.amazonaws.com/${MASTER_TEMPLATE_PATH}`;
const DISABLE_ROLLBACK = false;
const MASTER_STACK_TIMEOUT_MINUTES = 120;
const FSX_SSD_MIN_SIZE = 1024; // in GiB
const FSX_SSD_MAX_SIZE = 211106; // in GiB

const TEMPLATE_CONFIGURATION_MAPPING: Record<string, string> = {
    vpcId: 'VPCID',
    vpcCidr: 'VPCCIDR',
    vpcName: 'VPCName',
    privateSubnet1Id: 'PrivateSubnet1ID',
    routeTable1Id: 'RouteTable1Id',
    privateSubnet2Id: 'PrivateSubnet2ID',
    routeTable2Id: 'RouteTable2Id',

    adScenarioType: 'ADScenarioType',
    domainUsername: 'DomainAdminUser',
    domainDnsname: 'DomainDNSName',
    dnsIpaddress: 'DNSIpAddresses',
    securityGroupId: 'DomainMemberSGID',

    fsxFileSystemId: 'FSxFileSystemId',
    fsxVolThroughput: 'FSxVolumeThroughputCapacity',
    fsxIOPS: 'FSxDiskIops',
    ontapSgGroupId: 'ONTAPSecurityGroupID',
    encryptionKey: 'FileSystemEncryptionKeyId',

    sqlAmiId: 'SQLAMIID',
    serviceAccountName: 'SQLServiceAccountName',
    sqlFciName: 'SqlFSxFCIName',

    workloadInstanceType: 'WorkloadInstanceType',
    keyPairName: 'KeyPairName',

    topicArn: 'NotificationARN',
    enableCloudWatch: 'EnableCloudWatchLogFeature'
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
    AssetsBucketName: BUCKET_NAME,
    AssetsS3KeyPrefix: BUCKET_PREFIX,
    MSSQLMediaBucketName: MSSQL_MEDIA_BUCKET_NAME,
    MSSQLMediaPathKey: MSSQL_MEDIA_PATH_KEY,
    AssetsS3RegionCode: ASSETS_REGION_CODE
};

// Template error messages
const MISSING_PERMISSIONS = (permissions: Array<string>) =>
    `Required permissions are not available to deploy cloud formation template. Missing permissions: ${permissions}.`;

const CF_QUOTA_REACHED = `Cloud Formation for stacks has reached or about to reach region quota. Around ${STACKS_DEPLOYED} may be deployed as part of deployment.`;
const SAME_ROUTETABLE_MESSAGE = 'AWS FSx requires route tables to be different for subnets in Multi-zone deployment.';

const CAPABILITY_IAM = 'CAPABILITY_IAM';
const S3_BUCKET_SIGNED_URL_EXPIRTY = 3600;

// HTTP Request types
const HTTP_GET = 'GET';
const HTTP_POST = 'POST';
const HTTP_DELETE = 'DELETE';
const HTTP_PUT = 'PUT';
const HTTP_PATCH = 'PATCH';

// Custom error messages
const INVALID_REGION_AWS = 'getaddrinfo ENOTFOUND';
const INVALID_REGION_MESSAGE = 'AWS region is invalid. Error:';

const AWS_FSX = 'aws/fsx';

export {
    WLMDB,
    FSX_SUPPORTED_REGIONS,
    AWS_RESOURCES_ACTION_MAP,
    SERVICE_QUOTAS_ACTION_NAMES,
    SERVICE_QUOTAS,
    FSX_ACTION_NAMES,
    FSX,
    RESOURCE_GROUPS_ACTION_NAMES,
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
    CONNECTOR_ENDPOINT,
    API_PATH_HEALTH,
    HEADERS,
    AUTH0_SERVER_ADDRESS,
    VERSION,
    USER_TOKEN,
    REQUEST_ID,
    ACCOUNT_ID,
    AGENT_ID,
    AUDIT_GROUP,
    WORKSPACE_ID,
    API_TITLE,
    APP_NAME,
    BUCKET_NAME,
    MASTER_TEMPLATE_PATH,
    CLOUD_FORMATION_STACK_URL,
    EC2_INSTANCE_TYPE_EXCLUDE_LIST,
    TEMPLATE_CONFIGURATION_MAPPING,
    WLM_ASSETS,
    MASTER_TEMPLATE_URL,
    EC2_ROLE_NAME,
    MISSING_PERMISSIONS,
    CF_QUOTA_REACHED,
    DISABLE_ROLLBACK,
    MASTER_STACK_TIMEOUT_MINUTES,
    SECRETS_MANAGER_KEYS,
    AWS_RESOURCE_NAME_TAG,
    FSX_FILESYSTEM_TYPE,
    FSX_STORAGE_TYPE,
    CAPABILITY_IAM,
    S3_BUCKET_SIGNED_URL_EXPIRTY,
    HTTP_GET,
    HTTP_POST,
    HTTP_DELETE,
    HTTP_PUT,
    HTTP_PATCH,
    TEMPLATE_OPTIONAL_PARAMETERS,
    INVALID_REGION_AWS,
    INVALID_REGION_MESSAGE,
    SAME_ROUTETABLE_MESSAGE,
    AWS_FSX,
    FSX_SSD_MIN_SIZE,
    FSX_SSD_MAX_SIZE
};
