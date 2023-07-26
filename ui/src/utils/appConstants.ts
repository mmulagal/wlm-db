export const SELECT_CONFIG = {
    STANDARD_CREATE: `Standard create`,
    EASY_CREATE: `Easy create`,
    STANDARD_CREATE_CONTENT: `You set all of the configuration options, including ones for
    availability, security, backups, and maintenance.`,
    EASY_CREATE_CONTENT:
        'Use a recommended est-practice configuration. You can change most configuration options after database is created.',
    COMING_SOON: 'Coming soon',
    CREATE: 'Create',
    CANCEL: 'Cancel',
    WIZARD_HEADING: 'Create new Microsoft SQL server',
    LOAD_CONFIG: 'Load configuration',
    SAVE_CONFIG: 'Save configuration',
    SECURITY_GROUP: 'Security group'
};

export const GENERAL = {
    ONE_OR_MORE_ERROR: 'One or more fields has an error',
    APPLICATION_SETTINGS: 'Application settings',
    OPERATING_SYSTEM: 'Operating system',
    DATABASE_DEPLOYMENT_MODEL: 'Database deployment model',
    DATABASE_EDITION: 'Database edition',
    DATABASE_VERSION: 'Database version',
    LICENSE: 'License',
    DATABASE_NAME: 'Database name',
    DATABASE_CREDENTIALS: 'Database credentials',
    CONNECTIVITY: 'Connectivity',
    KEY_PAIR: 'Key pair',
    ACTIVE_DIRECTORY: 'Active Directory',
    INFRASTRUCTURE_SETTINGS: 'Infrastructure settings',
    INSTANCE_TYPE: 'Instance type',
    FSXN_SYSTEM: 'FSxN system',
    STORAGE_CAPACITY: 'Storage capacity',
    PROVISIONED_IOPS: 'Provisioned IOPS',
    THROUGHPUT_CAPACITY: 'Throughput capacity',
    ENCRYPTION: 'Encryption',
    TAGS: 'Tags',
    SIMPLE_NOTIFICATION_SERVICE: 'Simple Notification Service',
    SAVE_FORM_AS_CLOUD: 'Save form as CloudFormation',
    AWS_SETTINGS: 'AWS settings',
    VIEW_API_REQUEST: 'View Api request',
    LOAD_CONFIG_HEADER: 'Load Microsoft SQL server configuration',
    LOAD_CONFIG_CONTENT:
        'Select the configuration that you want to load. You can change the parameters after it loads.',
    LOAD: 'Load',
    Cancel: 'Cancel',
    DEFAULT_AWS_ACCOUNT_SUB_TEXT:
        'No AWS credentials are available to create Microsoft SQL server. In order to continue you have two options:',
    AWS_ACCOUNT_SUB_TEXT:
        'Select credentials that grant BlueXP the permissions required to deploy and manage Microsoft SQL server and FSx for ONTAP. For more information, visit ',
    AWS_ACCOUNT_DEFAULT_LIST_TWO:
        'If you prefer not to enter your account credentials, continue to fill the form below, and we will produce the applicable CloudFormation code that you can copy and operate by yourself.',
    AWS_DEFAULT_LIST_FIRST:
        "page and add the credentials that you'd like to use, so we could create the DB for you. Deployment will take about 2 hours.",
    GO_TO_THE: 'Go to the',
    MS_SQL_REQUIRED: 'Microsoft SQL on FSxN for ONTAP required permissions',
    CREDENTIALS: 'Credentials',
    ADD_NEW_CREDENTIALS: 'To add a new credentials, visit',
    //Constants for Security group
    USE_AN_EXISTING_SECURITY: 'Use an existing security group',
    GENERATED_SECURITY_GROUP: 'Generated security group',
    EXISTING_SECURITY_GROUP: 'Existing security group',
    //Constants for Op system
    WIN_SERVER_2016: 'Windows server 2016',
    WIN_SERVER_2019: 'Windows server 2019',
    OP_SYS_TEXT: 'Choose the operating system on which to install SQL Server.',
    //Constants for DB Deployment
    FAILOVER_CLUSTER: 'Failover Cluster Instances (FCI)',
    FAILOVER_CLUSTER_TEXT: 'Deploy your SQL Server Always On application across Multiple Availability Zones',
    SINGLE_INSTANCE: 'Single Instance',
    SINGLE_INSTANCE_TEXT: 'Deploy your SQL Server on a single node.',
    //Constants for DB Edition
    SQL_SERVER_STANDARD_EDITION: 'SQL Server Standard Edition',
    SQL_SERVER_STANDARD_EDITION_TEXT:
        'Core data management and business intelligence capabilities for mission-critical applications and mixed workloads.',
    SQL_SERVER_WEB_EDITION: 'SQL Server Web Edition',
    SQL_SERVER_WEB_EDITION_TEXT:
        "In accordance with Microsoft's licensing policies, it can only be used to support public and Internet-accessible webpages, websites, web applications, and web services.",
    SQL_SERVER_ENTERPRiSE_EDITION: 'SQL Server Enterprise Edition',
    SQL_SERVER_ENTERPRiSE_EDITION_TEXT:
        'Comprehensive high-end capabilities for mission-critical applications with demanding database workloads and business intelligence requirements.',
    //Constants for DB version
    SQL_SERVER_2019: 'SQL Server 2019',
    SQL_SERVER_2016: 'SQL Server 2016',
    SQL_SERVER_2022: 'SQL Server 2022',
    VERSION: 'Version',
    //Constants for License accordion
    LICENSE_TEXT:
        'Use an AWS provided license-included AMI with Windows and SQL Server installed or You can bring your own SQL licenses (BYOL) through your custom AMI or use license included custom AMI. If you use a custom AMI, ensure that it meets all required install parameters.',
    LICENSE_INCLUDED_AMI: 'License included AMI',
    USE_CUSTOM_AMI: 'Use custom AMI',
    AMI_ID: 'AMI ID',
    SELECT_AMI_ID: 'Select AMI ID',

    //Constants for DB name accordion
    DATABASE_INSTANCE_NAME: 'Database instance name',
    DB_NAME_TOOLTIP:
        'First character should not be a numerical value (0-9), it can be an alphabet (a-z), underscore ‘_’, number sign ‘#’, or ampersand ‘&’. Space and special characters (such as @, ^, *,  ) are not allowed. Instance name should be 16 chars or less in length.',
    KEY_PAIR_NAME: 'Key pair'
};
