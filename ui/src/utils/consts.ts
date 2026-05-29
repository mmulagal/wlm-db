import { GENERAL } from './appConstants';

export const AUTH_STATUS = {
    AUTH_STATUS_SUCCESS: 'AUTH_SUCCESS',
    AUTH_STATUS_ERROR: 'AUTH_ERROR',
    AUTH_STATUS_PROGRESS: 'AUTH_PROGRESS'
};

export const WIZARD_TYPE = {
    PGSQL: 'pgsql',
    MSSQL: 'mssql',
    ORACLE: 'oracle'
} as const;

export const POLICIES_PERMISSIONS = {
    VIEW_POLICY: 'View, planning, and analysis',
    OPERATE_POLICY: 'Operations and remediation',
    INSTANCE_PROFILE_POLICY: 'instance-profile',
    WELL_ARCHITECTED_FSX__POLICY: 'well-architected-fsx',
    WELL_ARCHITECTED_COMPUTE_POLICY: 'well-architected-compute-optimizer',
    DATABASE_HOST_CREATION_POLICY: 'Database host creation'
};

// Environments names should be aligned with .env files
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
export const POSTGRE_USERNAME = 'postgres';

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
export const CREDENTIAL_STAGE_LINK = 'https://staging.console.netapp.com/fsxadministration/credentials';
export const CREDENTIAL_PROD_LINK = 'https://console.netapp.com/fsxadministration/credentials';

// Required security group rules for PgSQL Standalone
export const PGSQL_STANDALONE_SECURITY_GROUP_RULES: { type: string; protocol: string; portRange: string }[] = [
    { type: 'PostgreSQL', protocol: 'TCP', portRange: '5432' },
    { type: 'NFS', protocol: 'TCP', portRange: '2049' },
    { type: 'Custom TCP', protocol: 'TCP', portRange: '9999' },
    { type: 'SSH', protocol: 'TCP', portRange: '22' }
];

// Maximum number of security groups that can be selected
export const MAX_SG_SELECTION = 4;

// Required security group rules for PgSQL HA
export const PGSQL_HA_SECURITY_GROUP_RULES: { type: string; protocol: string; portRange: string }[] = [
    { type: 'NFS', protocol: 'TCP', portRange: '2049' },
    { type: 'PostgreSQL', protocol: 'TCP', portRange: '5432' },
    { type: 'SSH', protocol: 'TCP', portRange: '22' }
];

// Required security group for MSSQL rules
export const MSSQL_SECURITY_GROUP_RULES: { type: string; protocol: string; portRange: string }[] = [
    { type: 'SMB', protocol: 'TCP', portRange: '445' },
    { type: 'Custom TCP', protocol: 'TCP', portRange: '3343' },
    { type: 'Custom TCP', protocol: 'TCP', portRange: '135' },
    { type: 'DNS (TCP)', protocol: 'TCP', portRange: '53' },
    { type: 'Custom TCP', protocol: 'TCP', portRange: '88' },
    { type: 'Custom UDP', protocol: 'UDP', portRange: '389' },
    { type: 'Custom UDP', protocol: 'UDP', portRange: '137' },
    { type: 'Custom UDP', protocol: 'UDP', portRange: '3343' },
    { type: 'Custom TCP', protocol: 'TCP', portRange: '636' },
    { type: 'DNS (UDP)', protocol: 'UDP', portRange: '53' },
    { type: 'Custom UDP', protocol: 'UDP', portRange: '88' },
    { type: 'WinRM-HTTP', protocol: 'TCP', portRange: '5985' },
    { type: 'Custom TCP', protocol: 'TCP', portRange: '49152 - 65535' },
    { type: 'LDAP', protocol: 'TCP', portRange: '389' },
    { type: 'Custom UDP', protocol: 'UDP', portRange: '1024 - 65534' },
    { type: 'Custom TCP', protocol: 'TCP', portRange: '3268 - 3269' },
    { type: 'Custom TCP', protocol: 'TCP', portRange: '464' },
    { type: 'Custom UDP', protocol: 'UDP', portRange: '123' },
    { type: 'Custom UDP', protocol: 'UDP', portRange: '464' },
    { type: 'Custom TCP', protocol: 'TCP', portRange: '9389' }
];

// Add WF credentials link
// export const CREDENTIAL_WF_STAGE_LINK = 'https://staging.console.workloads.netapp.com/credentials';
// export const CREDENTIAL_WF_PROD_LINK = 'https://console.workloads.netapp.com/credentials';

// Add workload policies
export const WLMDB_POLICIES_STAGE_LINK = 'https://staging.console.workloads.netapp.com';
export const WLMDB_POLICIES_PROD_LINK = 'https://console.workloads.netapp.com';

// Retry API on gateway timeout
export const API_MAX_RETRIES = 3;
export const MIN_RETRY_DELAY = 5000;

/** Five minutes in milliseconds (e.g. creationTime vs now checks). */
export const FIVE_MINUTES_MS = 5 * 60 * 1000;

// License URL
export const LICENSE_URL =
    'https://docs.aws.amazon.com/launchwizard/latest/userguide/launch-wizard-getting-started.html#launch-wizard-amis';

// AWS resize URL
export const AWS_RESIZE_URL = 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/resize-limitations.html';

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
    CUSTOM_TIMEFRAME: 'CustomTimeframe',
    LOAD_CONFIG: 'load_config',
    SAVE_CONFIG: 'save_config',
    HEADER_CROSS: 'header_cross',
    DETECT_HOST: 'detect_host',
    SANDBOX_REFRESH: 'sandbox_refresh',
    DISMISS: 'dismiss',
    OPTIMIZE: 'optimize',
    FSXADMIN: 'fsxadmin',
    SQLSERVER: 'sqlserver',
    ORACLEASM: 'oracleasm',
    ORACLESERVER: 'oracleserver',
    SINGLE_AGENT: 'single_agent',
    LOADER: '',
    EXPLORE_SAVINGS: 'explore_savings',
    WINDOWS_AUTH: 'windows_auth',
    MANAGE_WIZARD: 'manage_wizard',
    CRR_REDIRECTION: 'crrRedirection'
};

export const DBType = {
    POSTGRESQL: 'PostgreSQL',
    MSSQL: 'Microsoft SQL Server',
    ORACLE: 'Oracle'
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
    CUSTOM_AMI: 'custom_ami',
    FSXN: 'fsxn',
    COLLATION: 'collation'
};

export const FSX_DEPLOYMENT_MODE = {
    SINGLE_AZ_1: 'SINGLE_AZ_1',
    MULTI_AZ_1: 'MULTI_AZ_1',
    SINGLE_AZ_2: 'SINGLE_AZ_2',
    MULTI_AZ_2: 'MULTI_AZ_2'
};

export const SQL_DEPLOYMENT_MODE = {
    FAILOVER_CLUSTER_VALUE: 'fci',
    SINGLE_INSTANCE_VALUE: 'standalone',
    AOAG: 'aoag',
    HA: 'ha',
    FAILOVER_CLUSTER_VALUE_CAPS: 'FCI'
};

export const DATABASE_DEPLOYMENT_MODE = {
    FAILOVER_CLUSTER_INSTANCES: 'Failover Cluster Instances',
    STANDALONE: 'Standalone',
    AOAG: 'Always on availability group',
    DATAGUARD: 'Data Guard',
    AOAG_CAPS: 'AOAG',
    AOAG_FULL: 'ALWAYS ON AVAILABILITY GROUP'
};

export const SQL_SERVER_EDITIONS = [
    'SQL server Standard',
    'SQL server Enterprise',
    'SQL server Web',
    'SQL server Developer'
] as const;

export const ORACLE_EDITIONS = ['Enterprise Edition', 'Standard Edition 2'] as const;

export const DATABASE_STATUS = {
    ONLINE: 'ONLINE',
    OFFLINE: 'OFFLINE'
};

export const REPLICA_ROLES = {
    PRIMARY: 'PRIMARY',
    SECONDARY: 'SECONDARY'
};
export const OVERVIEW_CARDS_HEADINGS = {
    DATA_GUARD_CONFIGURATIONS: 'Data Guard configuration'
};

export const TENANCY = {
    SINGLE_TENANT: 'SINGLE_TENANT'
};

export const API_ERRORS = {
    DUPLICATE_CONFIG_NAME: 'An unique key constraint violated uk_wlmdb_config_account_id_name_user',
    RATE_EXCEEDED: 'rate exceeded',
    POWERSHELL_7: 'PowerShell 7 is required for managing the resource'
};

export const WLF_TO_PROTECT_NAVIGATE = '../postgreSQL-deploy-wizard';

export const STATUS_CONST = {
    UP: 'Up',
    DOWN: 'Down',
    INITIALIZING: 'Initializing',
    FAILED: 'Failed',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    ONLINE: 'Online',
    OFFLINE: 'Offline',
    UNKNOWN: 'Unknown',
    OPEN: 'OPEN',
    STARTED: 'STARTED',
    MOUNTED: 'MOUNTED',
    OPEN_MIGRATE: 'OPEN MIGRATE'
};

export const JOB_MONITORING_STATUS = {
    FAILED: 'FAILED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    WARNING: 'WARNING'
};

export const JOB_MONITORING_TYPE = {
    DEPLOYMENT: 'DEPLOYMENT',
    CREATE_RESOURCE: 'CREATE_RESOURCE',
    CREATE_DATABASE: 'CREATE_DATABASE',
    PREPARE_RESOURCE: 'PREPARE_RESOURCE',
    SANDBOX: 'SANDBOX',
    ASSESSMENT: 'ASSESSMENT',
    OPTIMIZE: 'OPTIMIZATION',
    WELL_ARCHITECTED: 'WELL_ARCHITECTED',
    REGISTER_RESOURCE: 'REGISTER_RESOURCE',
    LOGS_ANALYSIS: 'LOGS_ANALYSIS'
};

export const FSXN_STORAGE_PROTOCOLS = {
    ISCSI: 'iSCSI',
    SMB: 'SMB',
    NFS: 'NFS'
};

export const STORAGE_TYPES = {
    FSX_FOR_ONTAP: 'FSx for ONTAP',
    FSXN: 'FSXN',
    FSX_FOR_WINDOWS: 'FSx for Windows'
};

export const MAX_SAVED_CONFIG = 100;

export const WLF_TO_FORM_NAVIGATE = '../mssql-deploy-wizard';

export const FORM_TO_WLF_NAVIGATE = '../databases';
export const FORM_TO_WLF_NAVIGATE_JOB_MONITORING = '../databases/job-monitoring';
export const FORM_TO_WLF_NAVIGATE_INVENTORY = '../databases/inventory';
export const FORM_TO_WLF_NAVIGATE_SANDBOXES = '../databases/sandboxes';
export const FORM_TO_WLF_NAVIGATE_BLUEXP = '../fsxdb/job-monitoring';
export const FORM_TO_WLF_NAVIGATE_BLUEXP_JM = '../fsxdb/jobMonitoring';
export const FORM_TO_WLF_NAVIGATE_BLUEXP_SANDBOXES = '../fsxdb/sandboxes';
export const FORM_TO_WLF_NAVIGATE_BLUEXP_INVENTORY = '../fsxdb/inventory';

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
    payload: any,
    isWorkloadFactory: boolean | any
) => {
    if (isWorkloadFactory) {
        return `
        curl --location --request POST '${baseUrl}/mssql/credentials/${credentialId}/regions/${region}/cloudformation/deploy' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --data-raw '${payload}'
        `;
    }
    return `
        curl --location --request POST '${baseUrl}/mssql/credentials/${credentialId}/regions/${region}/cloudformation/deploy' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --header 'x-netapp-referer: BlueXP' \\
        --data-raw '${payload}'
        `;
};

export const PGSQL_CURL_REQ_TEMPLATE = (
    baseUrl: string,
    credentialId: string,
    region: string,
    token: string,
    payload: any,
    isWorkloadFactory: boolean | any
) => {
    if (isWorkloadFactory) {
        return `
        curl --location --request POST '${baseUrl}/pgsql/credentials/${credentialId}/regions/${region}/cloudformation/deploy' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --data-raw '${payload}'
        `;
    }
    return `
        curl --location --request POST '${baseUrl}/pgsql/credentials/${credentialId}/regions/${region}/cloudformation/deploy' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --header 'x-netapp-referer: BlueXP' \\
        --data-raw '${payload}'
        `;
};

export const CRED_PLACEHOLDERS = {
    ACCOUNT_ID: '<AccountId>',
    CRED_ID: '<CredentialId>',
    REGION: '<Region>',
    TOKEN: '<Token>',
    DATABASE_HOST_ID: '<databaseHostId>'
};

export const DB_HOME_DATA_TYPE = {
    HOSTS: 'hosts',
    JOBS: 'jobs'
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

export const SEVERITIES = {
    TWENTY_TWENTY_FOUR: '20-24',
    SEVENTEEN_NINETEEN: '17-19',
    SIXTEEN: '16'
};

export const timeUnits = [
    { id: 1, label: '12:00', value: '12:00' },
    { id: 2, label: '11:00', value: '11:00' },
    { id: 3, label: '10:00', value: '10:00' },
    { id: 4, label: '09:00', value: '09:00' },
    { id: 5, label: '08:00', value: '08:00' },
    { id: 6, label: '07:00', value: '07:00' },
    { id: 7, label: '06:00', value: '06:00' },
    { id: 8, label: '05:00', value: '05:00' },
    { id: 9, label: '04:00', value: '04:00' },
    { id: 10, label: '03:00', value: '03:00' },
    { id: 11, label: '02:00', value: '02:00' },
    { id: 12, label: '01:00', value: '01:00' }
];

export const CREATE_DATABASE_YAML = 'Create_Database';

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
    DBP_CODEBOX_CF: 'dbp-codebox-cf',
    WIZARD_CODEBOX_TF: 'wizard-codebox-tf',
    DBP_CODEBOX_TF: 'dbp-codebox-tf'
};

export const WLF_TABS = {
    DASHBOARD: 'Dashboard',
    DASHBOARD_INNER_PAGE: 'DashboardInnerPage',
    DASHBOARD_DISMISS_PAGE: 'DashboardDismissPage',
    OPTIMIZE_INNER_PAGE: 'OptimizeInnerPage',
    DASHBOARD_OPTIMIZE_INNER_PAGE: 'DashboardOptimizeInnerPage',
    OPTIMIZE_ONTAP_INNER_PAGE: 'OptimizeOntapInnerPage',
    INVENTORY: 'Inventory',
    WELL_ARCHITECTED_TAB: 'Well Architected Tab',
    OVERVIEW: 'Overview',
    SANDBOXES: 'Sandboxes',
    EXPLORE_SAVINGS: 'Explore savings',
    EXPLORE_SAVINGS_EBS: 'Explore savings EBS',
    EXPLORE_SAVINGS_FsxW: 'Explore savings FsxW',
    EXPLORE_SAVINGS_ONPREM: 'Explore savings OnPrem',
    EXPLORE_SAVINGS_ORACLE_ONPREM: 'Explore savings Oracle OnPrem',
    EXPLORE_SAVINGS_ORACLE_EBS: 'Explore savings Oracle EBS',
    SAVINGS_CALCULATOR: 'Savings Calculator',
    VIEW_THE_CALCULATIONS: 'View the calculations',
    JOB_MONITORING: 'Job monitoring',
    DATABASE_LIST: 'Database list',
    MANAGED_HOSTS: 'Managed hosts',
    UNMANAGED_HOSTS: 'Unmanaged hosts',
    UNDETECTED_HOSTS: 'Undetected hosts',
    REDIRECT_COMPONENT: 'Redirect Component',
    OPTIMIZE: 'Optimize',
    ORACLE_WELL_ARCHITECTED: 'Oracle Well Architected',
    MSSQL_ELASTIC_BLOCK_STORE: 'SQL Server on Elastic Block Store (EBS)',
    MSSQL_FSX_FOR_WINDOWS: 'SQL Server on FSx for Windows',
    MSSQL_ON_PREMISES: 'SQL Server On-Premises',
    ORACLE_ON_PREMISES: 'Oracle On-Premises',
    ORACLE_SERVER_ON_PREMISES: 'Oracle Server on-premises',
    ORACLE_SERVER_ON_ELASTIC_BLOCK_STORE: 'Oracle Server on Elastic Block Store (EBS)',
    REGISTER_RESOURCE: 'Register Resource',
    REGISTER_COMPONENT: 'Register Component',
    // This is added for the left nav to work
    OPTIMIZE_FROM_WELL_ARCHITECTED_TAB: 'Optimize from Well-architected tab',
    ORACLE_WELL_ARCHITECTED_FROM_WELL_ARCHITECTED_TAB: 'Oracle Well Architected from Well-architected tab'
};

export const DRIVE_LETTER_TYPE = {
    NEW: 'New drive letter',
    EXISTING: 'Existing drive letter'
};

export const AUTHENTICATION_TYPE = {
    SQL_SERVER_AUTHENTICATION: 'SQL Server authentication',
    WINDOWS_AUTHENTICATION: 'Windows authentication'
};

export const CREDENTIAL_OPTIONS = {
    SAME_FOR_ALL: 'same',
    MANUAL: 'manual'
};

export const PREPARE_PAGE_TABS = {
    PREREQUISITE_CHECK: 'Prerequisite check view',
    INSTANCE_READINESS: 'Instance readiness view'
};

export const FSX_FOR_ONTAP_CRED_OPTION = {
    USE_THE_SAME_CRED: 'Use the same credentials for all resources',
    MANAGE_CRED_MANUALLY: 'Manage credentials manually'
};

export const DEPLOY_ENDPOINT = '/cloudformation/deploy';
export const CREATE_DB_ENDPOINT = (databaseHostId: any) => `/database-hosts/${databaseHostId}/database`;
export const CREATE_SANDBOX_ENDPOINT = '/sandboxes';

export const CREATE_DB_CURL_REQ_TEMPLATE = (
    baseUrl: string,
    credentialId: string,
    region: string,
    databaseHostId: any,
    token: string,
    payload: any,
    isWorkloadFactory: boolean | any
) => {
    if (isWorkloadFactory) {
        return `
        curl --location --request POST '${baseUrl}/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${databaseHostId}/database' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --data-raw '${payload}'
        `;
    }
    return `
        curl --location --request POST '${baseUrl}/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${databaseHostId}/database' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --header 'x-netapp-referer: BlueXP' \\
        --data-raw '${payload}'
        `;
};

export const CREATE_SANDBOX_CURL_REQ_TEMPLATE = (
    baseUrl: string,
    credentialId: string,
    region: string,
    token: string,
    payload: any,
    isWorkloadFactory: boolean | any
) => {
    if (isWorkloadFactory) {
        return `
        curl --location --request POST '${baseUrl}/mssql/credentials/${credentialId}/regions/${region}/sandboxes' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --data-raw '${payload}'
        `;
    }
    return `
        curl --location --request POST '${baseUrl}/mssql/credentials/${credentialId}/regions/${region}/sandboxes' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --header 'x-netapp-referer: BlueXP' \\
        --data-raw '${payload}'
        `;
};
export const UPDATE_SANDBOX_CURL_REQ_TEMPLATE = (
    baseUrl: string,
    credentialId: string,
    region: string,
    databaseHostId: string,
    sandboxName: string,
    token: string,
    payload: any
) => `
curl --location --request PATCH '${baseUrl}/credentials/${credentialId}/regions/${region}/database-hosts/${databaseHostId}/sandboxes/${sandboxName}' \\
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
    ORACLE: 'ORACLE',
    WINDOWS: 'WINDOWS_USER',
    ORACLE_ASM: 'ORACLE_ASM',
    RUNNING: 'Running',
    DISABLE: 'disable',
    SHOW: 'show',
    HIDE: 'hide'
};

export const RESET_PASSWORD_TYPE = {
    FSXADMIN: 'fsxadmin',
    SQLSERVER: 'sqlserver',
    ORACLESERVER: 'oracleserver',
    ORACLEASM: 'oracleasm'
};

export const DB_VERSIONS = [
    { label: GENERAL.SQL_SERVER_2016, value: GENERAL.SQL_SERVER_2016_VERSION },
    { label: GENERAL.SQL_SERVER_2019, value: GENERAL.SQL_SERVER_2019_VERSION },
    { label: GENERAL.SQL_SERVER_2022, value: GENERAL.SQL_SERVER_2022_VERSION }
];

export const DB_VERSIONS_EXCLUDING_2016 = [
    { label: GENERAL.SQL_SERVER_2019, value: GENERAL.SQL_SERVER_2019_VERSION },
    { label: GENERAL.SQL_SERVER_2022, value: GENERAL.SQL_SERVER_2022_VERSION }
];

export const DB_VERSIONS_EXCLUDING_2022 = [
    { label: GENERAL.SQL_SERVER_2016, value: GENERAL.SQL_SERVER_2016_VERSION },
    { label: GENERAL.SQL_SERVER_2019, value: GENERAL.SQL_SERVER_2019_VERSION }
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

// Deployment form related check points for radio button. Dont't change as this values will be used to save config.
export const FORM_OPTIONS = {
    FSXN_NEW: 'fsxn_new',
    FSXN_EXISTING: 'fsxn_existing',
    LICENSE_AMI: 'License included AMI', // Already name is used in old saved config so keeping same
    CUSTOM_AMI: 'Use custom AMI'
};

export const SNAPSHOT_FREQUENCY = [
    {
        label: 'No snapshot storage',
        value: 'NoSnapShotStorage'
    },
    {
        label: 'Hourly',
        value: 'Hourly'
    },
    {
        label: 'Daily',
        value: 'Daily'
    },
    {
        label: 'Weekly',
        value: 'Weekly'
    },
    {
        label: 'Monthly',
        value: 'Monthly'
    },
    {
        label: '2 times per day',
        value: '2xDaily'
    },
    {
        label: '3 times per day',
        value: '3xDaily'
    },
    {
        label: '4 times per day',
        value: '4xDaily'
    },
    {
        label: '6 times per day',
        value: '6xDaily'
    }
];

export const OS_VERSIONS_LIST = [
    {
        label: GENERAL.WIN_SERVER_2016,
        value: GENERAL.WIN_SERVER_2016_VERSION
    },
    {
        label: GENERAL.WIN_SERVER_2019,
        value: GENERAL.WIN_SERVER_2019_VERSION
    },
    {
        label: GENERAL.WIN_SERVER_2022,
        value: GENERAL.WIN_SERVER_2022_VERSION
    }
];

export const SANDBOX_ACTIONS_POLLING_INTERVAL = 5000;

export const OPTIMIZE_POLLING_INTERVAL = 5000;

export const MAX_IOPS_VALUE = 160000;

export const MANAGE_POLLING_INTERVAL = 5000;

export const DETECT_PAYLOAD_SIZE = 10;

export const LOG_ANALYZER_POLLING_INTERVAL = 5000;

export const SC_JOB_INTERVAL = 5000;

export const MAX_CLONED_COPIES = 10;

export const MAX_MONTHLY_CHANGE_RATE = 100;

export const INVENTORY_STATUS = {
    MANAGED: 'Managed',
    UNMANAGED: 'Unmanaged',
    DETECTED: 'Detected',
    UNDETECTED: 'Undetected',
    IN_PROGRESS: 'In progress',
    ONLINE: 'Online',
    OFFLINE: 'Offline',
    UNKNOWN: 'Unknown',
    SSM_ONLINE: 'online',
    SSM_CONNECTED: 'connected',
    HOST_ONLINE: 'online',
    NOT_AVAILABLE: 'n/a',
    UP: 'up',
    DOWN: 'down',
    RUNNING: 'Running',
    STOPPED: 'Stopped',
    CASE_SENSITIVE_UP: 'Up',
    CASE_SENSITIVE_DOWN: 'Down',
    RUNNING_LOWER: 'running',
    REGISTERED: 'Registered',
    NOT_REGISTERED: 'Not registered'
};

export const ONLINE_INSTANCE_STATUSES = new Set([
    INVENTORY_STATUS.UP,
    INVENTORY_STATUS.RUNNING_LOWER,
    INVENTORY_STATUS.SSM_ONLINE
]);

export const SNAPCENTER_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
};

export const WELL_ARCHITECT_FINDINGS = {
    OPTIMIZED: 'Optimized',
    NOT_OPTIMIZED: 'Not optimized',
    OVER_PROVISIONED: 'Over-provisioned',
    INSUFFICIENT_DATA: 'n/a',
    UNDER_PROVISIONED: 'Under-provisioned',
    INSUFFICIENT_PERMISSIONS: 'n/a'
};

export const INVENTORY_ACTIONS = {
    MANAGE: 'Manage',
    EXPLORE_SAVINGS: 'Explore savings'
};

export const INSTANCE_API_FIELDS = {
    UNMANAGED_DEFAULT: [
        'databaseInstanceTopology',
        'usageEstimation',
        // 'storage',
        'databaseServer',
        'serverDetails',
        'nodeTopology'
    ],
    SUB_TABLE_FIELDS: ['protection', 'performance'],
    MIXED_STATUS_FIELDS: [
        'databaseInstanceTopology',
        // 'storage',
        'databaseServer',
        'serverDetails',
        'nodeTopology',
        'usageEstimation',
        'dbCount'
    ],
    UNMANAGED_PGSQL_DEFAULT: ['protection', 'performance', 'usageEstimation'],
    UNMANAGED_ORACLE_DEFAULT: ['protection', 'performance', 'usageEstimation']
};

export const PROTECTION_TEXT_STATUS = {
    YES: 'Yes',
    NO: 'No'
};

export const PREPARE_API_ENDPOINT = '/prepare';

export const FSX_AZ_TYPE = {
    SINGLE: 'single',
    MULTI: 'multi'
};

export const AVAILABILITY_ZONE_TYPE = {
    SINGLE_AZ: 'Single AZ',
    MULTI_AZ: 'Multi AZ'
};

export const SAVINGS_CALC_MODE = {
    MANUAL_EBS: 'Manual_EBS',
    AUTO_EBS: 'Auto_EBS',
    AUTO_FSXW: 'Auto_FSXW',
    MANUAL_FSXW: 'Manual_FSXW',
    ONPREM: 'OnPrem',
    ORACLE_ONPREM: 'Oracle_OnPrem',
    ORACLE_AUTO_EBS: 'Oracle_Auto_EBS',
    ORACLE_MANUAL_EBS: 'Oracle_Manual_EBS',
    EBS: 'ebs',
    FSXW: 'fsxw',
    ONPREM_MODE: 'onprem'
};

export const PARTNER_NODE = 'partner node';

export const FINDINGS = {
    OPTIMIZED: 'OPTIMIZED',
    NOT_OPTIMIZED: 'NOT_OPTIMIZED',
    NOT_OPTIMIZED_STATUS: 'NOT-OPTIMIZED',
    INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
    UNDER_PROVISIONED: 'UNDER_PROVISIONED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
    NOT_APPLICABLE: 'not-applicable',
    ANALYZING: 'ANALYZING'
};

export const TCO_MANUAL_DEPLOYMENT_TYPE = {
    SINGLE: 'Single availability zone',
    MULTI: 'Multi availability zone'
};

export const BXP_MESSAGES = {
    SERVICE_READY: 'SERVICE:READY',
    SERVICE_NAVIGATE: 'SERVICE:NAVIGATE',
    SERVICE_SHOW_WIZARD: 'SERVICE:OPEN-WIZARD',
    SERVICE_HIDE_WIZARD: 'SERVICE:CLOSE-WIZARD',
    SERVICE_CONNECTOR_CHANGE: 'SERVICE:CONNECTOR-CHANGE',
    SERVICE_LOCATION_CHANGE: 'SERVICE:LOCATION-CHANGE',
    SERVICE_ON_READY: 'SERVICE:ON-READY'
};

export const EBS_PROTECTED_OPTIONS = {
    PROTECTED: 'Protected',
    UNPROTECTED: 'Unprotected',
    UNKNOWN: 'Unknown'
};

export const GETWELL_STATUS = {
    OPTIMIZED: 'Optimized',
    WELL_ARCHITECTED: 'Well-architected',
    NOT_OPTIMIZED: 'Not optimized',
    UNDER_PROVISIONED: 'Under-provisioned',
    OVER_PROVISIONED: 'Over-provisioned',
    OPTIMIZING: 'Optimizing',
    FIXING: 'Fixing',
    NOT_APPLICABLE: GENERAL.UNAVAILABLE,
    ANALYZING: 'Analyzing',
    CRITICAL: 'Critical',
    WARNING: 'Warning',
    SHARED_DRIVE: 'Shared drive'
};

export const WELL_ARCHITECTED_TABS = {
    OVERVIEW: 'Overview',
    WELL_ARCHITECTED_STATUS: 'Well-architected status',
    PDB: 'PDB',
    DATABASES: 'Databases',
    SANDBOXES: 'Sandboxes',
    ERROR_INVESTIGATION: 'Error investigation'
};

export const GETWELL_VALUES: any = {
    optimized: 'Optimized',
    optimizing: 'Optimizing',
    'not-applicable': GENERAL.UNAVAILABLE,
    'not-optimized': 'Not optimized',
    analyzing: 'Analyzing',
    'under-provisioned': 'Under-provisioned',
    'over-provisioned': 'Over-provisioned',
    separate_drive: 'Separate drive',
    'separate-drive': 'Separate drive',
    'same-drive': 'Same drive',
    same_drive: 'Same drive',
    'shared-drive': 'Shared drive',
    shared_drive: 'Shared drive',
    critical: 'Critical',
    warning: 'Warning',
    none: 'None',
    'separate drive': 'Separate drive',
    'same drive': 'Same drive',
    'shared drive': 'Shared drive'
};

export const GETWELL_CONFIG: any = {
    efficiencies: 'Efficiencies',
    'thin-provision': 'Thin provisioning',
    autosize: 'Autosize',
    'autosize-mode': 'Autosize-mode',
    'fractional-reserve': 'Fractional reserve',
    'snapshot-copy-reserve': 'Snapshot copy reserve',
    'snapshot-autodelete': 'Snapshot autodelete',
    'space-mgmt-try-first': 'Space management',
    'tiering-policy': 'Tiering policy',
    'tiering-min-cooling-days': 'Tiering minimum cooling days',
    'os-type': 'OS type',
    'space-reservation-enabled': 'Space reservation',
    'space-allocation-allocated': 'Space allocation',
    'mpio-iscsi-count': 'Multipath I/O Sessions',
    'mpio-timeout': 'Multipath I/O Timeout',
    'mpio-enabled': 'Multipath I/O Status',
    'mpio-load-balance-policy': 'Multipath I/O Policy',
    'ntfs-allocation-size': 'NTFS allocation unit size',
    'ntfs-allocation-unit-size': 'NTFS allocation unit size',
    'snapshot-policy-vol': 'Snapshot policy',
    compression: 'Compression',
    deduplication: 'Deduplication',
    compaction: 'Compaction',
    'nfs-rootonly': 'NFS rootonly',
    'export-policy': 'Binaries export policy',
    'log-drive-size': 'transaction_log_drive_size',
    'performance-tier': 'storage_tier',
    'tempdb-drive-size': 'tempdb_drive_size',
    headroom: 'file_system_headroom',
    'tempdb-files-location': 'tempdb_files',
    'log-files-location': 'transaction_log_files',
    'data-files-location': 'user_data_files',
    'compute-rightsizing': 'compute_rightsizing',
    'rss-config': 'rss_config',
    'mtu-alignment': 'mtu',
    'sql-license': 'sql_licenses',
    'host-os-patch': 'host_os_patch',
    'mssql-patch': 'microsoft_sql_patch',
    maxdop: 'maxdop',
    'snapshot-policy': 'scheduled_local_snapshot',
    'backup-configuration': 'scheduled_fsx_for_ontap_backups',
    crr: 'crr',
    mssqlhighavailability: 'mssql_high_availability',
    mssqlhighavailabilityWithoutUnderscore: 'mssqlHighAvailability',
    'shared-storage': 'Shared storage',
    'drive-letter': 'Drive Letter',
    'heartbeat-settings': 'Heartbeat Settings',
    'cluster-quorum': 'Cluster Quorum',
    'sqlServer-service': 'SQL Server Service',
    clone: 'clone_management',
    'clone-management': 'clone_management',
    'redologs-placement': 'redologs_placement',
    'templogs-placement': 'templogs_placement',
    'archive-placement': 'archive_placement',
    'datafiles-placement': 'datafiles_placement',
    'controlfiles-placement': 'controlfiles_placement',
    'oracle-binary-placement': 'oracle_binary_placement',
    'data-dg-lun-layout': 'data_dg_lun_layout',
    'redolog-dg-lun-layout': 'log_dg_lun_layout',
    'fra-dg-lun-layout': 'fra_dg_lun_layout',
    'archivelog-dg-lun-layout': 'archivelog_dg_lun_layout',
    // Storage Config OS names - oracle
    'multipath-io': 'Multipath I/O',
    'host-utilities': 'Host utilities',
    'transparent-hugepages': 'Transparent hugepages',
    selinux: 'SELinux',
    'iscsi-replacement-timeout': 'ISCSI replacement timeout',
    'multipath-friendly-names': 'Multipath friendly names',
    'tcp-advanced-options': 'TCP advanced options',
    'filesystems-io-options': 'Filesystem I/O options',
    'multiblock-readcount': 'Multiblock read count',
    'multipath-io-sessions': 'Multipath I/O sessions',
    'multipath-configuration': 'Multipath config file',
    'kernel-parameters': 'TCP slot table',
    'nfs-mount-options-databasefiles': 'NFS mount options - database files',
    'nfs-mount-options-adrhome': 'NFS mount options - ADR home',
    'nfs-caching-options': 'NFS caching options',
    'nfsv4-domain-name': 'NFSv4 domain name',
    'asm-setup': 'ASM setup',
    'asm-external-redundancy': 'ASM external redundancy',
    'afd-logical-block-size': 'ASM filter driver logical block size alignment',
    'asmlib-logical-block-size': 'ASMLib logical block size alignment',
    'swap-space': 'swap_space',
    'dnfs-consistent-ip-resolution': 'dNFS consistent IP resolution',
    'dnfs-enabled': 'dNFS enablement',
    'dnfs-configuration-file': 'dNFS configuration file',
    'dnfs-no-shared-cache': 'dNFS no shared cache'
};

export const GW_TOOLTIP_KEYS_MAPPING: any = {
    rssProfile: 'RSS profile',
    rssStatus: 'RSS status',
    baseProcessorNumber: 'Base processor number',
    receiveQueues: 'Receive Queues',
    tcpOffloading: 'TCP Offloading Features'
};

export const NETWORK_PERFORMANCE_OPTIONS: any = {
    'Up to 10 Gbps': 'upTo10',
    'Above 10 Gbps': 'above10'
};

export const ERR_MSG_TO_CHECK = ['does not match schema definition.'];

export const ASSESSMENT_CONFIG_OTHER = {
    STORAGE: 'Storage',
    COMPUTE: 'Compute',
    APPLICATION: 'Application',
    RESILIENCY: 'Resiliency',
    CLONE: 'Clone'
};

export const ASSESSMENT_CONFIG_NAMES = {
    STORAGE_TIER: 'Storage tier',
    FILE_SYSTEM_HEADROOM: 'File system headroom',
    LOG_DRIVE_SIZE: 'Log drive size',
    TEMPDB_DRIVE_SIZE: 'TempDB drive size',
    DATA_FILES_MDF: 'Data files (.mdf) placement',
    LOG_FILES_LDF: 'Log files (.ldf) placement',
    TEMPDB_PLACEMENT: 'TempDB placement',
    COMPUTE_RIGHTSIZING: 'Compute rightsizing',
    MAXDOP: 'MAXDOP',
    SCHEDULED_LOCAL_SNAPSHOT: 'Scheduled local snapshot',
    OPERATING_SYSTEM_PATCH: 'Operating system patch',
    MICROSOFT_SQL_SERVER_PATCH: 'Microsoft SQL Server patch',
    CRR: 'Cross-Region Replication (CRR)',
    SNAPCENTER_SNAPSHOT: 'Application-consistent snapshots',
    ORACLE_SECURITY_PATCH: 'Oracle Critical Patch Updates',
    ONTAP: 'ontap',
    OS: 'os',
    HA: 'ha',
    RSS_CONFIGURATION: 'Network adapter settings',
    MTU: 'MTU alignment',
    SCHEDULED_FSX_FOR_ONTAP_BACKUPS: 'Backup Configuration',
    MSSQL_HIGH_AVAILABILITY: 'Microsoft SQL Server High Availability',
    CLONE_MANAGEMENT: 'Clone cleanup',
    LICENSE: 'License',
    SHARED_STORAGE: 'Shared storage',
    DRIVE_LETTER: 'Drive Letter',
    HEARTBEAT_SETTINGS: 'Heartbeat Settings',
    CLUSTER_QUORUM: 'Cluster Quorum',
    SQL_SERVER_SERVICE: 'SQL Server Service',
    REDO_LOGS_PLACEMENT: 'Redo logs placement',
    TEMP_LOGS_PLACEMENT: 'Temp placement',
    ARCHIVE_PLACEMENT: 'Archive placement',
    DATAFILES_PLACEMENT: 'Data files placement',
    CONTROLFILES_PLACEMENT: 'Control files placement',
    ORACLE_BINARY_PLACEMENT: 'Oracle binary placement',
    DATA_DG_LUN_LAYOUT: 'ASM data disk group LUNs',
    LOG_DG_LUN_LAYOUT: 'ASM logs disk group LUNs',
    FRA_DG_LUN_LAYOUT: 'ASM FRA disk group LUNs',
    ARCHIVELOG_DG_LUN_LAYOUT: 'ASM archive log disk group LUNs',
    COMPRESSION: 'Compression',
    DEDUPLICATION: 'Deduplication',
    COMPACTION: 'Compaction',
    NFS_ROOTONLY: 'NFS rootonly',
    EXPORT_POLICY: 'Binaries export policy',
    SNAPSHOT_POLICY: 'Snapshot policy',
    OPERATING_SYSTEM: 'Operating system',
    ONTAP_CAPS: 'ONTAP',
    MULTIPATH_IO: 'Multipath I/O',
    HOST_UTILITIES: 'Host utilities',
    TRANSPARENT_HUGEPAGES: 'Transparent hugepages',
    SELINUX: 'SELinux',
    ISCSI_REPLACEMENT_TIMEOUT: 'ISCSI replacement timeout',
    MULTIPATH_FRIENDLY_NAMES: 'Multipath friendly names',
    TCP_ADVANCED_OPTIONS: 'TCP advanced options',
    FILESYSTEMS_IO_OPTIONS: 'Filesystem I/O options',
    MULTIPATH_READCOUNT: 'Multiblock read count',
    MULTIPATH_IO_SESSIONS: 'Multipath I/O sessions',
    MULTIPATH_CONFIGURATION: 'Multipath config file',
    KERNEL_PARAMETERS: 'TCP slot table',
    NFS_MOUNT_OPTIONS_DATABASEFILES: 'NFS mount options - database files',
    NFS_MOUNT_OPTIONS_ADRHOME: 'NFS mount options - ADR home',
    NFS_CACHING_OPTIONS: 'NFS caching options',
    NFSV4_DOMAIN_NAME: 'NFSv4 domain name',
    ASM_SETUP: 'ASM setup',
    ASM_EXTERNAL_REDUNDANCY: 'ASM external redundancy',
    AFD_LOGICAL_BLOCK_SIZE: 'ASM filter driver logical block size alignment',
    ASMLIB_LOGICAL_BLOCK_SIZE: 'ASMLib logical block size alignment',
    DNFS_CONSISTENT_IP_RESOLUTION: 'dNFS consistent IP resolution',
    DNFS_CONFIGURATION_FILE: 'dNFS configuration file',
    DNFS_ENABLEMENT: 'dNFS enablement',
    DNFS_NO_SHARED_CACHE: 'dNFS no shared cache',
    SWAP_SPACE: 'Swap space',
    HIGH_AVAILABILITY: 'highAvailability',
    // Additional constants for wellArchitectedActionSummaryMessages
    THIN_PROVISIONING: 'Thin provisioning',
    AUTOSIZE: 'Autosize',
    AUTOSIZE_MODE: 'Autosize-mode',
    FRACTIONAL_RESERVE: 'Fractional reserve',
    SNAPSHOT_COPY_RESERVE: 'Snapshot copy reserve',
    SNAPSHOT_AUTODELETE: 'Snapshot autodelete',
    SPACE_MANAGEMENT: 'Space management',
    TIERING_POLICY: 'Tiering policy',
    TIERING_MINIMUM_COOLING_DAYS: 'Tiering minimum cooling days',
    OS_TYPE: 'OS type',
    SPACE_RESERVATION: 'Space reservation',
    SPACE_ALLOCATION: 'Space allocation',
    MULTIPATH_IO_STATUS: 'Multipath I/O Status',
    MULTIPATH_IO_POLICY: 'Multipath I/O Policy',
    MULTIPATH_IO_TIMEOUT: 'Multipath I/O Timeout',
    NTFS_ALLOCATION_UNIT_SIZE: 'NTFS allocation unit size',
    MICROSOFT_SQL_SERVER_PATCH_SHORT: 'Microsoft SQL Server patch'
};

// Configurations not supported for AOAG (Always On Availability Group) MSSQL deployments
// Uses ASSESSMENT_CONFIG_NAMES values (mapName) for comparison
export const AOAG_NOT_SUPPORTED_CONFIGS = [ASSESSMENT_CONFIG_NAMES.LICENSE];

// MSSQL config names that trigger the impacted drive dialog
export const MSSQL_IMPACTED_DRIVE_CONFIGS: string[] = [
    ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE,
    ASSESSMENT_CONFIG_NAMES.NTFS_ALLOCATION_UNIT_SIZE,
    ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_POLICY,
    ASSESSMENT_CONFIG_NAMES.OS_TYPE,
    ASSESSMENT_CONFIG_NAMES.SPACE_RESERVATION,
    ASSESSMENT_CONFIG_NAMES.SPACE_ALLOCATION,
    ASSESSMENT_CONFIG_NAMES.THIN_PROVISIONING,
    ASSESSMENT_CONFIG_NAMES.AUTOSIZE,
    ASSESSMENT_CONFIG_NAMES.AUTOSIZE_MODE,
    ASSESSMENT_CONFIG_NAMES.FRACTIONAL_RESERVE,
    ASSESSMENT_CONFIG_NAMES.SNAPSHOT_COPY_RESERVE,
    ASSESSMENT_CONFIG_NAMES.SNAPSHOT_AUTODELETE,
    ASSESSMENT_CONFIG_NAMES.SPACE_MANAGEMENT,
    ASSESSMENT_CONFIG_NAMES.TIERING_POLICY,
    ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS,
    ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER
];

// Oracle config names that trigger the impacted drive dialog
export const ORACLE_IMPACTED_DRIVE_CONFIGS: string[] = [
    ASSESSMENT_CONFIG_NAMES.DNFS_CONFIGURATION_FILE,
    ASSESSMENT_CONFIG_NAMES.DNFS_NO_SHARED_CACHE,
    ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES,
    ASSESSMENT_CONFIG_NAMES.THIN_PROVISIONING,
    ASSESSMENT_CONFIG_NAMES.AUTOSIZE,
    ASSESSMENT_CONFIG_NAMES.AUTOSIZE_MODE,
    ASSESSMENT_CONFIG_NAMES.FRACTIONAL_RESERVE,
    ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY,
    ASSESSMENT_CONFIG_NAMES.SNAPSHOT_COPY_RESERVE,
    ASSESSMENT_CONFIG_NAMES.SNAPSHOT_AUTODELETE,
    ASSESSMENT_CONFIG_NAMES.SPACE_MANAGEMENT,
    ASSESSMENT_CONFIG_NAMES.TIERING_POLICY,
    ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS,
    ASSESSMENT_CONFIG_NAMES.COMPRESSION,
    ASSESSMENT_CONFIG_NAMES.DEDUPLICATION,
    ASSESSMENT_CONFIG_NAMES.COMPACTION,
    ASSESSMENT_CONFIG_NAMES.NFS_ROOTONLY,
    ASSESSMENT_CONFIG_NAMES.EXPORT_POLICY,
    ASSESSMENT_CONFIG_NAMES.OS_TYPE,
    ASSESSMENT_CONFIG_NAMES.SPACE_RESERVATION,
    ASSESSMENT_CONFIG_NAMES.SPACE_ALLOCATION
];

// Oracle iSCSI-only compute card keys (cards that should only render when storage protocol is iSCSI)
export const ORACLE_ISCSI_ONLY_CARD_KEYS = [
    'transparent_hugepages',
    'tcp_advanced_options',
    'filesystems_io_options',
    'multiblock_readcount'
] as const;

// Hyphen-format card IDs for iSCSI-only Oracle compute cards (used when comparing cardItem.id)
export const ORACLE_ISCSI_ONLY_CARD_IDS = new Set([
    'transparent-hugepages',
    'tcp-advanced-options',
    'filesystems-io-options',
    'multiblock-readcount'
]);

// API-level camelCase keys for iSCSI-only Oracle compute configs (used when comparing configKey)
export const ORACLE_ISCSI_ONLY_API_KEYS = new Set([
    'oracleTransparentHugepages',
    'oracleTcpAdvancedOptions',
    'oracleFilesystemsIoOptions',
    'oracleMultipathReadcount'
]);

// Configuration names mapping for unified display names for the export pdf
export const CONFIG_NAMES = {
    // Oracle Storage sizing configurations
    'swap-space': ASSESSMENT_CONFIG_NAMES.SWAP_SPACE,
    file_system_headroom: ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,

    // Oracle Storage layout configurations
    'archive-placement': ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT,
    'datafiles-placement': ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT,
    'controlfiles-placement': ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT,
    'redologs-placement': ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT,
    'templogs-placement': ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT,
    'oracle-binary-placement': ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT,
    'data-dg-lun-layout': ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT,
    'log-dg-lun-layout': ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT,
    'fra-dg-lun-layout': ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT,
    'archivelog-dg-lun-layout': ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT,

    // Storage configuration - ONTAP
    compression: ASSESSMENT_CONFIG_NAMES.COMPRESSION,
    deduplication: ASSESSMENT_CONFIG_NAMES.DEDUPLICATION,
    compaction: ASSESSMENT_CONFIG_NAMES.COMPACTION,
    'thin-provision': ASSESSMENT_CONFIG_NAMES.THIN_PROVISIONING,
    autosize: ASSESSMENT_CONFIG_NAMES.AUTOSIZE,
    'autosize-mode': ASSESSMENT_CONFIG_NAMES.AUTOSIZE_MODE,
    'fractional-reserve': ASSESSMENT_CONFIG_NAMES.FRACTIONAL_RESERVE,
    'snapshot-copy-reserve': ASSESSMENT_CONFIG_NAMES.SNAPSHOT_COPY_RESERVE,
    'snapshot-autodelete': ASSESSMENT_CONFIG_NAMES.SNAPSHOT_AUTODELETE,
    'space-mgmt-try-first': ASSESSMENT_CONFIG_NAMES.SPACE_MANAGEMENT,
    'tiering-policy': ASSESSMENT_CONFIG_NAMES.TIERING_POLICY,
    'tiering-min-cooling-days': ASSESSMENT_CONFIG_NAMES.TIERING_MINIMUM_COOLING_DAYS,
    'os-type': ASSESSMENT_CONFIG_NAMES.OS_TYPE,
    'space-reservation-enabled': ASSESSMENT_CONFIG_NAMES.SPACE_RESERVATION,
    'space-allocation-allocated': ASSESSMENT_CONFIG_NAMES.SPACE_ALLOCATION,
    'nfs-rootonly': ASSESSMENT_CONFIG_NAMES.NFS_ROOTONLY,
    'export-policy': ASSESSMENT_CONFIG_NAMES.EXPORT_POLICY,
    'snapshot-policy-vol': ASSESSMENT_CONFIG_NAMES.SNAPSHOT_POLICY,

    // Storage configuration - OS (Oracle)
    'multipath-io': ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO,
    'host-utilities': ASSESSMENT_CONFIG_NAMES.HOST_UTILITIES,
    selinux: ASSESSMENT_CONFIG_NAMES.SELINUX,
    'iscsi-replacement-timeout': ASSESSMENT_CONFIG_NAMES.ISCSI_REPLACEMENT_TIMEOUT,
    'multipath-friendly-names': ASSESSMENT_CONFIG_NAMES.MULTIPATH_FRIENDLY_NAMES,
    'multipath-io-sessions': ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS,
    'multipath-configuration': ASSESSMENT_CONFIG_NAMES.MULTIPATH_CONFIGURATION,
    'kernel-parameters': ASSESSMENT_CONFIG_NAMES.KERNEL_PARAMETERS,
    'nfs-mount-options-databasefiles': ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES,
    'nfs-mount-options-adrhome': ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME,
    'nfs-caching-options': ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS,
    'nfsv4-domain-name': ASSESSMENT_CONFIG_NAMES.NFSV4_DOMAIN_NAME,
    'asm-setup': ASSESSMENT_CONFIG_NAMES.ASM_SETUP,
    'asm-external-redundancy': ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY,
    'afd-logical-block-size': ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE,
    'asmlib-logical-block-size': ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE,
    'dnfs-consistent-ip-resolution': ASSESSMENT_CONFIG_NAMES.DNFS_CONSISTENT_IP_RESOLUTION,
    'dnfs-enabled': ASSESSMENT_CONFIG_NAMES.DNFS_ENABLEMENT,
    'dnfs-configuration-file': ASSESSMENT_CONFIG_NAMES.DNFS_CONFIGURATION_FILE,
    'dnfs-no-shared-cache': ASSESSMENT_CONFIG_NAMES.DNFS_NO_SHARED_CACHE,

    // Special configurations
    ontap_configuration: ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS,
    os_configuration: ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM,

    // MSSQL Storage sizing configurations
    storage_tier: ASSESSMENT_CONFIG_NAMES.STORAGE_TIER,
    transaction_log_drive_size: ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE,
    tempdb_drive_size: ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE,
    headroom: ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,

    // MSSQL Storage layout configurations
    user_data_files: ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF,
    transaction_log_files: ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF,
    tempdb_files: ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,

    // Compute configurations
    compute_rightsizing: ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING,
    host_os_patch: ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
    transparent_hugepages: ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES,
    tcp_advanced_options: ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS,
    filesystems_io_options: ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS,
    multiblock_readcount: ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT,
    rss_config: ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION,
    mtu: ASSESSMENT_CONFIG_NAMES.MTU,

    // Application configurations
    sql_licenses: ASSESSMENT_CONFIG_NAMES.LICENSE,
    microsoft_sql_patch: ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
    maxdop: ASSESSMENT_CONFIG_NAMES.MAXDOP,
    oracle_security_patch: ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH,

    // Resiliency configurations
    scheduled_local_snapshot: ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
    crr: ASSESSMENT_CONFIG_NAMES.CRR,
    snapcenter_snapshot: ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT,
    'snapcenter-snapshot': ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT,
    scheduled_fsx_for_ontap_backups: ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
    mssql_high_availability: ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY,

    // Cloning configurations
    clone_management: ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
    'clone-management': ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,

    // MSSQL High Availability configurations
    'shared-storage': ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE,
    'drive-letter': ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER,
    'heartbeat-settings': ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS,
    'cluster-quorum': ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM,
    'sqlServer-service': ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE,

    // Storage configuration - LUNs (MSSQL)
    'mpio-iscsi-count': ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_SESSIONS,
    'mpio-timeout': ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_TIMEOUT,
    'mpio-enabled': ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_STATUS,
    'mpio-load-balance-policy': ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO_POLICY,
    'ntfs-allocation-size': ASSESSMENT_CONFIG_NAMES.NTFS_ALLOCATION_UNIT_SIZE,
    'ntfs-allocation-unit-size': ASSESSMENT_CONFIG_NAMES.NTFS_ALLOCATION_UNIT_SIZE,
    'log-drive-size': ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE,
    'performance-tier': ASSESSMENT_CONFIG_NAMES.STORAGE_TIER,
    'tempdb-drive-size': ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE,
    'data-files-location': ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF,
    'log-files-location': ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF,
    'tempdb-files-location': ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT,
    'compute-rightsizing': GENERAL.COMPUTE_RIGHTSIZING,
    'rss-config': GENERAL.RSS_CONFIGURATION,
    'snapshot-policy': ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
    'backup-configuration': ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
    'mssql-patch': ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
    'host-os-patch': ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
    'transparent-hugepages': ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES,
    'tcp-advanced-options': ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS,
    'filesystems-io-options': ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS,
    'multiblock-readcount': ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT,
    'oracle-security-patch': ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH,
    'sql-license': ASSESSMENT_CONFIG_NAMES.LICENSE,
    'mtu-alignment': ASSESSMENT_CONFIG_NAMES.MTU
};

export const GW_CONFIG_OPTIMIZE_NA = [
    GENERAL.LICENSE_SQL_SERVER,
    ASSESSMENT_CONFIG_NAMES.NFSV4_DOMAIN_NAME,
    ASSESSMENT_CONFIG_NAMES.DNFS_CONSISTENT_IP_RESOLUTION
];

/**
 * Set of MSSQL configuration names that cannot be automatically fixed.
 * These configs will show a Close button only (no Continue/Cancel) with a warning banner.
 */
export const MSSQL_UNSUPPORTED_FIX_TYPES = new Set([
    ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
    ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
    ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER,
    ASSESSMENT_CONFIG_NAMES.OS_TYPE,
    ASSESSMENT_CONFIG_NAMES.NTFS_ALLOCATION_UNIT_SIZE
]);

/**
 * Set of Oracle configuration names that cannot be automatically fixed.
 * These configs will show a Close button only (no Continue/Cancel) with a warning banner.
 */
export const ORACLE_UNSUPPORTED_FIX_TYPES = new Set([
    ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
    ASSESSMENT_CONFIG_NAMES.SWAP_SPACE,
    ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH,
    ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT,
    ASSESSMENT_CONFIG_NAMES.MULTIPATH_IO,
    ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS,
    ASSESSMENT_CONFIG_NAMES.ASM_SETUP,
    ASSESSMENT_CONFIG_NAMES.ASM_EXTERNAL_REDUNDANCY,
    ASSESSMENT_CONFIG_NAMES.AFD_LOGICAL_BLOCK_SIZE,
    ASSESSMENT_CONFIG_NAMES.ASMLIB_LOGICAL_BLOCK_SIZE,
    ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_DATABASEFILES,
    ASSESSMENT_CONFIG_NAMES.NFS_MOUNT_OPTIONS_ADRHOME,
    ASSESSMENT_CONFIG_NAMES.NFS_CACHING_OPTIONS,
    ASSESSMENT_CONFIG_NAMES.DNFS_ENABLEMENT,
    ASSESSMENT_CONFIG_NAMES.DNFS_CONFIGURATION_FILE,
    ASSESSMENT_CONFIG_NAMES.DNFS_NO_SHARED_CACHE,
    ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT
]);

/**
 * Oracle compute config types that are only applicable for iSCSI storage protocol instances.
 * Used to filter out these cards for non-iSCSI instances.
 */
export const ORACLE_ISCSI_ONLY_CONFIG_TYPES = new Set([
    ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES,
    ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS,
    ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS,
    ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT
]);

/**
 * Config types that always show the unsupported-fix banner when status is OVER_PROVISIONED.
 */
export const OVER_PROVISIONED_UNSUPPORTED_FIX_TYPES = new Set([ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]);

/**
 * Config types that show the unsupported-fix banner when status is UNDER_PROVISIONED
 * and the user is missing required permissions.
 */
export const UNDER_PROVISIONED_UNSUPPORTED_FIX_TYPES = new Set([
    ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM,
    ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE,
    ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE
]);

/**
 * Sort-weight discriminator key for WAD (offline assessment) rows.
 * Used in sortDatabaseTableData to give WAD rows a stable weight between OFFLINE and UNKNOWN,
 * without relying on the absence of a status field.
 */
export const WAD_SORT_STATUS = 'WAD';

/**
 * List of MSSQL configuration names that are excluded for WAD (offline assessment) instances.
 * These configurations require online connectivity and are not available for WAD instances.
 * If a config is removed from this list, it will be shown normally for isWad=true cases.
 */
export const WAD_EXCLUDED_CONFIGS_MSSQL = [
    ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING,
    ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
    ASSESSMENT_CONFIG_NAMES.MTU,
    ASSESSMENT_CONFIG_NAMES.LICENSE,
    ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
    ASSESSMENT_CONFIG_NAMES.CRR,
    ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS
];

/**
 * List of Oracle configuration names that are excluded for WAD (offline assessment) instances.
 * These configurations require online connectivity and are not available for WAD instances.
 * If a config is removed from this list, it will be shown normally for isWad=true cases.
 */
export const WAD_EXCLUDED_CONFIGS_ORACLE = [
    ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
    ASSESSMENT_CONFIG_NAMES.CRR,
    ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
    ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH
];

/**
 * Mapping of internal config keys to ASSESSMENT_CONFIG_NAMES display names.
 * Used for generic WAD exclusion checks based on config key.
 */
export const CONFIG_KEY_TO_DISPLAY_NAME: Record<string, string> = {
    // MSSQL config keys
    computeRightsizing: ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING,
    operatingSystemPatch: ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
    mtuConfiguration: ASSESSMENT_CONFIG_NAMES.MTU,
    applicationSqlServer: ASSESSMENT_CONFIG_NAMES.LICENSE,
    mssqlPatch: ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH,
    scheduledLocalSnapshot: ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT,
    crr: ASSESSMENT_CONFIG_NAMES.CRR,
    scheduledawsBackup: ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
    clone: ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT,
    // Oracle config keys
    oracleOperatingSystemPatch: ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH,
    oracleCrr: ASSESSMENT_CONFIG_NAMES.CRR,
    oracleSnapcenterSnapshot: ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT,
    oracleAwsBackup: ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS,
    oracleSecurityPatch: ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH
};

/**
 * Checks if a config key is WAD-excluded for the given database type.
 * @param configKey - Internal config key (e.g., 'computeRightsizing', 'oracleCrr')
 * @param dbType - Database type (DBType.MSSQL or DBType.ORACLE)
 * @returns true if the config is WAD-excluded
 */
export const isConfigKeyWadExcluded = (configKey: string, dbType?: string): boolean => {
    const displayName = CONFIG_KEY_TO_DISPLAY_NAME[configKey];
    if (!displayName) return false;

    if (dbType === DBType.ORACLE) {
        return WAD_EXCLUDED_CONFIGS_ORACLE.includes(displayName);
    }
    return WAD_EXCLUDED_CONFIGS_MSSQL.includes(displayName);
};

/**
 * WAD-excluded API assessment field names, keyed by the raw field names in assessment data.
 * Keep in sync with WAD_EXCLUDED_CONFIGS_MSSQL / WAD_EXCLUDED_CONFIGS_ORACLE above.
 */
export const WAD_EXCLUDED_API_FIELDS_MSSQL = new Set([
    'compute',
    'hostOsPatch',
    'mtuAlignment',
    'license',
    'mssqlPatch',
    'crr',
    'awsBackup'
]);

export const WAD_EXCLUDED_API_FIELDS_ORACLE = new Set(['hostOsPatch', 'crr', 'oracleSecurityPatch', 'awsBackup']);

/**
 * Maps API assessment field names to their Well-Architected category.
 * Used for counting configurations by category in dashboard summaries.
 */
export type WellArchitectedCategory = 'storage' | 'compute' | 'application' | 'resiliency' | 'cloning';

export const MSSQL_API_FIELD_TO_CATEGORY: Record<string, WellArchitectedCategory> = {
    compute: 'compute',
    hostOsPatch: 'compute',
    mtuAlignment: 'compute',
    rssConfig: 'compute',
    license: 'application',
    mssqlPatch: 'application',
    maxDOP: 'application',
    clone: 'cloning',
    snapshotPolicy: 'resiliency',
    crr: 'resiliency',
    awsBackup: 'resiliency',
    highAvailability: 'resiliency'
};

export const ORACLE_API_FIELD_TO_CATEGORY: Record<string, WellArchitectedCategory> = {
    hostOsPatch: 'compute',
    transparentHugepages: 'compute',
    tcpAdvancedOptions: 'compute',
    filesystemsIoOptions: 'compute',
    multiblockReadcount: 'compute',
    oracleSecurityPatch: 'application',
    crr: 'resiliency',
    snapcenterSnapshot: 'resiliency',
    awsBackup: 'resiliency',
    clone: 'cloning'
};

export const categoryOptions = ['Storage', 'Compute', 'Application', 'Resiliency', 'Cloning'];
export const severityOptions = ['Critical', 'Warning'];

export const oracleCategoryOptions = ['Storage', 'Compute', 'Application', 'Resiliency', 'Cloning'];

export const oracleSeverityOptions = ['Critical', 'Warning'];

export const CONFIG_STATES = {
    ACTIVE: 'ACTIVE',
    POSTPONED: 'POSTPONED',
    DISMISSED: 'DISMISSED',
    ACTIVATING: 'ACTIVATING',
    PARTIAL: 'PARTIAL'
};

export const CONFIG_STATES_UI = {
    ACTIVE: 'Active',
    POSTPONED: 'Postponed',
    DISMISSED: 'Dismissed',
    ACTIVATING: 'Activating'
};

export const CONFIG_STATE_ACTIONS = {
    ACTIVE: 'ACTIVE',
    DISMISS: 'DISMISSED',
    POSTPONED: 'POSTPONED'
};

export const CONFIG_NAME_TO_ID_MAPPING = {
    HA_MSSQL: {
        [ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE]: 'shared-storage',
        [ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM]: 'cluster-quorum',
        [ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS]: 'heartbeat-settings',
        [ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE]: 'sqlServer-service',
        [ASSESSMENT_CONFIG_NAMES.DRIVE_LETTER]: 'drive-letter'
    },
    STORAGE_SIZING_MAP: {
        [ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]: 'log-drive-size',
        [ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]: 'performance-tier',
        [ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]: 'headroom',
        [ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]: 'tempdb-drive-size',
        [ASSESSMENT_CONFIG_NAMES.SWAP_SPACE]: 'swap-space'
    },
    STORAGE_CONFIG_MAP: {
        'os-type': 'luns',
        'space-reservation-enabled': 'luns',
        'space-allocation-allocated': 'luns',
        'mpio-enabled': 'os',
        'mpio-iscsi-count': 'os',
        'mpio-timeout': 'os',
        'ntfs-allocation-unit-size': 'os',
        'mpio-load-balance-policy': 'os',
        'thin-provision': 'volumes',
        autosize: 'volumes',
        'autosize-mode': 'volumes',
        'fractional-reserve': 'volumes',
        'snapshot-copy-reserve': 'volumes',
        'snapshot-autodelete': 'volumes',
        'space-mgmt-try-first': 'volumes',
        'tiering-policy': 'volumes',
        'tiering-min-cooling-days': 'volumes',
        // Oracle specific configurations
        compression: 'volumes',
        deduplication: 'volumes',
        compaction: 'volumes',
        'snapshot-policy': 'volumes',
        'nfs-rootonly': 'volumes',
        'export-policy': 'volumes',
        'kernel-parameters': 'os',
        'nfs-mount-options-databasefiles': 'os',
        'nfs-mount-options-adrhome': 'os',
        'nfs-caching-options': 'os',
        'nfsv4-domain-name': 'os',
        // Oracle OS configurations
        'multipath-io': 'os',
        'host-utilities': 'os',
        selinux: 'os',
        'iscsi-replacement-timeout': 'os',
        'multipath-friendly-names': 'os',
        'multipath-io-sessions': 'os',
        'multipath-configuration': 'os',
        // Oracle placement configurations
        'redologs-placement': 'os',
        'templogs-placement': 'os',
        'archive-placement': 'os',
        'datafiles-placement': 'os',
        'controlfiles-placement': 'os',
        'oracle-binary-placement': 'os',
        'data-dg-lun-layout': 'os',
        'redolog-dg-lun-layout': 'os',
        'fra-dg-lun-layout': 'os',
        'archivelog-dg-lun-layout': 'os',
        // ASM specific configurations
        'asm-setup': 'os',
        'asm-external-redundancy': 'os',
        'afd-logical-block-size': 'os',
        'asmlib-logical-block-size': 'os',
        // dnfs specific configurations
        'dnfs-consistent-ip-resolution': 'os',
        'dnfs-enabled': 'os',
        'dnfs-configuration-file': 'os',
        'dnfs-no-shared-cache': 'os'
    },
    STORAGE_LAYOUT_MAP: {
        [ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF]: 'data-files-location',
        [ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF]: 'log-files-location',
        [ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT]: 'tempdb-files-location',
        [ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT]: 'data-dg-lun-layout',
        [ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT]: 'redolog-dg-lun-layout',
        [ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT]: 'fra-dg-lun-layout',
        [ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT]: 'archivelog-dg-lun-layout'
    },
    NON_STORAGE_CONFIG_MAP: {
        [ASSESSMENT_CONFIG_NAMES.COMPUTE_RIGHTSIZING]: 'compute',
        [ASSESSMENT_CONFIG_NAMES.MAXDOP]: 'maxDOP',
        [ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]: 'clone',
        [ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION]: 'rssConfig',
        [ASSESSMENT_CONFIG_NAMES.MTU]: 'mtuAlignment',
        [ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]: 'snapshotPolicy',
        [ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS]: 'awsBackup',
        [ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH]: 'mssqlPatch',
        [ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH]: 'hostOsPatch',
        [ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES]: 'transparentHugepages',
        [ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS]: 'tcpAdvancedOptions',
        [ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS]: 'filesystemsIoOptions',
        [ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT]: 'multiblockReadcount',
        [ASSESSMENT_CONFIG_NAMES.CRR]: 'crr',
        [ASSESSMENT_CONFIG_NAMES.SNAPCENTER_SNAPSHOT]: 'snapcenterSnapshot',
        [ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH]: 'oracleSecurityPatch',
        [ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY]: 'mssqlHighAvailability',
        [ASSESSMENT_CONFIG_NAMES.LICENSE]: 'license'
    },
    ORACLE_STORAGE_LAYOUT_MAP: {
        [ASSESSMENT_CONFIG_NAMES.ORACLE_BINARY_PLACEMENT]: 'oracle-binary-placement',
        [ASSESSMENT_CONFIG_NAMES.DATAFILES_PLACEMENT]: 'datafiles-placement',
        [ASSESSMENT_CONFIG_NAMES.CONTROLFILES_PLACEMENT]: 'controlfiles-placement',
        [ASSESSMENT_CONFIG_NAMES.REDO_LOGS_PLACEMENT]: 'redologs-placement',
        [ASSESSMENT_CONFIG_NAMES.TEMP_LOGS_PLACEMENT]: 'templogs-placement',
        [ASSESSMENT_CONFIG_NAMES.ARCHIVE_PLACEMENT]: 'archive-placement',
        [ASSESSMENT_CONFIG_NAMES.DATA_DG_LUN_LAYOUT]: 'data-dg-lun-layout',
        [ASSESSMENT_CONFIG_NAMES.LOG_DG_LUN_LAYOUT]: 'redolog-dg-lun-layout',
        [ASSESSMENT_CONFIG_NAMES.FRA_DG_LUN_LAYOUT]: 'fra-dg-lun-layout',
        [ASSESSMENT_CONFIG_NAMES.ARCHIVELOG_DG_LUN_LAYOUT]: 'archivelog-dg-lun-layout'
    }
};

export const MANAGE_STATES = {
    READY: 'Ready',
    NOT_READY: 'Not ready',
    MISSING_POWERSHELL: 'Missing PowerShell modules',
    MISSING_JQ: 'Missing JQ modules',
    MISSING_PYTHON: 'Missing Python modules',
    MISSING_PREREQUISITES: 'Missing prerequisites',
    POWERSHELL7: 'Powershell 7',
    JQ: 'jq',
    PYTHON: 'python'
};

export const ACTION_CTA = {
    FIX_ISSUES: 'View and fix',
    WELL_ARCHITECTED: 'Well-architected',
    MANAGE_INSTANCES: 'Register instance',
    REGISTER_DATABASE: 'Register database'
};

export const RESPONSE_STATUS = {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED'
};

// Add any type of action in the below object
export const ACTION_TYPE = {
    BULK: 'bulk',
    SINGLE: 'single'
};

export const MS_PER_HOUR = 60 * 60 * 1000;

export const REQUIRED_SQL_PERMISSIONS = ['VIEW ANY DEFINITION', 'VIEW SERVER STATE', 'CONNECT SQL'];

export const READINESS_TYPES = ['assessment', 'dbcreation', 'sandbox', 'remediation'];

// RBAC Roles for Add host
export const RBAC_STAGE_ROLE_ID = '381a2b6e-693b-4829-95a5-fbd753db30c7';
export const RBAC_PROD_ROLE_ID = '518a7bb4-6f1f-4516-9ab1-ec5e040b051e';

export const PROTECTION_COLUMN_TEXT_STATUS = {
    PROTECTED: 'Protected',
    NOT_PROTECTED: 'Not protected',
    UNKNOWN: 'Unknown'
};

export const INVENTORY_TABLE_STATUS = {
    NOT_ANALYZED: 'Not analyzed'
};

export const INVENTORY_TAB_COMPONENTS = {
    INSTANCES: 'Instances',
    DATABASES: 'Databases',
    PDB: 'PDB'
};

export const ERROR_ANALYZER_STATUS = {
    ACTIVE: 'Active',
    NOT_ACTIVE: 'Not active',
    RUNNING: 'Running'
};

export const REGISTER_INSTANCE_STATE = {
    NOT_AVAILABLE: 'n/a',
    MSSQL: 'SQL Server instance',
    ORACLE: 'Oracle database'
};

export const ORACLE_DATABASES_COMPONENTS = {
    CDB: 'CDB',
    PDB: 'PDB',
    MULTI_TENANT: 'Multi Tenant',
    SINGLE_TENANT: 'Single Tenant',
    MULTI_TENANT_API_RESPONSE: 'MULTI_TENANT',
    SINGLE_TENANT_API_RESPONSE: 'SINGLE_TENANT',
    SINGLE_TENANT_DATABASE_API_RESPONSE: 'Single tenant'
};

export const INVENTORY_BANNER_FILTER_OPTIONS = {
    NOT_REGISTERED_INSTANCES: 'Not registered instances',
    NOT_ACTIVE_INSTANCES: 'Not active instances',
    NOT_OPTIMIZED_INSTANCE_SQL: 'Not-optimized instances sql',
    NOT_REGISTERED_DATABASES: 'Not registered databases',
    NOT_OPTIMIZED_DATABASES: 'Not-optimized databases',
    NOT_ACTIVE_DATABASES: 'Not active databases'
};

export const TCO_CALCULATOR_MODE = {
    OPTIMIZED: 'optimized',
    STANDARD: 'standard'
};

// Demo mode protection criteria for instances and databases
// WARNING: These conditions depend on specific mock data from backend
// If mock data changes, these conditions must be updated accordingly
export const DEMO_MODE_PROTECTION_CRITERIA = {
    instances: [
        {
            hostName: 'sql-managed-host-prod',
            instanceNames: ['prod-marketingcampaigns', 'prod-productcatalog']
        },
        {
            hostName: 'sql-managed-host-dev',
            instanceNames: ['dev-salesanalytics', 'mssqlserver']
        }
    ],
    databases: [
        {
            hostName: 'sql-managed-host-prod',
            databaseNames: ['mfgsales', 'hraudit', 'salesdata', 'timesheet']
        }
    ]
};

export const ENGINE_TYPES = {
    MSSQL: 'SQL Server',
    ORACLE: 'Oracle',
    POSTGRESQL: 'PostgreSQL'
};

// Dialog "type" prop values used by the well-architected patch dialogs
export const PATCH_DIALOG_TYPE = {
    MSSQL_PATCH: 'mssqlPatch',
    OS_PATCH: 'osPatch'
} as const;

// `field` query-string values sent to the /assessment/patch-scan endpoint
export const PATCH_SCAN_FIELD = {
    MSSQL_PATCH: 'mssql-patch',
    HOST_OS_PATCH: 'host-os-patch',
    ORACLE_SECURITY_PATCH: 'oracle-security-patch'
} as const;

export const SSM_ARN_REGEX = /^arn:aws(-us-gov)?:ssm:[^:]+:\d{12}:parameter\/netapp\/wlmdb\/.+$/;
export const isValidSsmArn = (arn: string) => SSM_ARN_REGEX.test(arn);

export const WA_FLAG_SKIP = [
    'isASMManaged',
    'deploymentType',
    'isStorageLayoutFra',
    'storageProtocol',
    'isWad',
    'baseDeploymentType'
];
