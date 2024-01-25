const MODEL = 'anthropic.claude-v2';
const SERVICE = 'bedrock';
const BEDROCK_REGION = process.env.REGION || 'us-west-2';

const CREDENTIALS_ID = 'credentialsId';
const REGION = 'region';
const VPC_ID = 'vpcId';
const AZ_1 = 'availabilityZone1';
const PRIVATE_SUBNET_1 = 'privateSubnet1Id';
const ROUTE_TABLE_1 = 'routeTable1Id';
const AZ_2 = 'availabilityZone2';
const PRIVATE_SUBNET_2 = 'privateSubnet2Id';
const ROUTE_TABLE_2 = 'routeTable2Id';
const VPC_CIDR = 'vpcCidr';
const WL_INSTANCE_TYPE = 'workloadInstanceType';
const KEY_PAIR_NAME = 'keyPairName';
const SQL_AMI = 'sqlAmiId';
const AD_SCENARIO_TYPE = 'adScenarioType';
const DNS_IP = 'dnsIpaddress';
const DOMAIN_DNS = 'domainDnsname';
const DOMAIN_USERNAME = 'domainUsername';
const DOMAIN_PASS = 'domainPassword';
const FSX_USERNAME = 'fsxUsername';
const FSX_PASS = 'fsxPassword';
const SERVICE_ACCOUNT_NAME = 'serviceAccountName';
const SERVICE_ACCOUNT_PASS = 'serviceAccountPassword';
const FSX_DEPLOYMENT_MODE = 'fsxDeploymentMode';
const SQL_DEPLOYMENT_MODE = 'sqlDeploymentMode';
const DB_SIZE = 'databaseSize';
const FSX_VOL_THROUGHPUT = 'fsxVolThroughput';
const FSX_IOPS = 'fsxIOPS';
const ONTAP_SG_ID = 'ontapSgGroupId';
const FSX_TYPE = 'fsxType';
const FSX_FILE_SYSTEM_ID = 'fsxFileSystemId';
const ENABLE_CLOUD_WATCH = 'enableCloudWatch';
const SQL_SERVER_NAME = 'sqlServerName';
const TAGS = 'tags';
const DEPLOYMENT_ENVIRONMENT = 'deploymentEnvironment';
const FCI_ABBREVIATION = 'FCI (Failover cluster instance)';
const MULTI_AZ_SMALL = 'Multi_AZ_1';
const SINGLE_AZ_SMALL = 'Single_AZ_1';
const AWS_MANAGED_AD = 'AWS_MANAGED_AD';
const USER_MANAGED_AD = 'USER_MANAGED_AD';
const SINGLE_AZ = 'SINGLE_AZ_1';
const MULTI_AZ = 'MULTI_AZ_1';
const ENCRYPTION_KEY = 'encryptionKey';

const EQ = 'EQ';

const STANDALONE = 'standalone';
const FCI = 'fci';

const NEW = 'NEW';
const EXISTING = 'EXISTING';

const PROD = 'PRODUCTION';
const DEV = 'DEVELOPMENT';
const CUSTOM = 'CUSTOM';

const M5_2XL = 'm5.2xlarge';
const M5_XL = 'm5.xlarge';

const CHATBOT_UI_PARAMS_FSX = [
    {
        [DEPLOYMENT_ENVIRONMENT]: {
            required: true
        }
    },
    {
        [CREDENTIALS_ID]: {
            required: true
        }
    },
    {
        [SQL_DEPLOYMENT_MODE]: {
            required: true,
            dependsOn: DEPLOYMENT_ENVIRONMENT
        }
    },
    {
        [REGION]: {
            required: true,
            dependsOn: CREDENTIALS_ID
        }
    },
    {
        [VPC_ID]: {
            required: true,
            dependsOn: REGION
        }
    },
    {
        [AZ_1]: {
            required: true,
            dependsOn: VPC_ID
        }
    },

    {
        [PRIVATE_SUBNET_1]: {
            required: true
        }
    },
    {
        [ROUTE_TABLE_1]: {
            required: true
        }
    },
    {
        [AZ_2]: {
            required: { key: SQL_DEPLOYMENT_MODE, operand: EQ, value: FCI },
            dependsOn: VPC_ID
        }
    },
    {
        [PRIVATE_SUBNET_2]: {
            required: { key: SQL_DEPLOYMENT_MODE, operand: EQ, value: FCI }
        }
    },
    {
        [ROUTE_TABLE_2]: {
            required: { key: SQL_DEPLOYMENT_MODE, operand: EQ, value: FCI }
        }
    },
    {
        [SERVICE_ACCOUNT_NAME]: {
            required: true
        }
    },
    {
        [SERVICE_ACCOUNT_PASS]: {
            required: true
        }
    },
    {
        [KEY_PAIR_NAME]: {
            required: true
        }
    },
    {
        [AD_SCENARIO_TYPE]: {
            required: true,
            dependsOn: DOMAIN_DNS,
            hidden: true
        }
    },
    {
        [DOMAIN_DNS]: {
            required: true
        }
    },
    {
        [DNS_IP]: {
            required: true,
            dependsOn: DOMAIN_DNS,
            hidden: true
        }
    },
    {
        [DOMAIN_USERNAME]: {
            required: true
        }
    },
    {
        [DOMAIN_PASS]: {
            required: true
        }
    },
    {
        [FSX_TYPE]: {
            required: true,
            dependsOn: VPC_ID
        }
    },
    {
        [FSX_FILE_SYSTEM_ID]: {
            required: { key: FSX_TYPE, operand: EQ, value: EXISTING },
            dependsOn: FSX_TYPE
        }
    },
    {
        [FSX_USERNAME]: {
            required: true,
            dependsOn: FSX_TYPE
        }
    },
    {
        [FSX_PASS]: {
            required: true,
            dependsOn: FSX_TYPE
        }
    },
    {
        [DB_SIZE]: {
            required: true
        }
    },
    {
        [VPC_CIDR]: {
            required: true,
            dependsOn: VPC_ID,
            hidden: true
        }
    },
    {
        [FSX_IOPS]: {
            required: true,
            dependsOn: DB_SIZE,
            hidden: true
        }
    },
    {
        [SQL_AMI]: {
            required: true
        }
    },
    {
        [SQL_SERVER_NAME]: {
            required: true
        }
    },
    {
        [FSX_DEPLOYMENT_MODE]: {
            required: true,
            dependsOn: SQL_DEPLOYMENT_MODE
        }
    },
    {
        [FSX_VOL_THROUGHPUT]: {
            required: true
        }
    },
    {
        [ENCRYPTION_KEY]: {
            required: { key: FSX_TYPE, operand: EQ, value: EXISTING }
        }
    }
];

const MSSQL_ENV_PRE_CONFIG = {
    [PROD]: {
        [WL_INSTANCE_TYPE]: M5_2XL,
        [FSX_DEPLOYMENT_MODE]: MULTI_AZ,
        [DB_SIZE]: 500,
        [SQL_DEPLOYMENT_MODE]: FCI
    },
    [DEV]: {
        [WL_INSTANCE_TYPE]: M5_XL,
        [FSX_DEPLOYMENT_MODE]: SINGLE_AZ,
        [DB_SIZE]: 100,
        [SQL_DEPLOYMENT_MODE]: STANDALONE
    },
    [CUSTOM]: {}
};

const KEY_LABEL_MAP = {
    [CREDENTIALS_ID]: 'credential id',
    [REGION]: 'region',
    [VPC_ID]: 'vpc',
    [AZ_1]: 'availability zone for primary node',
    [AZ_2]: 'availability zone for secondary node',
    [VPC_CIDR]: 'vpc cidr',
    [PRIVATE_SUBNET_1]: 'subnet for primary node',
    [ROUTE_TABLE_1]: 'route table for primary node',
    [PRIVATE_SUBNET_2]: 'subnet for secondary node',
    [ROUTE_TABLE_2]: 'route table for secondary node',
    [WL_INSTANCE_TYPE]: 'workload instance type',
    [KEY_PAIR_NAME]: 'key pair name',
    [SQL_AMI]: 'sql ami id',
    [AD_SCENARIO_TYPE]: 'active directory scenario type',
    [DNS_IP]: 'Enter the DNS IP address',
    [DOMAIN_DNS]: 'Enter a domain name',
    [DOMAIN_USERNAME]: 'Enter a user name for Active Directory', // extra value needed for suggesstion
    [DOMAIN_PASS]: 'Enter a password for Active Directory',
    [FSX_USERNAME]: 'Enter a user name for the file system', // suggestion
    [FSX_PASS]: 'Enter a password for the user', // suggestion
    [SERVICE_ACCOUNT_NAME]: 'Enter a user name for the database credentials',
    [SERVICE_ACCOUNT_PASS]: 'Enter a password for database credentials.',
    [FSX_DEPLOYMENT_MODE]: 'fsx deployment mode',
    [SQL_DEPLOYMENT_MODE]: 'sql deployment mode',
    [DB_SIZE]: 'Enter a data drive size',
    [FSX_VOL_THROUGHPUT]: 'fsx volume throughput',
    [FSX_IOPS]: 'fsx IOPS',
    [ONTAP_SG_ID]: 'ontap security group id',
    [FSX_TYPE]: 'fsx type',
    [FSX_FILE_SYSTEM_ID]: 'fsx file system id',
    [SQL_SERVER_NAME]: 'Enter a value for database cluster name',
    [TAGS]: 'tags'
};

export {
    MODEL,
    SERVICE,
    BEDROCK_REGION,
    CHATBOT_UI_PARAMS_FSX,
    CREDENTIALS_ID,
    REGION,
    VPC_ID,
    AZ_1,
    AZ_2,
    VPC_CIDR,
    WL_INSTANCE_TYPE,
    KEY_PAIR_NAME,
    SQL_AMI,
    AD_SCENARIO_TYPE,
    DNS_IP,
    DOMAIN_DNS,
    DOMAIN_USERNAME,
    DOMAIN_PASS,
    FSX_USERNAME,
    FSX_PASS,
    SERVICE_ACCOUNT_NAME,
    SERVICE_ACCOUNT_PASS,
    FSX_DEPLOYMENT_MODE,
    SQL_DEPLOYMENT_MODE,
    DB_SIZE,
    FSX_VOL_THROUGHPUT,
    FSX_IOPS,
    ONTAP_SG_ID,
    AWS_MANAGED_AD,
    USER_MANAGED_AD,
    FSX_TYPE,
    FSX_FILE_SYSTEM_ID,
    SINGLE_AZ,
    MULTI_AZ,
    STANDALONE,
    FCI,
    NEW,
    EXISTING,
    KEY_LABEL_MAP,
    ENABLE_CLOUD_WATCH,
    PRIVATE_SUBNET_1,
    PRIVATE_SUBNET_2,
    ROUTE_TABLE_1,
    ROUTE_TABLE_2,
    SQL_SERVER_NAME,
    TAGS,
    DEPLOYMENT_ENVIRONMENT,
    PROD,
    DEV,
    CUSTOM,
    MSSQL_ENV_PRE_CONFIG,
    M5_2XL,
    FCI_ABBREVIATION,
    MULTI_AZ_SMALL,
    SINGLE_AZ_SMALL,
    M5_XL,
    ENCRYPTION_KEY
};
