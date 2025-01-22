import { GENERAL } from './appConstants';

export const AUTH_STATUS = {
    AUTH_STATUS_SUCCESS: 'AUTH_SUCCESS',
    AUTH_STATUS_ERROR: 'AUTH_ERROR',
    AUTH_STATUS_PROGRESS: 'AUTH_PROGRESS'
};

export const WIZARD_TYPE = {
    PGSQL: 'pgsql',
    MSSQL: 'mssql'
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
export const CREDENTIAL_STAGE_LINK = 'https://staging.console.bluexp.netapp.com/credentials/wlf';
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
export const API_MAX_RETRIES = 3;
export const MIN_RETRY_DELAY = 5000;

//License URL
export const LICENSE_URL =
    'https://docs.aws.amazon.com/launchwizard/latest/userguide/launch-wizard-setting-up.html#launch-wizard-custom-ami';

//AWS resize URL
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
    LOAD_CONFIG: 'load_config',
    SAVE_CONFIG: 'save_config',
    HEADER_CROSS: 'header_cross',
    DETECT_HOST: 'detect_host',
    SANDBOX_REFRESH: 'sandbox_refresh'
};

export const DBType = {
    POSTGRESQL: 'PostgreSQL',
    MSSQL: 'Microsoft SQL Server'
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
    AOAG: 'aoag'
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
    UNKNOWN: 'Unknown'
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
    OPTIMIZE: 'OPTIMIZATION'
};

export const FSXN_STORAGE_PROTOCOLS = {
    ISCSI: 'iSCSI',
    SMB: 'SMB'
};

export const MAX_SAVED_CONFIG = 100;

export const WLF_TO_FORM_NAVIGATE = '../mssql-deploy-wizard';

export const FORM_TO_WLF_NAVIGATE = '../databases';
export const FORM_TO_WLF_NAVIGATE_BLUEXP = '../fsxdb';

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
    } else {
        return `
        curl --location --request POST '${baseUrl}/mssql/credentials/${credentialId}/regions/${region}/cloudformation/deploy' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --header 'x-netapp-referer: BlueXP' \\
        --data-raw '${payload}'
        `;
    }
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
    } else {
        return `
        curl --location --request POST '${baseUrl}/pgsql/credentials/${credentialId}/regions/${region}/cloudformation/deploy' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --header 'x-netapp-referer: BlueXP' \\
        --data-raw '${payload}'
        `;
    }
};

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
    DBP_CODEBOX_CF: 'dbp-codebox-cf',
    WIZARD_CODEBOX_TF: 'wizard-codebox-tf',
    DBP_CODEBOX_TF: 'dbp-codebox-tf'
};

export const WLF_TABS = {
    DASHBOARD: 'Dashboard',
    DASHBOARD_INNER_PAGE: 'DashboardInnerPage',
    INVENTORY: 'Inventory',
    OVERVIEW: 'Overview',
    SANDBOXES: 'Sandboxes',
    EXPLORE_SAVINGS: 'Explore savings',
    EXPLORE_SAVINGS_EBS: 'Explore savings EBS',
    EXPLORE_SAVINGS_FsxW: 'Explore savings FsxW',
    EXPLORE_SAVINGS_ONPREM: 'Explore savings OnPrem',
    SAVINGS_CALCULATOR: 'Savings Calculator',
    VIEW_THE_CALCULATIONS: 'View the calculations',
    JOB_MONITORING: 'Job monitoring',
    DATABASE_LIST: 'Database list',
    MANAGED_HOSTS: 'Managed hosts',
    UNMANAGED_HOSTS: 'Unmanaged hosts',
    UNDETECTED_HOSTS: 'Undetected hosts',
    REDIRECT_COMPONENT: 'Redirect Component',
    OPTIMIZE: 'Optimize',
    MSSQL_ELASTIC_BLOCK_STORE: 'SQL Server on Elastic Block Store (EBS)',
    MSSQL_FSX_FOR_WINDOWS: 'SQL Server on FSx for Windows',
    MSSQL_ON_PREMISES: 'SQL Server On-Premises'
};

export const DRIVE_LETTER_TYPE = {
    NEW: 'New drive letter',
    EXISTING: 'Existing drive letter'
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
    } else {
        return `
        curl --location --request POST '${baseUrl}/mssql/credentials/${credentialId}/regions/${region}/database-hosts/${databaseHostId}/database' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --header 'x-netapp-referer: BlueXP' \\
        --data-raw '${payload}'
        `;
    }
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
    } else {
        return `
        curl --location --request POST '${baseUrl}/mssql/credentials/${credentialId}/regions/${region}/sandboxes' \\
        --header 'Authorization: Bearer ${token}' \\
        --header 'Content-Type: application/json' \\
        --header 'x-netapp-referer: BlueXP' \\
        --data-raw '${payload}'
        `;
    }
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
    CASE_SENSITIVE_DOWN: 'Down'
};

export const INVENTORY_ACTIONS = {
    MANAGE: 'Manage',
    EXPLORE_SAVINGS: 'Explore savings'
};

export const INSTANCE_API_FIELDS = {
    UNMANAGED_DEFAULT: [
        'databaseInstanceTopology',
        'usageEstimation',
        'storage',
        'databaseServer',
        'serverDetails',
        'nodeTopology'
    ],
    SUB_TABLE_FIELDS: ['protection', 'performance'],
    MIXED_STATUS_FIELDS: [
        'databaseInstanceTopology',
        'storage',
        'databaseServer',
        'serverDetails',
        'nodeTopology',
        'usageEstimation',
        'dbCount'
    ]
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

export const SAVINGS_CALC_MODE = {
    MANUAL_EBS: 'Manual_EBS',
    AUTO_EBS: 'Auto_EBS',
    AUTO_FSXW: 'Auto_FSXW',
    MANUAL_FSXW: 'Manual_FSXW',
    ONPREM: 'OnPrem'
};

export const PARTNER_NODE = 'partner node';

export const FINDINGS = {
    OPTIMIZED: 'OPTIMIZED',
    NOT_OPTIMIZED: 'NOT_OPTIMIZED',
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
    NOT_OPTIMIZED: 'Not optimized',
    UNDER_PROVISIONED: 'Under-provisioned',
    OVER_PROVISIONED: 'Over-provisioned',
    OPTIMIZING: 'Optimizing',
    NOT_APPLICABLE: GENERAL.UNAVAILABLE,
    ANALYZING: 'Analyzing'
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
    critical: 'Critical',
    warning: 'Warning',
    none: 'None',
    'separate drive': 'Separate drive',
    'same drive': 'Same drive'
};

export const GETWELL_CONFIG: any = {
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
    'mpio-enabled': 'Multipath I/O Status',
    'mpio-load-balance-policy': 'Multipath I/O Policy',
    'ntfs-allocation-size': 'NTFS allocation unit size',
    'ntfs-allocation-unit-size': 'NTFS allocation unit size',
    'log-drive-size': 'transaction_log_drive_size',
    'performance-tier': 'storage_tier',
    'tempdb-drive-size': 'tempdb_drive_size',
    headroom: 'file_system_headroom',
    'tempdb-files-location': 'tempdb_files',
    'log-files-location': 'transaction_log_files',
    'data-files-location': 'user_data_files',
    'compute-rightsizing': 'compute_rightsizing',
    'rss-config': 'rss_config',
    'sql-license': 'sql_licenses',
    'host-os-patch': 'host_os_patch',
    'microsoft-sql-patch': 'microsoft_sql_patch',
    maxdop: 'maxdop'
};

export const GW_CONFIG_OPTIMIZE_NA = [
    'Data files (.mdf) placement',
    'Log files (.ldf) placement',
    'TempDB placement',
    GENERAL.LICENSE_SQL_SERVER,
    GENERAL.OPERATING_SYSTEM_PATCH,
    GENERAL.RSS_CONFIGURATION,
    GENERAL.MICROSOFT_SQL_PATCH,
    GENERAL.MAXDOP_PATCH
];

export const GW_TOOLTIP_KEYS_MAPPING: any = {
    rssProfile: 'RSS profile',
    baseProcessorNumber: 'Base processor number',
    receiveQueues: 'Receive Queues',
    tcpOffloading: 'TCP Offloading Features'
};

export const NETWORK_PERFORMANCE_OPTIONS: any = {
    'Up to 10 GiB': 'upTo10',
    'Above 10 GiB': 'above10'
};

export const ERR_MSG_TO_CHECK = [
    'does not match schema definition.'
];
