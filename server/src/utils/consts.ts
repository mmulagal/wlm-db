import randomize from 'randomatic';
import { readFileSync } from 'fs';
import config from 'config';
import { join } from 'path';
import moment from 'moment';
import { DEPLOYMENT_STATUS } from '@prisma/client';
import { MissingPermission } from './common-types';

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

const LOCAL_AUTH = {
    ENDPOINT: process.env.LOCAL_AUTH_ENDPOINT
        ? `https://${process.env.LOCAL_AUTH_ENDPOINT}`
        : config.get<string>('urls.local-auth.endpoint'),
    AUDIENCE: process.env.LOCAL_AUTH_AUDIENCE
        ? `https://${process.env.LOCAL_AUTH_AUDIENCE}`
        : config.get<string>('urls.local-auth.audience'),
    ISSUER: process.env.LOCAL_AUTH_ISSUER
        ? `https://${process.env.LOCAL_AUTH_ISSUER}`
        : config.get<string>('urls.local-auth.issuer')
};

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
    X_NETAPP_REFERER = 'x-netapp-referer',
    X_NETAPP_CACHE_CONTROL = 'x-netapp-cache-control',
    X_AGENT_ID = 'x-agent-id',
    X_ACCOUNT_ID = 'x-account-id',
    NETAPP_WORKSPACE_ID = 'x-netapp-workspace-id'
}

const API_PATH_HEALTH: string = '/health';

const CLOUD_MANAGER_SERVER_ADDRESS = config.get<string>('urls.cloud-manager');

// Audit
const AUDIT_EXCLUDE_LIST = [
    '/prompt',
    '/pricing',
    '/cloudformation/template',
    '/storage-savings',
    '/manual-storage-savings',
    '/calculations',
    '/sandboxes-meta-update',
    '/resource-credentials',
    '/create-demo-resource',
    '/onprem-tco'
];
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
    MS_SQL_SERVER = 'MSSQL',
    PG_SQL = 'PGSQL',
    ORACLE = 'ORACLE'
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

enum AuditStatus {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILED = 'failed'
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
    SANDBOX = 'Sandbox',
    ONPREM_TCO = 'OnPremises TCO',
    NOTIFICATION = 'Notification',
    LOGS_ANALYSIS = 'Logs Analysis',
    REGISTER = 'Register',
    MSSQL_ASSESSMENT = 'Well Architected - MSSQL',
    ORACLE_ASSESSMENT = 'Well Architected - Oracle'
}

enum HttpErrorCodes {
    // Client errors
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    PRECONDITION_FAILED = 412,
    VALIDATION_ERROR = 422,
    FAILED_DEPENDENCY = 424,
    TOO_MANY_REQUESTS = 429,
    // Server errors
    INTERNAL_SERVER_ERROR = 500,
    SERVICE_UNAVAILABLE = 503
}

enum SqlServerDeploymentModel {
    SQL_STANDALONE = 'Standalone Instance',
    SQL_FCI = 'Always On Failover Cluster Instance',
    SQL_STANDALONE_SHORT = 'Standalone',
    SQL_FCI_SHORT = 'FCI',
    SQL_AOAG = 'Always On Availability Group',
    SQL_AOAG_SHORT = 'AOAG'
}

enum OracleDeploymentModel {
    STANDALONE = 'Standalone',
    DG = 'Data Guard'
}

const VPC_COUNT_QUOTANAME = 'VPCs per Region';

const CF_STACK_COUNT_QUOTANAME = 'Stacks';

const CF_STACK_COUNT_QUOTACODE = 'L-0485CB21';

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
    AUTH_CLIENT_ID: process.env.AUTH_CLIENT_ID,
    AUTH_CLIENT_SECRET: process.env.AUTH_CLIENT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    SIGNURL_ACCESS_KEY: process.env.SIGNURL_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
    SIGNURL_SECRET_KEY: process.env.SIGNURL_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY
};

const SECRETS_MANAGER_KEYS: Record<string, string> = {
    CLIENT_ID: 'CLIENT_ID',
    CLIENT_SECRET: 'CLIENT_SECRET',
    DATABASE_URL: 'DATABASE_URL',
    SIGNURL_ACCESS_KEY: 'SIGNURL_ACCESS_KEY',
    SIGNURL_SECRET_KEY: 'SIGNURL_SECRET_KEY',
    AUTH_CLIENT_ID: 'AUTH-CLIENT-ID',
    AUTH_CLIENT_SECRET: 'AUTH-CLIENT-SECRET',
    REDIS_PASSWORD: 'REDIS_KEY'
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
    'sqlServiceAccountSecret',
    'file'
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
    MSSQL = 'MSSQL', // Name in SSM Parameter Store - sql
    FSX = 'FSX', // fsx
    PGSQL = 'PGSQL', // pgsql
    WINDOWS_USER = 'WINDOWS_USER', // domain
    ORACLE = 'ORACLE', // oracle
    ORACLE_ASM = 'ORACLE_ASM' // asm
}

const SERVER_TYPE_MAPPING = new Map<string, string>([[RESOURCESTYPE.MSSQL, 'Microsoft SQL Server']]);

enum FileSystemTypes {
    EBS = 'EBS',
    FSXONTAP = 'FSx for ONTAP',
    FSXWINDOWS = 'FSx for Windows',
    FSXW = 'FSXW'
}

enum STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES {
    RESILIENCY = 'resiliency',
    STORAGE = 'storage',
    BOTH = 'both'
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
    ['ap-southeast-7', 'Asia Pacific (Thailand)'],
    // Newly added region
    ['ap-east-2', 'Asia Pacific (Taipei)'],
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
    ['mx-central-1', 'Mexico (Central)'],
    ['sa-east-1', 'South America (Sao Paulo)'],
    ['us-east-1', 'US East (N. Virginia)'],
    ['us-east-2', 'US East (Ohio)'],
    ['us-gov-east-1', 'AWS GovCloud (US-East)'],
    ['us-gov-west-1', 'AWS GovCloud (US-West)'],
    ['us-west-1', 'US West (N. California)'],
    ['us-west-2', 'US West (Oregon)'],
    ['ca-west-1', 'Canada (Calgary)'],
    ['ap-southeast-5', 'Asia Pacific (Malaysia)']
]);
const AWS_REGION_KEYS = Array.from(AWS_REGIONS.keys());

const IO2_AVAILABLE_REGIONS = [
    'us-east-2',
    'us-east-1',
    'us-west-1',
    'us-west-2',
    'ap-east-1',
    'ap-south-1',
    'ap-northeast-2',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ca-central-1',
    'eu-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-north-1',
    'me-south-1'
]; // https://docs.aws.amazon.com/ebs/latest/userguide/provisioned-iops.html Considerations io2 Block Express volumes are available in the following Regions: US East (Ohio) | US East (N. Virginia) | US West (N. California) | US West (Oregon) | Asia Pacific (Hong Kong) | Asia Pacific (Mumbai) | Asia Pacific (Seoul) | Asia Pacific (Singapore) | Asia Pacific (Sydney) | Asia Pacific (Tokyo) | Canada (Central) | Europe (Frankfurt) | Europe (Ireland) | Europe (London) | Europe (Stockholm) | Middle East (Bahrain).

const WLMDB = 'wlmdb';
const INITIALIZER = 'initializer';
const MSSQL = 'mssql';
const ORACLE = 'oracle';
const PGSQL = 'pgsql';
const WINDOWS = 'windows';

const ARTIFACT_BUCKET_NAME = process.env.ARTIFACT_BUCKET_NAME || config.get<string>('bucket.artifacts');
const SIGNED_TEMPLATES_BUCKET_NAME = process.env.TEMPLATE_BUCKET_NAME || config.get<string>('bucket.signedTemplates');
const TEMPLATE_BUCKET_REGION = process.env.WLMDB_BUCKET_REGION || config.get<string>('bucket.region');
const CF_DEPLOY_ROLE_NAME = 'CfDeployRoleName';
const VALIDATION_AMI = 'ValidationAmi';
const VALIDATION_INSTANCE_TYPE = 'ValidationNodeInstanceType';
const MSSQL_MEDIA_BUCKET_NAME = 'LaunchWizard-sqlha';
const MSSQL_MEDIA_PATH_KEY = 'launchwizardscripts/sqlmedia/sqlserver.iso';
const MASTER_TEMPLATE_PATH = 'templates/wlm-master.yaml';
const PGSQL_MASTER_TEMPLATE_PATH = 'pgsql/templates/wlm-master.yaml';
const CLOUD_FORMATION_STACK_URL = `https://${DEFAULT_AWS_REGION}.console.aws.amazon.com/cloudformation/home`;
const CLOUD_FORMATION_CLI_COMMAND = 'aws cloudformation create-stack';
const DISABLE_ROLLBACK = true;
// In private network, time taken is longer
const MASTER_STACK_TIMEOUT_MINUTES = 240;
const RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES = 60;
const FSX_SSD_MIN_SIZE = 1024; // in GiB
const FSX_SSD_MAX_SIZE = 211106; // in GiB
const EBS_VOLUME_SIZE = 'EBSVolumeSize';
const EBS_DEFAULT_VOLUME_SIZE = 100;

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
    preferredDomainController: 'PreferredDomainController',
    ouPath: 'OUPath',
    adGroup: 'ADGroup',

    fsxDeploymentMode: 'DeploymentMode',
    fsxFileSystemId: 'FSxFileSystemId',
    fsxPassword: 'FSxAdminPassword',
    fsxVolThroughput: 'FSxVolumeThroughputCapacity',
    fsxIOPS: 'FSxDiskIops',
    ontapSgGroupId: 'ONTAPSecurityGroupID',
    encryptionKey: 'FileSystemEncryptionKeyId',
    snapshotPolicy: 'FsxVolumeSnapshotPolicy',

    sqlDeploymentMode: 'SQLDeploymentMode',
    sqlAmiId: 'SQLAMIID',
    serviceAccountPassword: 'SQLServiceAccountPassword',
    sqlServerName: 'SqlServerName',
    sqlCollation: 'SqlCollation',
    isCustomAmi: 'IsCustomAmi',
    isManagedServiceAccount: 'IsManagedServiceAccount',

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
    routeTable2Id: 'RouteTable2Id',
    preferredDomainController: 'PreferredDomainController',
    ouPath: 'OUPath',
    adGroup: 'ADGroup',
    isManagedServiceAccount: 'IsManagedServiceAccount'
};

const WLM_ASSETS: Record<string, string> = {
    MSSQLMediaBucketName: MSSQL_MEDIA_BUCKET_NAME,
    MSSQLMediaPathKey: MSSQL_MEDIA_PATH_KEY
};

// Template error messages
const MISSING_PERMISSIONS = (implicitlyDenied: MissingPermission[], explicitlyDenied: MissingPermission[]) =>
    `Required permissions are not available to deploy cloud formation template. Implicitly denied: ${JSON.stringify(
        implicitlyDenied
    )}. Explicitly denied: ${JSON.stringify(explicitlyDenied)}`;

const CF_QUOTA_REACHED = `Cloud Formation for stacks has reached or about to reach region quota. Around ${STACKS_DEPLOYED} may be deployed as part of deployment.`;
const STANDALONE_NETWORK_VIOLATION_MESSAGE =
    'For standalone deployment, private subnet 1 Id and route table 1 Id cannot be empty.';

const FCI_NETWORK_EMPTY_VIOLATION_MESSAGE =
    'For FCI deployment, private subnet 1 Id, route table 1 Id, private subnet 2 Id and route table 2 Id cannot be empty.';

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
const TEMPLATE_PRIVATESUBNET1_CIDRBLOCK = 'PrivateSubnet1Cidrblock';
const TEMPLATE_PRIVATESUBNET2_CIDRBLOCK = 'PrivateSubnet2Cidrblock';

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
        name: 'Dotnet',
        url: `${WLMDB}/Installer/dotnet.zip`
    },
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
        name: 'ScriptValidation',
        url: `${WLMDB}/scripts/validation.zip`
    },
    {
        name: 'DependentPackages',
        url: `${WLMDB}/Installer/dependent-packages.zip`
    },
    {
        name: 'ArtifactsSignatures',
        url: `${WLMDB}/signig_files.zip`
    },
    {
        name: 'OpenSSL',
        url: `${WLMDB}/OpenSSL-Win64.zip`
    },
    {
        name: 'ScriptSqlSetup',
        url: `${WLMDB}/scripts/Sql-Setup.ps1`
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
    EXISTINGFSX = 'existingfsx',
    PGSQLSTACK = 'pgsqlstack'
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

const TERRAFORM_SQL_INITIALIZATION_TEMPLATES_DISTRIBUTION = [
    {
        name: TEMPLATE_TYPES.VALIDATION,
        location: './resources/mssql/terraform/modules/validation-node/Validation-Instance-initializer.ps1'
    },
    {
        name: TEMPLATE_TYPES.SQLSTANDALONE,
        location: './resources/mssql/terraform/modules/ec2/Sql-Instance-initializer.ps1'
    }
];

const TERRAFORM_SQL_INITIALIZER_TEMPLATES_ASSETS = [
    {
        name: 'ValidationInitializerTemplate',
        url: 'terraform/validation/Validation-Instance-initializer.ps1'
    },
    {
        name: 'SQLStandaloneInitializerTemplate',
        url: 'terraform/standalone/Sql-Instance-initializer.ps1'
    },
    {
        name: 'SQLFCIInitializerTemplate',
        url: 'terraform/FCI/Sql-Instance-initializer.ps1'
    }
];

const TERRAFORM_ROOT_MODULE_DISTRIBUTION = {
    name: 'main',
    location: './resources/mssql/templates/main.tf'
};

const TERRAFORM_FOLDER_PATH = './resources/mssql/terraform';

const TERRAFORM_PGSQL_INITIALIZATION_TEMPLATES_DISTRIBUTION = [
    {
        name: TEMPLATE_TYPES.VALIDATION,
        location: './resources/pgsql/terraform/modules/validation-node/Validation-Instance-initializer.sh'
    },
    {
        name: TEMPLATE_TYPES.PGSQLSTACK,
        location: './resources/pgsql/terraform/modules/ec2/Pgsql-Instance-Initializer.sh'
    }
];

const TERRAFORM_PGSQL_INITIALIZER_TEMPLATES_ASSETS = [
    {
        name: 'ValidationInitializerTemplate',
        url: 'terraform/validation/Validation-Instance-initializer.sh'
    },
    {
        name: 'PGSQLStandaloneInitializerTemplate',
        url: 'terraform/standalone/Pgsql-Instance-Initializer.sh'
    },
    {
        name: 'PGSQLHAInitializerTemplate',
        url: 'terraform/FCI/Pgsql-Instance-Initializer.sh'
    }
];

const PGSQL_TERRAFORM_ROOT_MODULE_DISTRIBUTION = {
    name: 'main',
    location: './resources/pgsql/templates/main.tf'
};

const PGSQL_TERRAFORM_FOLDER_PATH = './resources/pgsql/terraform';

const PGSQL_TF_VARS_CONFIG = {
    EC2: 'ec2',
    FSX: 'fsx',
    PGSQLServer: 'pgsqlServer',
    General: 'general',
    Endpoint: 'endpoint',
    VPC: 'vpc'
};

const TF_VARS_CONFIG = {
    EC2: 'ec2',
    FSX: 'fsx',
    AD: 'ad',
    SQLServer: 'sqlServer',
    General: 'general',
    Endpoint: 'endpoint',
    VPC: 'vpc'
};

const CLOUDFORMATION_TO_TERRAFORM_VARIABLE_MAPPING: {
    [key: string]: { name: string; type: string; configType: string };
} = {
    AccountId: { name: 'account_id', type: 'string', configType: TF_VARS_CONFIG.General },
    ADScenarioType: { name: 'ad_scenario_type', type: 'string', configType: TF_VARS_CONFIG.AD },
    CfDeployRoleName: { name: 'tf_deploy_role_name', type: 'string', configType: TF_VARS_CONFIG.General },
    CloudProviderAccountId: { name: 'cloud_provider_account_id', type: 'string', configType: TF_VARS_CONFIG.General },
    CloudwatchLogsEndpointExists: {
        name: 'cloudwatch_logs_endpoint_exists',
        type: 'boolean',
        configType: TF_VARS_CONFIG.Endpoint
    },
    DeploymentMode: { name: 'deployment_mode', type: 'string', configType: TF_VARS_CONFIG.General },
    DNSIpAddresses: { name: 'dns_ip_addresses', type: 'string', configType: TF_VARS_CONFIG.AD },
    DomainAdminPassword: { name: 'domain_admin_password', type: 'string', configType: TF_VARS_CONFIG.AD },
    DomainAdminUser: { name: 'domain_admin_user', type: 'string', configType: TF_VARS_CONFIG.AD },
    DomainDNSName: { name: 'domain_dns_name', type: 'string', configType: TF_VARS_CONFIG.AD },
    DomainMemberSGID: { name: 'domain_member_sg_id', type: 'string', configType: TF_VARS_CONFIG.AD },
    PreferredDomainController: { name: 'preferred_domain_controller', type: 'string', configType: TF_VARS_CONFIG.AD },
    OUPath: { name: 'ou_path', type: 'string', configType: TF_VARS_CONFIG.AD },
    ADGroup: { name: 'ad_group', type: 'string', configType: TF_VARS_CONFIG.AD },
    Ec2EndpointExists: { name: 'ec2_endpoint_exists', type: 'boolean', configType: TF_VARS_CONFIG.Endpoint },
    Ec2MessagesEndpointExists: {
        name: 'ec2_messages_endpoint_exists',
        type: 'boolean',
        configType: TF_VARS_CONFIG.Endpoint
    },
    EnableCloudWatchLogFeature: {
        name: 'enable_cloud_watch_log_feature',
        type: 'boolean',
        configType: TF_VARS_CONFIG.General
    },
    FileSystemEncryptionKeyId: { name: 'fsx_encryption_key', type: 'string', configType: TF_VARS_CONFIG.FSX },
    FSxAdminPassword: { name: 'fsx_admin_password', type: 'string', configType: TF_VARS_CONFIG.FSX },
    FSxAdminUsername: { name: 'fsx_admin_username', type: 'string', configType: TF_VARS_CONFIG.FSX },
    FSxDataLunSize: { name: 'fsx_data_lun_size', type: 'number', configType: TF_VARS_CONFIG.FSX },
    FSxDataVolumeName: { name: 'fsx_data_volume_name', type: 'string', configType: TF_VARS_CONFIG.FSX },
    FSxDataVolumeSize: { name: 'fsx_data_volume_size', type: 'number', configType: TF_VARS_CONFIG.FSX },
    FSxDiskIops: { name: 'fsx_disk_iops', type: 'number', configType: TF_VARS_CONFIG.FSX },
    FsxEndpointExists: { name: 'fsx_endpoint_exists', type: 'boolean', configType: TF_VARS_CONFIG.Endpoint },
    FSxFileSystemId: { name: 'fsx_file_system_id', type: 'string', configType: TF_VARS_CONFIG.FSX },
    FSxFileSystemName: { name: 'fsx_file_system_name', type: 'string', configType: TF_VARS_CONFIG.FSX },
    FSxLogVolumeName: { name: 'fsx_log_volume_name', type: 'string', configType: TF_VARS_CONFIG.FSX },
    FSxLogVolumeSize: { name: 'fsx_log_volume_size', type: 'number', configType: TF_VARS_CONFIG.FSX },
    FSxQuorumVolumeName: { name: 'fsx_quorum_volume_name', type: 'string', configType: TF_VARS_CONFIG.FSX },
    FSxQuorumVolumeSize: { name: 'fsx_quorum_volume_size', type: 'number', configType: TF_VARS_CONFIG.FSX },
    FSxStorageCapacity: { name: 'fsx_storage_capacity', type: 'number', configType: TF_VARS_CONFIG.FSX },
    FSxSvmName: { name: 'fsx_svm_name', type: 'string', configType: TF_VARS_CONFIG.FSX },
    FSxTempDbVolumeName: { name: 'fsx_temp_db_volume_name', type: 'string', configType: TF_VARS_CONFIG.FSX },
    FSxTempDbVolumeSize: { name: 'fsx_temp_db_volume_size', type: 'number', configType: TF_VARS_CONFIG.FSX },
    FsxVolumeSnapshotPolicy: { name: 'fsx_volume_snapshot_policy', type: 'string', configType: TF_VARS_CONFIG.FSX },
    FSxVolumeThroughputCapacity: {
        name: 'fsx_volume_throughput_capacity',
        type: 'number',
        configType: TF_VARS_CONFIG.FSX
    },
    IsCustomAmi: { name: 'is_custom_ami', type: 'boolean', configType: TF_VARS_CONFIG.EC2 },
    KeyPairName: { name: 'key_pair_name', type: 'string', configType: TF_VARS_CONFIG.EC2 },
    MSSQLMediaBucketName: { name: 'mssql_media_bucket_name', type: 'string', configType: TF_VARS_CONFIG.SQLServer },
    MSSQLMediaPathKey: { name: 'mssql_media_path_key', type: 'string', configType: TF_VARS_CONFIG.SQLServer },
    NodeNetBIOSNames: { name: 'node_net_bios_names', type: 'string', configType: TF_VARS_CONFIG.SQLServer },
    ONTAPSecurityGroupID: { name: 'ontap_security_group_id', type: 'string', configType: TF_VARS_CONFIG.FSX },
    PrivateSubnet1Cidrblock: { name: 'private_subnet1_cidrblock', type: 'string', configType: TF_VARS_CONFIG.VPC },
    PrivateSubnet1ID: { name: 'private_subnet1_id', type: 'string', configType: TF_VARS_CONFIG.VPC },
    PrivateSubnet2Cidrblock: { name: 'private_subnet2_cidrblock', type: 'string', configType: TF_VARS_CONFIG.VPC },
    PrivateSubnet2ID: { name: 'private_subnet2_id', type: 'string', configType: TF_VARS_CONFIG.VPC },
    role_credentials_id: { name: 'role_credentials_id', type: 'string', configType: TF_VARS_CONFIG.General },
    RouteTable1Id: { name: 'route_table1_id', type: 'string', configType: TF_VARS_CONFIG.VPC },
    RouteTable2Id: { name: 'route_table2_id', type: 'string', configType: TF_VARS_CONFIG.VPC },
    S3EndpointExists: { name: 's3_endpoint_exists', type: 'boolean', configType: TF_VARS_CONFIG.Endpoint },
    S3EndpointRouteTables: { name: 's3_endpoint_route_tables', type: 'string', configType: TF_VARS_CONFIG.VPC },
    SQLAMIID: { name: 'sql_ami_id', type: 'string', configType: TF_VARS_CONFIG.EC2 },
    SqlCollation: { name: 'sql_collation', type: 'string', configType: TF_VARS_CONFIG.SQLServer },
    SQLDeploymentMode: { name: 'sql_deployment_mode', type: 'string', configType: TF_VARS_CONFIG.SQLServer },
    SQLigroupname: { name: 'sql_igroup_name', type: 'string', configType: TF_VARS_CONFIG.SQLServer },
    SqlServerName: { name: 'sql_server_name', type: 'string', configType: TF_VARS_CONFIG.SQLServer },
    SQLServiceAccountName: { name: 'sql_service_account_name', type: 'string', configType: TF_VARS_CONFIG.SQLServer },
    SQLServiceAccountPassword: {
        name: 'sql_service_account_password',
        type: 'string',
        configType: TF_VARS_CONFIG.SQLServer
    },
    IsManagedServiceAccount: {
        name: 'is_managed_service_account',
        type: 'boolean',
        configType: TF_VARS_CONFIG.SQLServer
    },
    SQLSvmName: { name: 'sql_svm_name', type: 'string', configType: TF_VARS_CONFIG.SQLServer },
    SsmEndpointExists: { name: 'ssm_endpoint_exists', type: 'boolean', configType: TF_VARS_CONFIG.Endpoint },
    SSMMessagesEndpointExists: {
        name: 'ssm_messages_endpoint_exists',
        type: 'boolean',
        configType: TF_VARS_CONFIG.Endpoint
    },
    UniqueID: { name: 'unique_id', type: 'string', configType: TF_VARS_CONFIG.General },
    ValidationAmi: { name: 'validation_ami', type: 'string', configType: TF_VARS_CONFIG.EC2 },
    ValidationNodeInstanceType: {
        name: 'validation_node_instance_type',
        type: 'string',
        configType: TF_VARS_CONFIG.EC2
    },
    VPCCIDR: { name: 'vpc_cidr', type: 'string', configType: TF_VARS_CONFIG.VPC },
    VPCID: { name: 'vpc_id', type: 'string', configType: TF_VARS_CONFIG.VPC },
    WlmdbAwsAccountId: { name: 'wlmdb_aws_account_id', type: 'string', configType: TF_VARS_CONFIG.General },
    WorkloadInstanceType: { name: 'workload_instance_type', type: 'string', configType: TF_VARS_CONFIG.EC2 },
    EBSVolumeSize: { name: 'ebs_volume_size', type: 'number', configType: TF_VARS_CONFIG.EC2 },
    SqlFSxWSFCName: { name: 'sql_fsx_ws_fc_name', type: 'string', configType: TF_VARS_CONFIG.General }
};

const CLOUDFORMATION_TO_TERRAFORM_PGSQL_VARIABLE_MAPPING: {
    [key: string]: { name: string; type: string; configType: string };
} = {
    AccountId: { name: 'account_id', type: 'string', configType: PGSQL_TF_VARS_CONFIG.General },
    CloudwatchLogsEndpointExists: {
        name: 'cloudwatch_logs_endpoint_exists',
        type: 'boolean',
        configType: PGSQL_TF_VARS_CONFIG.Endpoint
    },
    DeploymentMode: { name: 'deployment_mode', type: 'string', configType: PGSQL_TF_VARS_CONFIG.General },
    Ec2EndpointExists: { name: 'ec2_endpoint_exists', type: 'boolean', configType: PGSQL_TF_VARS_CONFIG.Endpoint },
    Ec2MessagesEndpointExists: {
        name: 'ec2_messages_endpoint_exists',
        type: 'boolean',
        configType: PGSQL_TF_VARS_CONFIG.Endpoint
    },
    EnableCloudWatchLogFeature: {
        name: 'enable_cloud_watch_log_feature',
        type: 'boolean',
        configType: PGSQL_TF_VARS_CONFIG.General
    },
    FileSystemEncryptionKeyId: {
        name: 'fsx_encryption_key',
        type: 'string',
        configType: PGSQL_TF_VARS_CONFIG.FSX
    },
    FSxAdminPassword: { name: 'fsx_admin_password', type: 'string', configType: PGSQL_TF_VARS_CONFIG.FSX },
    FSxAdminUsername: { name: 'fsx_admin_username', type: 'string', configType: PGSQL_TF_VARS_CONFIG.FSX },
    FSxDataVolumeName: { name: 'fsx_data_volume_name', type: 'string', configType: PGSQL_TF_VARS_CONFIG.FSX },
    FSxDataVolumeSize: { name: 'fsx_data_volume_size', type: 'number', configType: PGSQL_TF_VARS_CONFIG.FSX },
    FSxDiskIops: { name: 'fsx_disk_iops', type: 'number', configType: PGSQL_TF_VARS_CONFIG.FSX },
    FsxEndpointExists: { name: 'fsx_endpoint_exists', type: 'boolean', configType: PGSQL_TF_VARS_CONFIG.Endpoint },
    FSxFileSystemId: { name: 'fsx_file_system_id', type: 'string', configType: PGSQL_TF_VARS_CONFIG.FSX },
    FSxFileSystemName: { name: 'fsx_file_system_name', type: 'string', configType: PGSQL_TF_VARS_CONFIG.FSX },
    FSxLogVolumeName: { name: 'fsx_log_volume_name', type: 'string', configType: PGSQL_TF_VARS_CONFIG.FSX },
    FSxLogVolumeSize: { name: 'fsx_log_volume_size', type: 'number', configType: PGSQL_TF_VARS_CONFIG.FSX },
    FSxStorageCapacity: { name: 'fsx_storage_capacity', type: 'number', configType: PGSQL_TF_VARS_CONFIG.FSX },
    FSxSvmName: { name: 'fsx_svm_name', type: 'string', configType: PGSQL_TF_VARS_CONFIG.FSX },
    FsxVolumeSnapshotPolicy: {
        name: 'fsx_volume_snapshot_policy',
        type: 'string',
        configType: PGSQL_TF_VARS_CONFIG.FSX
    },
    FSxVolumeThroughputCapacity: {
        name: 'fsx_volume_throughput_capacity',
        type: 'number',
        configType: PGSQL_TF_VARS_CONFIG.FSX
    },
    SQLSvmName: { name: 'sql_svm_name', type: 'string', configType: PGSQL_TF_VARS_CONFIG.PGSQLServer },
    KeyPairName: { name: 'key_pair_name', type: 'string', configType: PGSQL_TF_VARS_CONFIG.EC2 },
    NodeNetBIOSNames: { name: 'node_net_bios_names', type: 'string', configType: PGSQL_TF_VARS_CONFIG.General },
    ONTAPSecurityGroupID: { name: 'ontap_security_group_id', type: 'string', configType: PGSQL_TF_VARS_CONFIG.FSX },
    PrivateSubnet1Cidrblock: {
        name: 'private_subnet1_cidrblock',
        type: 'string',
        configType: PGSQL_TF_VARS_CONFIG.VPC
    },
    PrivateSubnet1ID: { name: 'private_subnet1_id', type: 'string', configType: PGSQL_TF_VARS_CONFIG.VPC },
    PrivateSubnet2Cidrblock: {
        name: 'private_subnet2_cidrblock',
        type: 'string',
        configType: PGSQL_TF_VARS_CONFIG.VPC
    },
    PrivateSubnet2ID: { name: 'private_subnet2_id', type: 'string', configType: PGSQL_TF_VARS_CONFIG.VPC },
    RouteTable1Id: { name: 'route_table1_id', type: 'string', configType: PGSQL_TF_VARS_CONFIG.VPC },
    RouteTable2Id: { name: 'route_table2_id', type: 'string', configType: PGSQL_TF_VARS_CONFIG.VPC },
    S3EndpointExists: { name: 's3_endpoint_exists', type: 'boolean', configType: PGSQL_TF_VARS_CONFIG.Endpoint },
    S3EndpointRouteTables: { name: 's3_endpoint_route_tables', type: 'string', configType: PGSQL_TF_VARS_CONFIG.VPC },
    SsmEndpointExists: { name: 'ssm_endpoint_exists', type: 'boolean', configType: PGSQL_TF_VARS_CONFIG.Endpoint },
    SSMMessagesEndpointExists: {
        name: 'ssm_messages_endpoint_exists',
        type: 'boolean',
        configType: PGSQL_TF_VARS_CONFIG.Endpoint
    },
    UniqueID: { name: 'unique_id', type: 'string', configType: PGSQL_TF_VARS_CONFIG.General },
    ValidationAmi: { name: 'validation_ami', type: 'string', configType: PGSQL_TF_VARS_CONFIG.EC2 },
    ValidationNodeInstanceType: {
        name: 'validation_node_instance_type',
        type: 'string',
        configType: PGSQL_TF_VARS_CONFIG.EC2
    },
    VPCCIDR: { name: 'vpc_cidr', type: 'string', configType: PGSQL_TF_VARS_CONFIG.VPC },
    VPCID: { name: 'vpc_id', type: 'string', configType: PGSQL_TF_VARS_CONFIG.VPC },
    WlmdbAwsAccountId: { name: 'wlmdb_aws_account_id', type: 'string', configType: PGSQL_TF_VARS_CONFIG.General },
    WorkloadInstanceType: { name: 'workload_instance_type', type: 'string', configType: PGSQL_TF_VARS_CONFIG.EC2 },
    EBSVolumeSize: { name: 'ebs_volume_size', type: 'number', configType: PGSQL_TF_VARS_CONFIG.EC2 },
    SqlVersion: { name: 'sql_version', type: 'string', configType: PGSQL_TF_VARS_CONFIG.PGSQLServer },
    SQLAMIID: { name: 'sql_ami_id', type: 'string', configType: PGSQL_TF_VARS_CONFIG.PGSQLServer },
    SQLServiceAccountPassword: {
        name: 'sql_service_account_password',
        type: 'string',
        configType: PGSQL_TF_VARS_CONFIG.PGSQLServer
    },
    SqlServerName: { name: 'sql_server_name', type: 'string', configType: PGSQL_TF_VARS_CONFIG.PGSQLServer },
    SQLDeploymentMode: { name: 'sql_deployment_mode', type: 'string', configType: PGSQL_TF_VARS_CONFIG.PGSQLServer }
};

const MSSQL_DATABASE_INSTANCE_INDEX_MAPPING: { [index: number]: string } = {
    0: 'serverDetails',
    1: 'databaseInstancetopologyData',
    2: 'performance',
    3: 'storage',
    4: 'protection',
    5: 'resourceUtilization',
    6: 'databasesCount',
    7: 'nodeTopology',
    8: 'storageSavingsFromOntap'
};

const PGSQL_DATABASE_INSTANCE_INDEX_MAPPING: { [index: number]: string } = {
    0: 'storage',
    1: 'databaseInstancetopologyData',
    2: 'databasesCount',
    3: 'databases',
    4: 'performance',
    5: 'protection'
};

const ORACLE_DATABASE_INSTANCE_INDEX_MAPPING: { [index: number]: string } = {
    0: 'databaseInstancetopologyData',
    1: 'performance',
    2: 'protection',
    3: 'databasesCount',
    4: 'databases'
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
const API_PAGE_SIZE = 100;
const V2_API_PAGE_SIZE = 25;
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
const HA = 'ha';
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
const AWS_SSM_PARAMETER = 'AWS_SSM_PARAMETER';
const AWS_CE_TYPE = 'AWS_CE';
const AWS_CO_TYPE = 'AWS_CO';
const MARKETING_API_TCO = 'MARKETING_API_TCO';
const EMAIL_RATE_LIMIT_TYPE = 'EMAIL_RATE_LIMIT';

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
    SERVER_DETAILS = 'serverDetails',
    NODE_TOPOLOGY = 'nodeTopology',
    INSTANCE_DETAILS = 'instanceDetails',
    DATABASE_INSTANCE_TOPOLOGY = 'databaseInstanceTopology',
    DATABASES_WITH_PROTECTION = 'databasesWithProtection',
    DATABASES = 'databases',
    DATABASE_SERVER = 'databaseServer',
    AOAG = 'aoag'
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

// SQL software types
const SQL_STD = 'SQL std';
const SQL_ENT = 'SQL ent';
const SQL_WEB = 'SQL web';
const CUSTOM = 'custom';
const NA = 'NA';

const SQL_SOFTWARE_TYPES = new Map<string, string>([
    [SQL_STD, SQL_STD],
    [SQL_ENT, SQL_ENT],
    [SQL_WEB, SQL_WEB],
    [CUSTOM, NA]
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

const PGSQL_SYSTEM_DATABASES = ['postgres', 'template0', 'template1'];

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

const CF_STACK_RESOURCE_TYPE = 'AWS::CloudFormation::Stack';
const RESOURCE_SOURCE = {
    DEPLOY: 'deployment',
    DISCOVER: 'discovery'
};

const ENDPOINTS_DEPLOYMENT = ['s3', 'cloudformation', 'sqs', 'ssm', 'ssmmessages', 'ec2messages', 'logs', 'fsx', 'ec2'];

const SSM_PARAMETERS_BASE_PATH = '/netapp/wlmdb';
const COMPLETE = 'Complete';

const CUSTOM_SSM_EXECUTION_TIMEOUT = '180';
const ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT = '300';
const ASSESSMENT_SSM_EXECUTION_TIMEOUT = '1800';

const VALIDATION_NODE_INSTANCETYPE = 'm5.xlarge';

const ONLINE = 'ONLINE';
const OFFLINE = 'OFFLINE';
const UNKNOWN = 'UNKNOWN';

const BLOCKED_BY_SCP = 'blocked by scp';

const SIMULATE_IAM_POLICY = 'SimulatePrincipalPolicy';

const MAX_FSX_STORAGE_IN_GIB = 196608;
const FSX_VOL_THROUGHPUT = 4096;
const FSX_STORAGE_MIN_CAPACITY_IN_GIB = 5120;
const FSX_IOPS = 160000;
const DATABASE_MAX_LUN_SIZE_IN_GIB = 133120;
const DATABASE_MIN_LUN_SIZE_IN_GIB = 120;
const FAIL_LONGRUNNING_DEPLOYMENT_JOB_INTERVAL = '5h';
const FAIL_LONGRUNNING_RESOURCE_PREPARE_JOB_INTERVAL = '1h';
const DBCREATE_RELATIVE_PATH = `${WLMDB}/scripts/dbcreate.zip`;
const PSMODULES_RELATIVE_PATH = `${WLMDB}/Installer/aws_ssm.zip`;
const PREPARE_PSMODULES_RELATIVE_PATH = `${WLMDB}/Installer/dependent-packages.zip`;
const POWERSHELL_7_RELATIVE_PATH = `${WLMDB}/Installer/powershell.zip`;
const DEFAULT_INSTANCE_NAME = 'MSSQLSERVER';
const DEFAULT_MSSQL_INSTANCE_NAME = '$env:computername';
const MAX_DATA_LUN_SIZE_IN_GIB = 86049.3;
const AWS_CLI_LINUX_RELATIVE_PATH = `${WLMDB}/oracle/packages/awscliv2.tar.gz`;
const JQ_LINUX_RELATIVE_PATH = `${WLMDB}/oracle/packages/jq-1.8.0.tar.gz`;
const MAKE_LINUX_RELATIVE_PATH = `${WLMDB}/oracle/packages/make-4.4.1.tar.gz`;
const LINUX_HOST_UTILITIES_RELATIVE_PATH = `${WLMDB}/oracle/packages/netapp-linux-host-utilities-7.1.tar.gz`;

const PERMISSION_DENIAL_POSSIBLE_REASONS = {
    MISSING: 'permission statement is missing',
    BLOCKED_SCP: 'permission blocked by SCP',
    BLOCKED_BOUNDARY: 'permission blocked due to boundary',
    OTHERS: 'permission is denied in "Effect" or due to other reasons'
};

const NO_SANDBOX_CREATED = 'No sandboxes created for the instance';

const STORAGE_PROTOCOLS = { SMB: 'SMB', ISCSI: 'iSCSI', NFS: 'NFS' };

const AMI_OWNERS = { AMAZON: 'amazon' };

const SSM_PARAM_PREFIX = '/netapp/wlmdb/';

const CUSTOM_AMI_VALIDATION_INSTANCE_TYPE = 'm5.xlarge';

const HOURS_IN_MONTH = 730;

const VERSION_2_0 = '2.0';

const SANDBOX_EXTENDED_PROPERTY_FLAG_NAME = 'cloned_by';

const SANDBOX_EXTENDED_PROPERTY_FLAG_VALUE = 'netapp_wf';

const ACCOUNTID = 'accountId';

const SANDBOX_LIFECYCLE_REFRESH = 'REFRESH';
const SANDBOX_LIFECYCLE_REBASELINE = 'RE-BASELINE';

enum SandboxLifecycleAction {
    REFRESH = 'Refresh',
    REBASELINE = 'Re-baseline'
}

const STORAGE_SERVICE_DEFAULT_REGION = 'us-east-1';
const FINDING = {
    OPTIMIZED: 'OPTIMIZED',
    NOT_OPTIMIZED: 'NOT_OPTIMIZED',
    INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
    UNDER_PROVISIONED: 'UNDER_PROVISIONED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS'
};

const SQL_SERVICE_STATE = {
    RUNNING: 'Running',
    STOPPED: 'Stopped'
};

const ORACLE_INSTANCE_STATE = {
    STARTED: 'STARTED',
    OPEN: 'OPEN'
};

const WIN_SQL_EC2_USAGE_OPERATION = ['RunInstances:0102', 'RunInstances:0006', 'RunInstances:0202'];

const DEMO_STANDALONE_SQL_SERVER_ID = 'f4b7c5d3-e1f6-4g2a-9c4l';

const DEMO_STANDALONE_INSTANCE_ID = 'i-c5x3z1a7s9d2f3g';

const TCO_FEATURE = 'TCO';
const CONTINUOUS_ASSESSMENT_FEATURE = 'CONTINUOUS_ASSESSMENT';

const CURRENT_SCRIPT_VERSION = '1.9.0';

const PGSQL_VERSION = 'pgsql-version';
const AMAZON_LINUX_AMI_PATH = '/aws/service/ami-amazon-linux-latest';
const AL2023_AMI_NAME = `${AMAZON_LINUX_AMI_PATH}/al2023-ami-kernel-6.1-x86_64`;

const PG_TEMPLATE_CONFIG_MAPPING: Record<string, string> = {
    vpcId: 'VPCID',
    vpcCidr: 'VPCCIDR',
    vpcName: 'VPCName',
    privateSubnet1Id: 'PrivateSubnet1ID',
    routeTable1Id: 'RouteTable1Id',
    privateSubnet2Id: 'PrivateSubnet2ID',
    routeTable2Id: 'RouteTable2Id',

    fsxDeploymentMode: 'DeploymentMode',
    fsxFileSystemId: 'FSxFileSystemId',
    fsxPassword: 'FSxAdminPassword',
    fsxVolThroughput: 'FSxVolumeThroughputCapacity',
    fsxIOPS: 'FSxDiskIops',
    ontapSgGroupId: 'ONTAPSecurityGroupID',
    encryptionKey: 'FileSystemEncryptionKeyId',
    snapshotPolicy: 'FsxVolumeSnapshotPolicy',

    sqlDeploymentMode: 'SQLDeploymentMode',
    sqlAmiId: 'SQLAMIID',
    sqlServerName: 'SqlServerName',
    serviceAccountPassword: 'SQLServiceAccountPassword',
    sqlVersion: 'SqlVersion',

    workloadInstanceType: 'WorkloadInstanceType',
    keyPairName: 'KeyPairName',

    topicArn: 'NotificationARN',
    enableCloudWatch: 'EnableCloudWatchLogFeature',
    metrics: 'Metrics'
};

const PGSQL_TEMPLATES_DISTRIBUTION = [
    {
        name: TEMPLATE_TYPES.VALIDATION,
        location: './resources/pgsql/templates/vpc-validation.yaml'
    },
    // {
    //     name: TEMPLATE_TYPES.SQLSTACK,
    //     location: './resources/pgsql/templates/sql-windows-fci-config_nosignal.yaml'
    // },
    {
        name: TEMPLATE_TYPES.PGSQLSTACK,
        location: './resources/pgsql/templates/pgsql-server.yaml'
    },
    {
        name: TEMPLATE_TYPES.ENDPOINT,
        location: './resources/pgsql/templates/vpc-endpoints.yaml'
    },
    {
        name: TEMPLATE_TYPES.NEWFSX,
        location: './resources/pgsql/templates/fsx-new.yaml'
    },
    {
        name: TEMPLATE_TYPES.EXISTINGFSX,
        location: './resources/pgsql/templates/fsx-existing.yaml'
    }
];

const PGSQL_RESOURCE_ASSETS = [
    {
        name: 'ScriptValidation',
        url: `${WLMDB}/pgsql/scripts/validation.zip`
    },
    {
        name: 'ScriptVerifySignature',
        url: `${WLMDB}/pgsql/scripts/verify-signature.sh`
    },
    {
        name: 'ScriptUnzipArchive',
        url: `${WLMDB}/pgsql/scripts/unzip-archive.sh`
    },
    {
        name: 'ArtifactsSignatures',
        url: `${WLMDB}/pgsql/signig_files.zip`
    },
    {
        name: 'ScriptCommon',
        url: `${WLMDB}/pgsql/scripts/common.zip`
    },
    {
        name: 'ScriptSetup',
        url: `${WLMDB}/pgsql/scripts/setup.zip`
    },
    {
        name: 'FsxCertificates',
        url: `${WLMDB}/fsx_certs.zip`
    },
    {
        name: 'PGSQLPackages',
        url: `${WLMDB}/pgsql/packages/pgvector.zip`
    },
    {
        name: 'PGPOOLPackage',
        url: `${WLMDB}/pgsql/packages/pgpool.zip`
    }
];

const PGSQL_TEMPLATES_ASSETS = [
    {
        name: 'FSXNewTemplate',
        url: 'pgsql/templates/fsx-new.yaml'
    },
    {
        name: 'FSXExistingTemplate',
        url: 'pgsql/templates/fsx-existing.yaml'
    },
    {
        name: 'ValidationTemplate',
        url: 'pgsql/templates/vpc-validation.yaml'
    },
    {
        name: 'VpcEndpointTemplate',
        url: 'pgsql/templates/vpc-endpoints.yaml'
    },
    {
        name: 'PGSQLTemplate',
        url: 'pgsql/templates/pgsql-server.yaml'
    }
];

const PGSQL_MASTER_TEMPLATE_DISTRIBUTION = {
    name: TEMPLATE_TYPES.MASTER,
    location: './resources/pgsql/templates/wlm-master.yaml'
};

const PG_TEMPLATE_OPTIONAL_PARAMETERS: Record<string, string> = {
    encryptionKey: 'FileSystemEncryptionKeyId',
    privateSubnet1Id: 'PrivateSubnet1ID',
    routeTable1Id: 'RouteTable1Id',
    privateSubnet2Id: 'PrivateSubnet2ID',
    routeTable2Id: 'RouteTable2Id'
};
const TIMELINE_SERVICE_NAME = 'WF-Databases';

const EBS_ROOT_VOLUME = 'ROOT_VOLUME';

const PERMISSIONS_TO_IGNORE_FOR_DEPLOYMENT = [
    'compute-optimizer:GetEnrollmentStatus',
    'compute-optimizer:PutRecommendationPreferences',
    'compute-optimizer:GetEffectiveRecommendationPreferences',
    'compute-optimizer:GetEC2InstanceRecommendations',
    'autoscaling:DescribeAutoScalingGroups',
    'autoscaling:DescribeAutoScalingInstances',
    'fsx:UpdateFileSystem',
    'fsx:UpdateVolume',
    'fsx:DescribeBackups',
    'bedrock:GetFoundationModelAvailability',
    'bedrock:ListInferenceProfiles',
    'logs:PutRetentionPolicy',
    'logs:GetLogEvents',
    'cloudwatch:GetMetricData',
    'cloudwatch:GetMetricStatistics'
];

const AWS_ERROR_CODES = {
    ec2NotFound: 'InvalidInstanceID.NotFound'
};

const DEMO_AWS_ACCOUNT_ID = randomize('0', 12);
const DEMO_DEFAULT_REGION = 'us-east-1';

/*
sqlServerEngineEdition = EngineEdition	Database Engine edition of the instance of SQL Server installed on the server.
    2 = Standard (For Standard, Web, and Business Intelligence.)
    3 = Enterprise (For Evaluation, Developer, and Enterprise editions.)
    */
const ENT_ENGINE_EDITION = 3;
const STD_ENGINE_EDITION = 2;

const PGSQL_CW_CONFIG = `{
                                    "agent": {
                                        "metrics_collection_interval": 5,
                                        "run_as_user": "cwagent",
                                        "region": "\${AWS::Region}"
                                    },
                                    "logs": {
                                        "logs_collected": {
                                            "files": {
                                                "collect_list": [
                                                    {
                                                        "file_path": "/var/log/cfn-*.log",
                                                        "log_group_name": "\${ParentStackName}",
                                                        "log_stream_name": "{instance_id}"
                                                    },
                                                    {
                                                        "file_path": "/home/ec2-user/cfn/log/*.log",
                                                        "log_group_name": "\${ParentStackName}",
                                                        "log_stream_name": "{instance_id}"
                                                    },
                                                    {
                                                        "file_path": "/var/log/netapp_wf/*.log",
                                                        "log_group_name": "\${ParentStackName}",
                                                        "log_stream_name": "{instance_id}"
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                }
`;

const SQL_CASE_INSENSITIVE = 'collate SQL_Latin1_General_CP1_CI_AS';
// 2MB
const MAX_EMAIL_ATTACHMENT_SIZE = 2048;
const EMAIL_TYPES = {
    SAVINGS_CALCULATIONS: 'savings-calculations'
};

const PRICING_LICENSE_KEYS = {
    SQL_ENT: 'SQL Ent',
    SQL_STD: 'SQL Std',
    SQL_WEB: 'SQL Web'
};

const GERERIC_JOB_ERROR_MESSAGE = 'Examine the subjobs for comprehensive error messages.';
const PGSQL_DEFAULT_INSTANCE_NAME = 'postgresql';
const ORACLE_INSTANCE_NAME = 'oracle';

const GENERIC_ASSESSMENT_ERROR_MESSAGE = (category: string) =>
    `No ${category} assessment data found. Assessment is scheduled to run every 24hours and may not have run on the instance. Please try after running adhoc assessment.`;

enum CLONE_ACTION {
    DELETE = 'delete',
    REFRESH = 'refresh'
}

const RESTRICTED_FSX_REGIONS: Array<string> = [
    'us-gov-east-1',
    'us-gov-west-1',
    'cn-north-1',
    'cn-northwest-1',
    'eusc-de-east-1',
    'us-iso-east-1',
    'us-iso-west-1',
    'us-isob-east-1'
];

const CLOUDWATCH_LOG_GROUP_FOR_SSM_RESPONSE = 'netapp/wlmdb/ssm-response';
const CLONE_AGE: number = config.has('clone-age-in-days') ? config.get('clone-age-in-days') : 60; // Fall Back to 60 days as default if not set in config
const OTHER_CLONE = 'other';
const POSTPONE_AGE: number = config.has('postpone-age-in-days') ? config.get('postpone-age-in-days') : 30; // Fall Back to 30 days as default if not set in config
const CLOUD_WATCH_METRICS_PERFORMANCE_NAMESPACE = 'netapp/wlmdb/performance';
const CLOUD_WATCH_METRICS_PERFORMANCE_METRIC_NAMES = [
    'cpuUsed',
    'readThroughput',
    'writeThroughput',
    'readIops',
    'writeIops',
    'readLatency',
    'writeLatency',
    'serverIOLatency'
];

const WF_NOTIFICATION_RESOURCE_TYPE = 'DB';
const SNAPCENTER_BACKUP_SNAPSHOT_COMMENT = 'creator=snapcenter';
enum WF_NOTIFICATION_PRIORITY {
    WF_CRITICAL = 'Critical',
    WF_RECOMMENDATION = 'Recommendation',
    WF_INFO = 'Info',
    WF_WARNING = 'Warning',
    WF_ERROR = 'Error',
    WF_SUCCESS = 'Success'
}

const AWSDAC_MODULE_DIR = `${process.cwd()}/resources/packages`;
const INSTANCE_PERFORMANCE_ASSESSMENT_QUEUE = 'WLMDB-InstancePerformanceAssessmentQueue';
const WELL_ARCHITECTED_ASSESSMENT_NOTIFICATION_QUEUE = 'WLMDB-WellArchitectedAssessmentNotificationQueue';

enum NOTIFICATION_TYPE {
    DEPLOYMENT = 'Deployment',
    WELL_ARCHITECTED = 'Well-architected'
}
const WELL_ARCHITECTED_ASSESSMENT_NOTIFICATION_CRON_PATTERN: string = config.has(
    'well-architected-assessment-notification'
)
    ? config.get('well-architected-assessment-notification')
    : '0 5 */7 * *'; // Default to every 7 days at 5 AM if not set in config
const DAILY_DRIFT_ASSESSMENT_TRIGGER_CRON_PATTERN: string = config.has('daily-drift-assessment-trigger')
    ? config.get('daily-drift-assessment-trigger')
    : '0 0 0 * * *'; // Default to every 12 midnight everyday not set in config

const DEMO_ENTERPRISE_INSTANCES = ['i-cb05c810a74426184', 'i-0ab2e12971d543c14', 'i-cb05c810a74426187'];

const JOB_MONITORING_ENDPOINT = 'databases/job-monitoring';
enum SSM_COMMAND_RUNTIMES {
    POWERSHELL = 'PowerShell',
    SHELL = 'Shell'
}
const CLOUDFLARE_DNS_IP = '1.1.1.1';
const NOTIFICATION_SERVICE_NAME = 'Workload Factory for Databases';

const STORAGE_LABEL: { [key: string]: string } = {
    ebs: 'Amazon EBS',
    fsxw: 'Amazon FSx for Windows',
    onprem: 'On-premises'
};

const DATABASE_LABEL: { [key: string]: string } = {
    MSSQL: 'Microsoft SQL Server',
    ORACLE: 'Oracle Database'
};
// Temp directory for file operations (writable in read-only pods)
const TEMP_DIRECTORY = '/tmp';

// Limit is 64KB, use a slightly smaller threshold to account for parameter and document overhead
const SSM_COMMAND_COMPRESSION_THRESHOLD = 62 * 1024;

const ORACLE_CPU_CATALOG_LOOKBACK_YEARS = 2;
const ORACLE_CPU_CATALOG_FILE_PATH = join(TEMP_DIRECTORY, 'oracle-cpu-catalog.json');
const ORACLE_CPU_CATALOG_QUEUE = 'WLMDB-OracleCpuCatalogQueue';
// runs at 3:00 AM on the 24th of January, April, July, and October. That's ~2-10 days after each CPU release (3rd Tuesday).
// const ORACLE_CPU_CATALOG_CRON_PATTERN = '0 3 24 1,4,7,10 *';
const ORACLE_CPU_CATALOG_CRON_PATTERN = '0 3 * * *'; // for testing, runs every day at 3:00 AM

export {
    TEMP_DIRECTORY,
    WLMDB,
    AWS_REGIONS,
    IO2_AVAILABLE_REGIONS,
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
    RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES,
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
    OracleDeploymentModel,
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
    HA,
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
    DEPLOYMENT_JOBS_FAILED_STATUS,
    DEPLOYMENT_JOBS_LIST_FILTER,
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
    OFFLINE,
    UNKNOWN,
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
    FAIL_LONGRUNNING_RESOURCE_PREPARE_JOB_INTERVAL,
    DBCREATE_RELATIVE_PATH,
    DEFAULT_INSTANCE_NAME,
    PERMISSION_DENIAL_POSSIBLE_REASONS,
    NO_SANDBOX_CREATED,
    STORAGE_PROTOCOLS,
    CUSTOM,
    AMI_OWNERS,
    SSM_PARAM_PREFIX,
    CUSTOM_AMI_VALIDATION_INSTANCE_TYPE,
    PSMODULES_RELATIVE_PATH,
    EBS_VOLUME_SIZE,
    EBS_DEFAULT_VOLUME_SIZE,
    HOURS_IN_MONTH,
    VERSION_2_0,
    SANDBOX_EXTENDED_PROPERTY_FLAG_NAME,
    SANDBOX_EXTENDED_PROPERTY_FLAG_VALUE,
    ACCOUNTID,
    DEFAULT_MSSQL_INSTANCE_NAME,
    V2_API_PAGE_SIZE,
    SandboxLifecycleAction,
    SANDBOX_LIFECYCLE_REFRESH,
    SANDBOX_LIFECYCLE_REBASELINE,
    STORAGE_SERVICE_DEFAULT_REGION,
    FINDING,
    SQL_SERVICE_STATE,
    TEMPLATE_PRIVATESUBNET1_CIDRBLOCK,
    TEMPLATE_PRIVATESUBNET2_CIDRBLOCK,
    WIN_SQL_EC2_USAGE_OPERATION,
    DEMO_STANDALONE_INSTANCE_ID,
    DEMO_STANDALONE_SQL_SERVER_ID,
    CURRENT_SCRIPT_VERSION,
    PGSQL_VERSION,
    PG_TEMPLATE_CONFIG_MAPPING,
    PGSQL_TEMPLATES_DISTRIBUTION,
    PGSQL_RESOURCE_ASSETS,
    PGSQL_TEMPLATES_ASSETS,
    PGSQL_MASTER_TEMPLATE_DISTRIBUTION,
    PG_TEMPLATE_OPTIONAL_PARAMETERS,
    TCO_FEATURE,
    CONTINUOUS_ASSESSMENT_FEATURE,
    AWS_SSM_PARAMETER,
    TIMELINE_SERVICE_NAME,
    AuditStatus,
    PREPARE_PSMODULES_RELATIVE_PATH,
    EBS_ROOT_VOLUME,
    TERRAFORM_SQL_INITIALIZATION_TEMPLATES_DISTRIBUTION,
    TERRAFORM_SQL_INITIALIZER_TEMPLATES_ASSETS,
    CLOUDFORMATION_TO_TERRAFORM_VARIABLE_MAPPING,
    TERRAFORM_FOLDER_PATH,
    TERRAFORM_ROOT_MODULE_DISTRIBUTION,
    AWS_CE_TYPE,
    AWS_CO_TYPE,
    MARKETING_API_TCO,
    PGSQL_MASTER_TEMPLATE_PATH,
    MAX_DATA_LUN_SIZE_IN_GIB,
    TF_VARS_CONFIG,
    PERMISSIONS_TO_IGNORE_FOR_DEPLOYMENT,
    INITIALIZER,
    MSSQL,
    ORACLE,
    AL2023_AMI_NAME,
    DEMO_AWS_ACCOUNT_ID,
    DEMO_DEFAULT_REGION,
    ENT_ENGINE_EDITION,
    STD_ENGINE_EDITION,
    AWS_ERROR_CODES,
    CF_STACK_COUNT_QUOTACODE,
    MSSQL_DATABASE_INSTANCE_INDEX_MAPPING,
    PGSQL_DATABASE_INSTANCE_INDEX_MAPPING,
    ORACLE_DATABASE_INSTANCE_INDEX_MAPPING,
    PGSQL_CW_CONFIG,
    SQL_CASE_INSENSITIVE,
    MAX_EMAIL_ATTACHMENT_SIZE,
    EMAIL_RATE_LIMIT_TYPE,
    EMAIL_TYPES,
    PRICING_LICENSE_KEYS,
    ASSESSMENT_SSM_EXECUTION_TIMEOUT,
    TERRAFORM_PGSQL_INITIALIZATION_TEMPLATES_DISTRIBUTION,
    TERRAFORM_PGSQL_INITIALIZER_TEMPLATES_ASSETS,
    PGSQL_TERRAFORM_FOLDER_PATH,
    PGSQL_TERRAFORM_ROOT_MODULE_DISTRIBUTION,
    PGSQL_TF_VARS_CONFIG,
    CLOUDFORMATION_TO_TERRAFORM_PGSQL_VARIABLE_MAPPING,
    PGSQL,
    WINDOWS,
    GERERIC_JOB_ERROR_MESSAGE,
    STORAGE_ASSESSMENT_JOB_TRIGGER_TYPES,
    ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
    PGSQL_SYSTEM_DATABASES,
    AWS_REGION_KEYS,
    AMAZON_LINUX_AMI_PATH,
    CLOUDWATCH_LOG_GROUP_FOR_SSM_RESPONSE,
    GENERIC_ASSESSMENT_ERROR_MESSAGE,
    RESTRICTED_FSX_REGIONS,
    CLONE_AGE,
    PGSQL_DEFAULT_INSTANCE_NAME,
    ORACLE_INSTANCE_NAME,
    POWERSHELL_7_RELATIVE_PATH,
    CLONE_ACTION,
    OTHER_CLONE,
    ORACLE_INSTANCE_STATE,
    POSTPONE_AGE,
    WF_NOTIFICATION_RESOURCE_TYPE,
    WF_NOTIFICATION_PRIORITY,
    CLOUD_WATCH_METRICS_PERFORMANCE_NAMESPACE,
    CLOUD_WATCH_METRICS_PERFORMANCE_METRIC_NAMES,
    SNAPCENTER_BACKUP_SNAPSHOT_COMMENT,
    INSTANCE_PERFORMANCE_ASSESSMENT_QUEUE,
    WELL_ARCHITECTED_ASSESSMENT_NOTIFICATION_QUEUE,
    NOTIFICATION_TYPE,
    WELL_ARCHITECTED_ASSESSMENT_NOTIFICATION_CRON_PATTERN,
    DAILY_DRIFT_ASSESSMENT_TRIGGER_CRON_PATTERN,
    AWSDAC_MODULE_DIR,
    ORACLE_CPU_CATALOG_LOOKBACK_YEARS,
    ORACLE_CPU_CATALOG_FILE_PATH,
    ORACLE_CPU_CATALOG_QUEUE,
    ORACLE_CPU_CATALOG_CRON_PATTERN,
    DEMO_ENTERPRISE_INSTANCES,
    AWS_CLI_LINUX_RELATIVE_PATH,
    JQ_LINUX_RELATIVE_PATH,
    MAKE_LINUX_RELATIVE_PATH,
    JOB_MONITORING_ENDPOINT,
    LOCAL_AUTH,
    SSM_COMMAND_RUNTIMES,
    CLOUDFLARE_DNS_IP,
    LINUX_HOST_UTILITIES_RELATIVE_PATH,
    NOTIFICATION_SERVICE_NAME,
    SSM_COMMAND_COMPRESSION_THRESHOLD,
    STORAGE_LABEL,
    DATABASE_LABEL
};