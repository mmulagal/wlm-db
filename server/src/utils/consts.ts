import { readFileSync } from 'fs';
import config from 'config';
import { join } from 'path';
import moment from 'moment';

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
    MULTI_AZ_1
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
const AUDIT_EXCLUDE_LIST = ['/batch'];
const DEFAULT_AWS_REGION = 'us-east-1';

const DEFAULT_AWS_CREDENTIALS_TYPE = 'aws_assume_role';

const CLOUD_MANAGER_ENDPOINT: string = config.get<string>('urls.cloud-manager');
const TENANCY_ENDPOINT: string = `${CLOUD_MANAGER_ENDPOINT}/tenancy`;
const AGENTS_MANAGEMENT_ENDPOINT: string = `${CLOUD_MANAGER_ENDPOINT}/agents-mgmt`;
const SIGNOZ_ENDPOINT: string = config.get<string>('urls.signoz');
const WLMDB_ENDPOINT: string = config.get<string>('urls.wlm-db');
const WLMDB_ABSOLUTE_ENDPOINT: string = config.get('urls.wlm-db-redirect-url');

const CREDENTIALS_ENDPOINT: string = config.get<string>('urls.cloud-manager');

const CLOUD_MANAGER_GET_CVO_WE_PREFIX = '/occm/api/working-environments';

const RESOURCE_CLASS = 'STORAGE_SERVICES';
const WLMDB_RESOURCE_CLASS = 'WLMDB';
enum DatabaseTypes {
    MS_SQL_SERVER = 'MSSQL'
}

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

enum DeploymentState {
    INITIALIZING = 'Initializing',
    SUCCESS = 'Success',
    FAILED = 'Failed'
}

enum RouteTags {
    AWS = 'AWS',
    GENERIC = 'Generic',
    SYSTEM = 'System',
    DEPLOYMENT = 'Deployment',
    WORKING_ENVIRONMENT = 'Working Environment',
    DATABASE = 'Database',
    BATCH = 'Batch',
    PRICING = 'Pricing'
}

enum HttpErrorCodes {
    INTERNAL_SERVER_ERROR = 500,
    NOT_FOUND = 404,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    VALIDATION_ERROR = 422
}

enum SqlServerDeploymentModel {
    SQL_STANDALONE = 'Standalone Instance',
    SQL_FCI = 'Always On Failover Cluster Instance'
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
        : undefined,
    DATABASE_URL: process.env.DATABASE_URL
};

const SECRETS_MANAGER_KEYS: Record<string, string> = {
    CLIENT_ID: 'CLIENT_ID',
    CLIENT_SECRET: 'CLIENT_SECRET',
    DATABASE_URL: 'DATABASE_URL',
    SIGNURL_ACCESS_KEY: 'SIGNURL_ACCESS_KEY',
    SIGNURL_SECRET_KEY: 'SIGNURL_SECRET_KEY'
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

enum RESOURCESTYPE {
    MSSQL = 'MSSQL',
    FSX = 'FSX'
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
    ['cn-north-1', 'China (Beijing)	'],
    ['cn-north-1', 'China (Beijing)'],
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

const BUCKET_NAME = config.get<string>('templates.bucket');
const ASSETS_BUCKET_REGION = config.get<string>('templates.region');
const BUCKET_PREFIX = 'templates';
const EC2_ROLE_NAME = 'Ec2RoleName';
const VALIDATION_AMI = 'ValidationAmi';
const MSSQL_MEDIA_BUCKET_NAME = 'LaunchWizard-sqlha';
const MSSQL_MEDIA_PATH_KEY = 'launchwizardscripts/sqlmedia/sqlserver.iso';
const ASSETS_REGION_CODE = `s3.${ASSETS_BUCKET_REGION}`;
const MASTER_TEMPLATE_PATH = 'templates/wlm-master.yaml';
const CLOUD_FORMATION_STACK_URL = `https://${ASSETS_BUCKET_REGION}.console.aws.amazon.com/cloudformation/home`;
const MASTER_TEMPLATE_URL = `https://${BUCKET_NAME}.${ASSETS_REGION_CODE}.amazonaws.com/${MASTER_TEMPLATE_PATH}`;
const DISABLE_ROLLBACK = true;
const MASTER_STACK_TIMEOUT_MINUTES = 180;
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

    fsxDeploymentMode: 'DeploymentMode',
    fsxFileSystemId: 'FSxFileSystemId',
    fsxVolThroughput: 'FSxVolumeThroughputCapacity',
    fsxIOPS: 'FSxDiskIops',
    ontapSgGroupId: 'ONTAPSecurityGroupID',
    encryptionKey: 'FileSystemEncryptionKeyId',

    sqlDeploymentMode: 'SQLDeploymentMode',
    sqlAmiId: 'SQLAMIID',
    serviceAccountName: 'SQLServiceAccountName',
    sqlServerName: 'SqlServerName',

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

const AWS_FSX = 'aws/fsx';
const TEMPLATE_CLOUD_PROVIDER_ID = 'CloudProviderAccountId';
const TEMPLATE_JWT_TOKEN = 'JwtToken';
const TEMPLATE_CREDENTIALS_ID = 'RoleCredentialsId';
const TEMPLATE_ACCOUNT_ID = 'AccountId';
const TEMPLATE_SNS_SERVICE_TOKEN = 'SnsServiceToken';

const SQL_RESOURCE_ASSETS = [
    {
        name: 'DSC',
        url: 'DSC.zip'
    },
    {
        name: 'DSCSignature',
        url: 'DSC.zip.sig'
    },
    {
        name: 'PowerShell',
        url: 'Installer/powershell.zip'
    },
    {
        name: 'PowerShellSignature',
        url: 'Installer/powershell.zip.sig'
    },
    {
        name: 'Sqlspcu',
        url: 'Installer/sqlspcu.zip'
    },
    {
        name: 'SqlspcuSignature',
        url: 'Installer/sqlspcu.zip.sig'
    },
    {
        name: 'AmazonFailoverCluster',
        url: 'modules/AmznFailoverCluster.zip'
    },
    {
        name: 'AmazonFailoverClusterSignature',
        url: 'modules/AmznFailoverCluster.zip.sig'
    },
    {
        name: 'AmazonLaunchWizardForCFN',
        url: 'modules/AWSLaunchWizardForCFN.zip'
    },
    {
        name: 'AmazonLaunchWizardForCFNSignature',
        url: 'modules/AWSLaunchWizardForCFN.zip.sig'
    },
    {
        name: 'AmazonLaunchWizardForSSM',
        url: 'modules/AWSLaunchWizardForSSM.zip'
    },
    {
        name: 'AmazonLaunchWizardForSSMSignature',
        url: 'modules/AWSLaunchWizardForSSM.zip.sig'
    },
    {
        name: 'ScriptVerifySignature',
        url: 'scripts/Verify-Signature.ps1'
    },
    {
        name: 'ScriptUnzipArchive',
        url: 'scripts/Unzip-Archive.ps1'
    },
    {
        name: 'ScriptCommon',
        url: 'scripts/common.zip'
    },
    {
        name: 'ScriptCommonSignature',
        url: 'scripts/common.zip.sig'
    },
    {
        name: 'ScriptSQLFCI',
        url: 'scripts/sqlfci.zip'
    },
    {
        name: 'ScriptSQLFCISignature',
        url: 'scripts/sqlfci.zip.sig'
    },
    {
        name: 'ScriptSQLONTAP',
        url: 'scripts/sqlontap.zip'
    },
    {
        name: 'ScriptSQLONTAPSignature',
        url: 'scripts/sqlontap.zip.sig'
    },
    {
        name: 'ScriptVpcCheck',
        url: 'validation/Validate-VPCConnectivity.ps1'
    },
    {
        name: 'ScriptUpdateDnsServers',
        url: 'validation/Update-DNSServers.ps1'
    },
    {
        name: 'ScriptRenameComputer',
        url: 'validation/Rename-Computer.ps1'
    },
    {
        name: 'ScriptRestartComputer',
        url: 'validation/Restart-Computer.ps1'
    },
    {
        name: 'ScriptAdValidation',
        url: 'validation/Validate-Credentials.ps1'
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
    SQLSTANDALONE = 'sqlstandalone'
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

const FCI_STACKNAME = 'SQLFCIStack';
const STANDALONE_STACKNAME = 'Standalone';

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

export {
    WLMDB,
    AWS_REGIONS,
    AWS_RESOURCES_ACTION_MAP,
    SERVICE_QUOTAS_ACTION_NAMES,
    SERVICE_QUOTAS,
    FSX_ACTION_NAMES,
    FSX,
    FSX_BATCH_CONCURRENCY_VALUE,
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
    AUDIT_EXCLUDE_LIST,
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
    SAME_ROUTETABLE_MESSAGE,
    FileSystemDeploymentType,
    FSX_RESOURCE_TYPE,
    RESOURCESTYPE,
    FSX_SSD_MIN_SIZE,
    FSX_SSD_MAX_SIZE,
    VALIDATION_AMI,
    ASSETS_BUCKET_REGION,
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
    CF_NOTIFICATION,
    ERROR_CODE_SQS_NON_EXISTENT_QUEUE,
    ERROR_CODE_SQS_INVALID_TOKEN,
    METHODS_WITH_PAYLOAD,
    SERVICE_TOKEN,
    TOKEN_EXPIRATION_TIME,
    WLMDB_ENDPOINT,
    BATCH_API_CONCURRENCY_LIMIT,
    FCI_STACKNAME,
    STANDALONE_STACKNAME,
    CRITICAL,
    PUBLISH,
    MOREINFO,
    ACTION_BUTTON_DASHBOARD,
    ACTION_BUTTON_DATABASE,
    RESOURCE_ID,
    WLMDB_ABSOLUTE_ENDPOINT,
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
    SQL_DEPLOYMENET_INITIATED_SUBJECT
};
