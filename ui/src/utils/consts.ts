import { GENERAL } from './appConstants';

export const AUTH_STATUS = {
    AUTH_STATUS_SUCCESS: 'AUTH_SUCCESS',
    AUTH_STATUS_ERROR: 'AUTH_ERROR',
    AUTH_STATUS_PROGRESS: 'AUTH_PROGRESS'
};

//Environments names should be aligned with .env files
export const PRODUCTION = 'PRODUCTION';
export const STAGING = 'STAGING';
export const LOCAL = 'LOCAL';

// Input for credentials API
export const AWS_ASSUME_ROLE = 'aws_assume_role';

// VPC API default query fields
export const VPC_API_FIELDS = 'subnet';

// Default query fields value for AMI API
export const OS_TYPE = 'windows';
export const DATABASE_TYPE = 'sql';

// Default username for FSxN when creating new
export const FSXADMIN = 'fsxadmin';

// Default database name
export const SQL_DATABASE = 'sqldatabase';
export const SQL_USERNAME = 'sqlsa';

// Active Directory scenario type
export const AWS_MANAGED_AD = 'AWS_MANAGED_AD';
export const USER_MANAGED_AD = 'USER_MANAGED_AD';

// KMS status/state
export const ENABLED_STATE = 'Enabled';
export const DISABLED_STATE = 'Disabled';
export const PENDING_DELETION = 'PendingDeletion';
export const DEFAULT_MASTER_KEY = 'aws/fsx';

// Default instance type
export const DEAFULT_INSTANCE_VALUE = 'm5.xlarge';

// Add credentials link
export const CREDENTIAL_STAGE_LINK = 'https://staging.cloudmanager.netapp.com/credentials/account-credentials';
export const CREDENTIAL_PROD_LINK = 'https://cloudmanager.netapp.com/credentials/account-credentials';

// Add WF credentials link
// export const CREDENTIAL_WF_STAGE_LINK = 'https://staging.console.workloads.netapp.com/credentials';
// export const CREDENTIAL_WF_PROD_LINK = 'https://console.workloads.netapp.com/credentials';

// Add timeline link
export const TIMELINE_STAGE_LINK = 'https://staging.cloudmanager.netapp.com/timeline';
export const TIMELINE_PROD_LINK = 'https://cloudmanager.netapp.com/timeline';

// Add workload policies
export const WLMDB_POLICIES_STAGE_LINK = 'https://staging.console.workloads.netapp.com';
export const WLMDB_POLICIES_PROD_LINK = 'https://console.workloads.netapp.com';

//Retry API on gateway timeout
export const API_MAX_RETRIES = 2;

//License URL
export const LICENSE_URL =
    'https://docs.aws.amazon.com/launchwizard/latest/userguide/launch-wizard-setting-up.html#launch-wizard-custom-ami';

// Regions code list in a fixed order
export const REGIONS_CODE_LIST = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'eu-west-1',
    'eu-central-1',
    'eu-central-2',
    'ap-south-1',
    'ap-south-2',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-southeast-3',
    'ap-southeast-4',
    'ap-northeast-1',
    'ap-northeast-2',
    'sa-east-1',
    'ca-central-1',
    'eu-west-2',
    'eu-west-3',
    'eu-north-1',
    'us-gov-west-1',
    'us-gov-east-1',
    'cn-northwest-1',
    'cn-north-1',
    'ap-east-1',
    'me-south-1',
    'af-south-1',
    'eu-south-1',
    'eu-south-2',
    'ap-northeast-3',
    'me-central-1'
];

export const DATABASE_SERVICE_PATH = 'database-services';

export const WORKLOADS = 'workloads';

export const FROM_DIALOG = {
    LOAD_CONFIG: 'load_config',
    SAVE_CONFIG: 'save_config',
    HEADER_CROSS: 'header_cross',
    DETECT_HOST: 'detect_host'
};

export const API_NAME = {
    REGION: 'region',
    VPC: 'vpc',
    SG: 'sg',
    ADS: 'ads',
    SNS: 'sns',
    KMS: 'kms',
    KEYPAIR: 'keypair',
    INSTANCE: 'instance',
    AMI: 'ami',
    FSXN: 'fsxn',
    COLLATION: 'collation'
};

export const FSX_DEPLOYMENT_MODE = {
    SINGLE_AZ_1: 'SINGLE_AZ_1',
    MULTI_AZ_1: 'MULTI_AZ_1'
};

export const SQL_DEPLOYMENT_MODE = {
    FAILOVER_CLUSTER_VALUE: 'fci',
    SINGLE_INSTANCE_VALUE: 'standalone'
};

export const API_ERRORS = {
    DUPLICATE_CONFIG_NAME: 'An unique key constraint violated uk_wlmdb_config_account_id_name_user',
    RATE_EXCEEDED: 'rate exceeded'
};

export const STATUS_CONST = {
    UP: 'Up',
    DOWN: 'Down',
    INITIALIZING: 'Initializing',
    FAILED: 'Failed',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed'
};

export const JOB_MONITORING_STATUS = {
    FAILED: 'FAILED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED'
};

export const JOB_MONITORING_TYPE = {
    DEPLOYMENT: 'DEPLOYMENT',
    CREATE_RESOURCE: 'CREATE_RESOURCE'
};

export const MAX_SAVED_CONFIG = 100;

export const WLF_TO_FORM_NAVIGATE = '../add-working-environment/database-services/mssql/create';

export const FORM_TO_WLF_NAVIGATE = '../databases';

export const RECOMMENDED_TEMPLATES = {
    DEV_ID: '0',
    PROD_ID: '1',
    DEV_NAME: 'Dev/Test',
    PROD_NAME: 'Production'
};

export const CURL_REQ_TEMPLATE = (
    baseUrl: string,
    credentialId: string,
    region: string,
    token: string,
    payload: any
) => `
curl --location --request POST '${baseUrl}/credentials/${credentialId}/regions/${region}/cloudformation/deploy' \\
--header 'Authorization: Bearer ${token}' \\
--header 'Content-Type: application/json' \\
--data-raw '${payload}'
`;

export const CRED_PLACEHOLDERS = {
    ACCOUNT_ID: '<AccountId>',
    CRED_ID: '<CredentialId>',
    REGION: '<Region>',
    TOKEN: '<Token>',
    DATABASE_HOST_ID: '<databaseHostId>'
};

export const MARKETING_PAGE_URL = 'https://workloads.netapp.com/database-workloads';

export const DB_HOME_DATA_TYPE = {
    HOSTS: 'hosts',
    JOBS: 'jobs'
};

export const CODEBOX_REST_RES = {
    API: 'api',
    VIEW: 'view',
    COPY: 'copy',
    ORIGINAL_DATA: 'Original Data'
};

export const COSTING_TYPES = {
    BILLING: 'billing',
    PRICING: 'pricing'
};

export const JM_DOWNLOAD = {
    MAIN_JOBS_KEYS: ['id', 'type', 'status', 'resourceName', 'name', 'startTime', 'endTime'],
    MAIN_JOBS_CSV_HEADERS: 'Job ID,Type,Status,Resource name,Job name,Start time,End time',
    SUB_JOBS_KEYS: ['description', 'status', 'startTime', 'endTime'],
    SUB_JOBS_CSV_HEADERS: 'Name,Status,Start time,End time'
};

export const AWS_CLI_HIGHLIGHT_STRINGS = [
    'ParameterKey=',
    'ParameterValue=',
    '--stack-name',
    '--template-url',
    '--region',
    '--parameters'
];

export const CREATE_DATABASE_YAML = 'Create_Database';

export const CHATBOT_WELCOME_CARDS = [
    { label: 'Help me deploy Microsoft SQL Server on FSx for ONTAP.' },
    { label: 'What are the key features of Amazon FSx for NetApp ONTAP for databases?' },
    { label: 'What are the key benefits of Amazon FSx for NetApp ONTAP for databases?' },
    {
        label: 'What is the FSx for ONTAP best practice for Microsoft SQL Server?',
        value: 'What are some best practices for using FSx for ONTAP with Microsoft SQL Server?'
    }
];

export const CHATBOT_SUGGESTION_BUBBLES = [
    { label: 'Resume the current deployment', value: 'resume' },
    { label: 'Start a new deployment', value: 'start' }
];

export const ADV_CREATE_SUGGESTION_BUBBLES = [
    { label: 'Yes, I would like to continue with deployment', value: 'resume' },
    { label: "No, I'd like to start a new conversation", value: 'explore' }
];

export const JOBS_REPORT = 'jobs_report_';

export const UI_IDS = {
    WIZARD_REDIRECT_TO_CF: 'wizard-redirect-to-cf',
    DBP_REDIRECT_TO_CF: 'dbp-redirect-to-cf',
    WIZARD_CODEBOX_COPY: 'wizard-codebox-copy',
    DBP_CODEBOX_COPY: 'dbp-codebox-copy',
    WIZARD_CODEBOX_REST_API: 'wizard-codebox-rest-api',
    DBP_CODEBOX_REST_API: 'dbp-codebox-rest-api',
    WIZARD_CODEBOX_AWS_CLI: 'wizard-codebox-aws-cli',
    DBP_CODEBOX_AWS_CLI: 'dbp-codebox-aws-cli',
    WIZARD_CODEBOX_CF: 'wizard-codebox-cf',
    DBP_CODEBOX_CF: 'dbp-codebox-cf'
};

export const WLF_TABS = {
    DASHBOARD: 'Dashboard',
    INVENTORY: 'Inventory',
    OVERVIEW: 'Overview',
    SANDBOXES: 'Sandboxes',
    EXPLORE_SAVINGS: 'Explore savings',
    SAVINGS_CALCULATOR: 'Savings Calculator',
    VIEW_THE_CALCULATIONS: 'View the calculations',
    JOB_MONITORING: 'Job monitoring',
    DATABASE_LIST: 'Database list',
    MANAGED_HOSTS: 'Managed hosts',
    UNMANAGED_HOSTS: 'Unmanaged hosts',
    UNDETECTED_HOSTS: 'Undetected hosts'
};

export const DRIVE_LETTER_TYPE = {
    NEW: 'New drive letter',
    EXISTING: 'Existing drive letter'
};

export const DEPLOY_ENDPOINT = '/cloudformation/deploy';
export const CREATE_DB_ENDPOINT = (databaseHostId: any) => `/database-hosts/${databaseHostId}/database`;

export const CREATE_DB_CURL_REQ_TEMPLATE = (
    baseUrl: string,
    credentialId: string,
    region: string,
    databaseHostId: any,
    token: string,
    payload: any
) => `
curl --location --request POST '${baseUrl}/credentials/${credentialId}/regions/${region}/database-hosts/${databaseHostId}/database' \\
--header 'Authorization: Bearer ${token}' \\
--header 'Content-Type: application/json' \\
--data-raw '${payload}'
`;

export const CREATE_RESOURCE = 'CREATE_RESOURCE'; // Job monitoring type for DB create

export const SSM_TROUBLESHOOTING_LINK =
    'https://docs.aws.amazon.com/systems-manager/latest/userguide/troubleshooting-ssm-agent.html';

export const GIB_IN_BYTE = 1073741824; // 1024 * 1024 * 1024
export const TIB_IN_BYTE = 1099511627776; // 1024 * 1024 * 1024 * 1024

export const DETECT_HOST_VAR = {
    FSXN: 'FSXN',
    EBS: 'EBS',
    FSXW: 'FSXW',
    SSM_CONNECTED: 'connected',
    MOVE_TO_MANAGE: 'move_to_manage',
    MOVE_TO_UNMANAGE: 'move_to_unmanage',
    FSX: 'FSX',
    MSSQL: 'MSSQL',
    RUNNING: 'Running',
    DISABLE: 'disable',
    SHOW: 'show',
    HIDE: 'hide'
};

export const DB_VERSIONS = [
    { label: GENERAL.SQL_SERVER_2016, value: GENERAL.SQL_SERVER_2016_VERSION },
    { label: GENERAL.SQL_SERVER_2019, value: GENERAL.SQL_SERVER_2019_VERSION },
    { label: GENERAL.SQL_SERVER_2022, value: GENERAL.SQL_SERVER_2022_VERSION }
];

export const DB_EDITIONS = [
    {
        label: GENERAL.SQL_SERVER_STANDARD_EDITION,
        value: GENERAL.SQL_SERVER_STANDARD
    },
    {
        label: GENERAL.SQL_SERVER_ENTERPRiSE_EDITION,
        value: GENERAL.SQL_SERVER_ENTERPRISE
    }
];

export const DB_DEPLOYMENT_MODEL = [
    {
        label: GENERAL.FAILOVER_CLUSTER,
        value: SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
    },
    {
        label: GENERAL.SINGLE_INSTANCE,
        value: SQL_DEPLOYMENT_MODE.SINGLE_INSTANCE_VALUE
    }
];

export const THROUGHPUT_LIST = [
    { label: '128 MBps', value: 128 },
    { label: '256 MBps', value: 256 },
    { label: '512 MBps', value: 512 },
    { label: '1 GBps', value: 1024 },
    { label: '2 GBps', value: 2048 },
    { label: '4 GBps', value: 4096 }
];

export const MSSQL_DATABASE_TYPES = {
    SYSTEM: 'System Database',
    USER: 'User Database'
};
