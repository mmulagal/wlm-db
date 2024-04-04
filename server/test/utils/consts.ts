/* eslint-disable quotes */
import { faker } from '@faker-js/faker';

const DEFAULT_AWS_VPC_ID = 'vpc-84b3afe6';
const DEFAULT_AWS_CREDENTIALS_TYPE = 'aws_assume_role';
const DEFAULT_AWS_CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';
const DEFAULT_AWS_REGION = 'us-east-1';

const NETWORKING_CONFIGURATION = {
    vpcId: 'vpc-84b3afe6',
    vpcCidr: '172.31.0.0/16',
    privateSubnet1Id: 'subnet-f4484e80',
    routeTable1Id: 'rtb-65aeb107',
    availabilityZone1: 'string',
    privateSubnet2Id: 'subnet-4cdd3b29',
    routeTable2Id: 'rtb-65aeb108',
    availabilityZone2: 'string'
};
const EC2_CONFIGURATION = {
    workloadInstanceType: 'm4.xlarge',
    keyPairName: 'krithi_new_key'
};

const AD_CONFIGURATION = {
    adScenarioType: 'AWS_MANAGED_AD',
    domainUsername: 'Admin',
    domainPassword: 'Collector@123',
    domainDnsname: 'dbsdev.com',
    dnsIpaddress: '172.31.7.45,172.31.43.182',
    securityGroupId: 'sg-0d6f82bcd4a2e05d6'
};

const FSX_CONFIGURATION = {
    fsxDeploymentMode: 'MULTI_AZ_1',
    fsxFileSystemId: 'fs-05a228ef446b34d27',
    fsxUsername: 'fsxadmin',
    fsxPassword: 'netapp1!',
    databaseSize: 1024,
    fsxVolThroughput: 128,
    fsxIOPS: 3072,
    encryptionKey: '',
    ontapSgGroupId: ['sg-3924c15c']
};

const SQL_CONFIGURATION = {
    sqlDeploymentMode: 'fci',
    sqlAmiId: 'ami-0e0f179ddde359def',
    serviceAccountName: 'sqladmin',
    serviceAccountPassword: 'netapp1!',
    sqlServerName: 'SampleFci',
    sqlAmiName: 'Windows_Server-2016-English-Full-SQL_2019_Standard-2024.01.16',
    sqlCollation: 'SQL_Latin1_General_CP1_CI_AS'
};

const SSM_PARAMS = {
    DocumentName: 'AWS-RunPowerShellScript',
    Documentversion: '1',
    Parameters: {
        commands: [
            ' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT\n' +
            '                                (processmem.physical_memory_in_use_kb * 1024) AS used,\n' +
            '                                (sysmem.total_physical_memory_kb * 1024) AS total,\n' +
            '                                ((sysmem.total_physical_memory_kb * 1024)-(processmem.physical_memory_in_use_kb * 1024)) as remaining,\n' +
            '                                 ((processmem.physical_memory_in_use_kb/1024) * 100 / (sysmem.total_physical_memory_kb/1024)) as percentUsed\n' +
            '                                 FROM sys.dm_os_process_memory as processmem, sys.dm_os_sys_memory as sysmem;"'
        ]
    },
    InstanceIds: ['i-07e76a4b916548dc0']
};

const DEPLOYMENT_JOBS_COUNT_RESPONSE = [
    {
        _count: {
            deployment_status: 31
        },
        deployment_status: 'UPDATE_COMPLETE'
    },
    {
        _count: {
            deployment_status: 39
        },
        deployment_status: 'CREATE_IN_PROGRESS'
    },
    {
        _count: {
            deployment_status: 28
        },
        deployment_status: 'CREATE_COMPLETE'
    },
    {
        _count: {
            deployment_status: 27
        },
        deployment_status: 'UPDATE_IN_PROGRESS'
    },
    {
        _count: {
            deployment_status: 21
        },
        deployment_status: 'CREATE_FAILED'
    }
];

const ACCOUNT_ID = 'account-test';
const CREDENTIALS_ID = `${faker.string.alphanumeric(20)}`;
const ACTIVE_INSTANCE_ID = `${faker.string.alphanumeric(10)}`;
const STANDBY_INSTANCE_ID = `${faker.string.alphanumeric(10)}`;

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export {
    SQL_CONFIGURATION,
    FSX_CONFIGURATION,
    AD_CONFIGURATION,
    EC2_CONFIGURATION,
    NETWORKING_CONFIGURATION,
    DEFAULT_AWS_VPC_ID,
    DEFAULT_AWS_CREDENTIALS_TYPE,
    DEFAULT_AWS_CREDENTIALS_ID,
    DEFAULT_AWS_REGION,
    SSM_PARAMS,
    ACCOUNT_ID,
    CREDENTIALS_ID,
    ACTIVE_INSTANCE_ID,
    STANDBY_INSTANCE_ID,
    DEPLOYMENT_JOBS_COUNT_RESPONSE,
    THIRTY_DAYS
};
