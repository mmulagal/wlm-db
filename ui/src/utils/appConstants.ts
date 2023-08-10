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
    ACTION_REQUIRED: 'Action Required',
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
    STORAGE_CAPACITY: 'Data drive size',
    PROVISIONED_IOPS: 'Provisioned IOPS',
    THROUGHPUT_CAPACITY: 'Throughput capacity',
    ENCRYPTION: 'Encryption',
    TAGS: 'Tags',
    TAG: 'Tag',
    SIMPLE_NOTIFICATION_SERVICE: 'Simple Notification Service',
    SAVE_FORM_AS_CLOUD: 'Save form as CloudFormation',
    AWS_SETTINGS: 'AWS settings',
    VIEW_API_REQUEST: 'View Api request',
    LOAD_CONFIG_HEADER: 'Load Microsoft SQL server configuration',
    LOAD_CONFIG_CONTENT:
        'Select the configuration that you want to load. You can change the parameters after it loads.',
    LOAD: 'Load',
    CLOSE: 'Close',
    API_REQUEST: 'API request',
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
    WIN_SERVER_2016_VERSION: '2016',
    WIN_SERVER_2019_VERSION: '2019',
    OP_SYS_TEXT: 'Choose the operating system on which to install SQL Server.',
    //Constants for DB Deployment
    FAILOVER_CLUSTER: 'Failover Cluster Instances (FCI)',
    FAILOVER_CLUSTER_TEXT: 'Deploy your SQL Server Always On application across Multiple Availability Zones',
    SINGLE_INSTANCE: 'Single Instance',
    SINGLE_INSTANCE_TEXT: 'Deploy your SQL Server on a single node.',
    //Constants for DB Edition
    SQL_SERVER_STANDARD: 'Standard',
    SQL_SERVER_STANDARD_EDITION: 'SQL Server Standard Edition',
    SQL_SERVER_STANDARD_EDITION_TEXT:
        'Core data management and business intelligence capabilities for mission-critical applications and mixed workloads.',
    SQL_SERVER_WEB: 'Web',
    SQL_SERVER_WEB_EDITION: 'SQL Server Web Edition',
    SQL_SERVER_WEB_EDITION_TEXT:
        "In accordance with Microsoft's licensing policies, it can only be used to support public and Internet-accessible webpages, websites, web applications, and web services.",
    SQL_SERVER_ENTERPRISE: 'Enterprise',
    SQL_SERVER_ENTERPRiSE_EDITION: 'SQL Server Enterprise Edition',
    SQL_SERVER_ENTERPRiSE_EDITION_TEXT:
        'Comprehensive high-end capabilities for mission-critical applications with demanding database workloads and business intelligence requirements.',
    //Constants for DB version
    SQL_SERVER_2019: 'SQL Server 2019',
    SQL_SERVER_2016: 'SQL Server 2016',
    SQL_SERVER_2022: 'SQL Server 2022',
    SQL_SERVER_2019_VERSION: '2019',
    SQL_SERVER_2016_VERSION: '2016',
    SQL_SERVER_2022_VERSION: '2022',
    VERSION: 'Version',
    //Constants for License accordion
    LICENSE_TEXT:
        'Use an AWS provided license-included AMI with Windows and SQL Server installed or You can bring your own SQL licenses (BYOL) through your custom AMI or use license included custom AMI. If you use a custom AMI, ensure that it meets all required install parameters.',
    LICENSE_INCLUDED_AMI: 'License included AMI',
    LICENSE_ID: 'License ID',
    USE_CUSTOM_AMI: 'Use custom AMI',
    AMI_ID: 'AMI ID',
    SELECT_AMI_ID: 'Select AMI ID',
    SELECT_AMI_NAME: 'Select AMI Name',

    //Constants for DB name accordion
    DATABASE_INSTANCE_NAME: 'Database instance name',
    DB_NAME_TOOLTIP:
        'First character should not be a numerical value (0-9), it can be an alphabet (a-z), underscore ‘_’, number sign ‘#’, or ampersand ‘&’. Space and special characters (such as @, ^, *,  ) are not allowed. Instance name should be 16 chars or less in length.',
    KEY_PAIR_NAME: 'Key pair',
    //Constants for Storage capacity
    CAPACITY: 'Capacity',
    UNIT: 'Unit',
    CAPACITY_TOOLTIP:
        "Specify the SQL data drive size only. The provisioning for log drive, tempdb, and other FSxN filesystem volumes, as well as LUNs, will be performed according to NetApp's best practices for SQL configuration. You can change the recommended defaults to meet your requirements",
    ERROR_CAPACITY: 'Capacity range is between 1 - 192 TiB',
    //Provisioned IOPS
    AUTOMATIC: 'Automatic',
    USER_PROVISIONED: 'User-provisioned',
    IOPS_VALUE: 'IOPS value',
    AUTOMATIC_IOPS: '3 IOPS per GiB of SSD storage will be created.',
    PLACEHOLDER_PROVISIONED: '3072 - 160000 IOPS',
    THROUGHPUT: 'Throughput',
    //SIMPLE NOTIFICATION SERVICES
    SNS: 'Simple Notification Service (SNS) topic ARN',
    SNS_TEXT: 'Enter an SNS topic for Workload Manager to send notifications and alerts.',
    ARN: 'ARN',
    //Cloud watch
    CLOUD_WATCH_MONITORING: 'CloudWatch monitoring',
    CLOUD_WATCH_TEXT:
        'Set up monitors and automated insights for this SQL deployment using CloudWatch Application Insights.',
    //FSX Accordion
    CREATE_NEW_FSXN: 'Create new FSxN',
    SELECT_EXISTING_FSX: 'Select an existing FSxN ',
    FSXN_NAME: 'FSxN name',
    USER_NAME: 'User name',
    FSX_PASSWORD: 'FSxN password',
    NOTICE: 'Notice:',
    NOTICE_FSX_TEXT: 'New filesystem provisioning adds another 30 minutes to the total installation time.',
    //Active Directory
    DOMAIN_NAME: 'Domain name',
    DNS_ADDRESS: 'DNS address',
    AD_TEXT:
        'The directory in which you want to allow authorized users to authenticate with this SQL Server instance using Windows Authentication. Windows Server Failover Cluster requires that all servers be joined to the same Active Directory domain.',
    PASSWORD: 'Password',
    //Region VPC accordion
    REGION: 'Region',
    REGION_VPC_TEXT:
        'Choose the Virtual private cloud (VPC). The VPC defines the virtual  networking  environment for this DB instance.',
    SELECT_EXISTING_VPC: 'Select an existing VPC',
    CREATE_NEW_VPC: 'Create new VPC',
    REGION_VPC: 'Region & VPC',
    VPC: 'VPC',
    //Availability zone
    AZ_TEXT: 'Choose Availability Zones and corresponding private subnets for a minimum of two Availability Zones.',
    CLUSTER_CONFIG_NODE_1: 'Cluster configuration - Node 1:',
    CLUSTER_CONFIG_NODE_2: 'Cluster configuration - Node 2:',
    AZ_Zone: 'Availability zone',
    SUBNET: 'Subnet',
    //Encryption
    ENCRYPTION_TEXT:
        'Key that will be used to protect the key used to encrypt this database storage (FSxN). You can select from master keys in your account or type/paste the ARN of a key from a different account.',
    ENCRYPTION_SELECT_FROM_ACCOUNT: 'Select a key from your account',
    ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT: 'Select a key from another account',
    ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT_TEXT:
        'If needed, you can select a customer managed key from another AWS account by entering the Amazon Resource Name (ARN) of that key. You can find the ARN from the Amazon Key Management Service console. Key ARN starts with ‘arn:aws:kms’ or ‘arn:aws-us-gov:kms’.',
    ENCRYPTION_TEXT_FIELD: 'Encryption key ARN',
    ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT_SUB_TEXT:
        'AWS is responsible for data encryption and decryption operations. Key management is handled by AWS Key Management Service.',
    CUSTOMER_MASTER_KEY_NAME: 'Key name',
    KEY_ID: 'Key ID',
    EXPIRATION_DATE: 'Expiration date',
    ORIGIN: 'Origin',
    ONLY_ENABLED_KEYS: 'Only enabled keys are displayed.',
    TAGS_HEADING_MSG: 'You can add upto 50 tags',
    ADD_NEW_TAG: '+ Add new tag',
    TAG_KEY: 'Tag Key',
    TAG_VALUE: 'Tag Value',
    TAG_KEY_PLACEHOLDER: 'Up to 127 characters',
    TAG_VALUE_PLACEHOLDER: 'Up to 255 characters',
    SELECT_ANY_ACCOUNT: 'Please select any account',
    SELECT_ANY_VPC: 'Please select any VPC',
    CLOUD_FORMATION_URL_TEXT: 'The CloudFormation URL can be loaded using the'
};
