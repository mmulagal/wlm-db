const MODEL = 'anthropic.claude-v2';
const SERVICE = 'bedrock';
const BEDROCK_REGION = process.env.REGION;

const CHATBOT_UI_PARAMS_FSX = [
    {
        credentialsConfig: [
            {
                credentialsId: {
                    required: true
                }
            }
        ]
    },
    {
        rootConfig: [
            {
                region: {
                    required: true,
                    dependsOn: 'credentialsId'
                }
            },
            {
                fsxDeploymentMode: {
                    required: true,
                    dependsOn: 'credentialsId'
                }
            }
        ]
    },
    {
        vpcConfig: [
            {
                vpcId: {
                    required: true,
                    dependsOn: 'region'
                }
            }
        ]
    },
    {
        networkConfiguration: [
            {
                availabilityZone1: {
                    required: true,
                    dependsOn: 'vpcId'
                }
            },
            {
                availabilityZone2: {
                    required: { key: 'fsxDeploymentMode', operand: 'EQ', value: 'MULTI_AZ_1' },
                    dependsOn: 'vpcId'
                }
            }
        ]
    },
    {
        ec2Configuration: [
            {
                workloadInstanceType: {
                    required: true,
                    dependsOn: 'region'
                }
            },
            {
                keyPairName: {
                    required: true
                }
            }
        ]
    },
    {
        adConfiguration: [
            {
                domainUsername: {
                    required: true
                }
            },
            {
                domainPassword: {
                    required: true
                }
            },
            {
                domainDnsname: {
                    required: true
                }
            },
            {
                securityGroupId: {
                    required: false,
                    dependsOn: 'vpcId'
                }
            }
        ]
    },
    {
        sqlConfiguration: [
            {
                sqlDeploymentMode: {
                    required: true
                }
            },
            {
                sqlAmiId: {
                    required: true
                }
            },
            {
                serviceAccountName: {
                    required: true
                }
            },
            {
                serviceAccountPassword: {
                    required: true
                }
            },
            {
                sqlFciName: {
                    required: true
                }
            }
        ]
    },
    {
        fsxConfiguration: [
            {
                fsxUsername: {
                    required: true
                }
            },
            {
                fsxPassword: {
                    required: true
                }
            },
            {
                databaseSize: {
                    required: true
                }
            },
            {
                fsxVolThroughput: {
                    required: true
                }
            },
            {
                encryptionKey: {
                    required: false
                }
            },
            {
                ontapSgGroupId: {
                    required: true,
                    dependsOn: 'vpcId'
                }
            }
        ]
    },
    {
        derivedParams: [
            {
                vpcCidr: {
                    required: true,
                    dependsOn: 'vpcId',
                    hidden: true
                }
            },
            {
                adScenarioType: {
                    required: true,
                    dependsOn: 'domainDnsname',
                    hidden: true
                }
            },
            {
                dnsIpaddress: {
                    required: true,
                    dependsOn: 'domainDnsname',
                    hidden: true
                }
            },
            {
                fsxIOPS: {
                    required: true,
                    dependsOn: 'databaseSize',
                    hidden: true
                }
            }
        ]
    }
];

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
const SQL_FCI = 'sqlFciName';
const FSX_DEPLOYMENT_MODE = 'fsxDeploymentMode';
const SQL_DEPLOYMENT_MODE = 'sqlDeploymentMode';
const DB_SIZE = 'databaseSize';
const FSX_VOL_THROUGHPUT = 'fsxVolThroughput';
const FSX_IOPS = 'fsxIOPS';
const ONTAP_SG_ID = 'ontapSgGroupId';

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
    SQL_FCI,
    FSX_DEPLOYMENT_MODE,
    SQL_DEPLOYMENT_MODE,
    DB_SIZE,
    FSX_VOL_THROUGHPUT,
    FSX_IOPS,
    ONTAP_SG_ID
};
