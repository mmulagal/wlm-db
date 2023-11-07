const MODEL = 'anthropic.claude-v2';
const SERVICE = 'bedrock';
const BEDROCK_REGION = process.env.REGION || 'us-west-2';

const CREDENTIALS_ID = 'credentialsId';
const REGION = 'region';
const VPC_ID = 'vpcId';
const AZ_1 = 'availabilityZone1';
const AZ_2 = 'availabilityZone2';
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

const AWS_MANAGED_AD = 'AWS_MANAGED_AD';
const USER_MANAGED_AD = 'USER_MANAGED_AD';
const SINGLE_AZ = 'SINGLE_AZ_1';
const MULTI_AZ = 'MULTI_AZ_1';

const EQ = 'EQ';

const STANDALONE = 'standalone';
const FCI = 'fci';

const NEW = 'NEW';
const EXISTING = 'EXISTING';

const CHATBOT_UI_PARAMS_FSX = [
    {
        credentialsConfig: [
            {
                [CREDENTIALS_ID]: {
                    required: true
                }
            }
        ]
    },
    {
        rootConfig: [
            {
                [REGION]: {
                    required: true,
                    dependsOn: CREDENTIALS_ID
                }
            },
            {
                [FSX_DEPLOYMENT_MODE]: {
                    required: true,
                    dependsOn: CREDENTIALS_ID
                }
            },
            {
                [FSX_TYPE]: {
                    required: true
                }
            }
        ]
    },
    {
        vpcConfig: [
            {
                [VPC_ID]: {
                    required: true,
                    dependsOn: REGION
                }
            }
        ]
    },
    {
        networkConfiguration: [
            {
                [AZ_1]: {
                    required: true,
                    dependsOn: VPC_ID
                }
            },
            {
                [AZ_2]: {
                    required: { key: FSX_DEPLOYMENT_MODE, operand: EQ, value: MULTI_AZ },
                    dependsOn: VPC_ID
                }
            }
        ]
    },
    {
        ec2Configuration: [
            {
                [WL_INSTANCE_TYPE]: {
                    required: true,
                    dependsOn: REGION
                }
            },
            {
                [KEY_PAIR_NAME]: {
                    required: true
                }
            }
        ]
    },
    {
        adConfiguration: [
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
                [DOMAIN_DNS]: {
                    required: true
                }
            }
        ]
    },
    {
        sqlConfiguration: [
            {
                [SQL_DEPLOYMENT_MODE]: {
                    required: true
                }
            },
            {
                [SQL_AMI]: {
                    required: true
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
            }
        ]
    },
    {
        fsxConfiguration: [
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
                [FSX_VOL_THROUGHPUT]: {
                    required: true
                }
            },
            {
                encryptionKey: {
                    required: false
                }
            },
            {
                [ONTAP_SG_ID]: {
                    required: true,
                    dependsOn: VPC_ID
                }
            }
        ]
    },
    {
        derivedParams: [
            {
                [VPC_CIDR]: {
                    required: true,
                    dependsOn: VPC_ID,
                    hidden: true
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
                [DNS_IP]: {
                    required: true,
                    dependsOn: DOMAIN_DNS,
                    hidden: true
                }
            },
            {
                [FSX_IOPS]: {
                    required: true,
                    dependsOn: DB_SIZE,
                    hidden: true
                }
            }
        ]
    }
];

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
    EXISTING
};
