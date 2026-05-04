/* eslint-disable quotes */
import { faker } from '@faker-js/faker';

// Two VPCs are intentionally distinct (not interchangeable):
// - INVENTORY_AWS_VPC_ID: hardcoded in inventory-side simulator fixtures (describe-instance,
//   list-network-interfaces, demoInventoryData, etc.). Use for discovery/listing tests.
// - DEPLOYMENT_AWS_VPC_ID: the only VPC in list-vpcs.json backed by valid subnets, route
//   tables, and ADs. Use for deployment-wizard tests (powers NETWORKING_CONFIGURATION).
const INVENTORY_AWS_VPC_ID = 'vpc-84b3afe6';
const DEPLOYMENT_AWS_VPC_ID = 'vpc-ba1ed1de';
/** @deprecated Use INVENTORY_AWS_VPC_ID or DEPLOYMENT_AWS_VPC_ID to make the intent explicit. Retained as an alias for backwards compatibility. */
const DEFAULT_AWS_VPC_ID = INVENTORY_AWS_VPC_ID;
const DEFAULT_AWS_CREDENTIALS_TYPE = 'aws_assume_role';
const DEFAULT_AWS_CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';
const DEFAULT_AWS_REGION = 'us-east-1';

const TEST_STOPPED_EC2_INSTANCE_ID = 'i-07e76a4b916548dc0';
const NETWORKING_CONFIGURATION = {
    vpcId: DEPLOYMENT_AWS_VPC_ID,
    vpcCidr: '192.168.16.0/20',
    privateSubnet1Id: 'subnet-5a37222d',
    routeTable1Id: 'rtb-0dde1132a1c54f5e6',
    availabilityZone1: 'availability-zone-1',
    privateSubnet2Id: 'subnet-74a1b303',
    routeTable2Id: 'rtb-00d7acd615fac5414',
    availabilityZone2: 'availability-zone-2'
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
    databaseSize: 120,
    fsxVolThroughput: 128,
    fsxIOPS: 3072,
    encryptionKey: '',
    ontapSgGroupId: ['sg-3924c15c'],
    snapshotPolicy: 'default'
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
const DAYS = 7;
const getLastNDays = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.now() - i * 24 * 60 * 60 * 1000));

const CLOUD_WATCH_METRICS_RESPONSE = {
    MetricDataResults: [
        {
            Id: 'm1',
            Label: 'cpuUsed',
            Timestamps: getLastNDays(DAYS),
            Values: [55, 35, 75, 28, 52, 67, 48]
        },
        {
            Id: 'm2',
            Label: 'readThroughput',
            Timestamps: getLastNDays(DAYS),
            Values: [560, 880, 760, 960, 640, 480, 360]
        },
        {
            Id: 'm3',
            Label: 'readLatency',
            Timestamps: getLastNDays(DAYS),
            Values: [4.333333333, 4.5, 5.1, 3.8, 4.2, 4.0, 3.9]
        },
        {
            Id: 'm4',
            Label: 'writeThroughput',
            Timestamps: getLastNDays(DAYS),
            Values: [440, 280, 600, 180, 540, 200, 320]
        },
        {
            Id: 'm5',
            Label: 'writeLatency',
            Timestamps: getLastNDays(DAYS),
            Values: [5.3, 5.0, 4.9, 5.5, 6.1, 4.8, 5.2]
        },
        {
            Id: 'm6',
            Label: 'writeIops',
            Timestamps: getLastNDays(DAYS),
            Values: [135, 155, 140, 160, 130, 150, 120]
        },
        {
            Id: 'm7',
            Label: 'readIops',
            Timestamps: getLastNDays(DAYS),
            Values: [195, 165, 185, 175, 190, 170, 180]
        },
        {
            Id: 'm8',
            Label: 'serverIOLatency',
            Timestamps: getLastNDays(DAYS),
            Values: [1, 2, 1, 1, 1, 1, 2]
        }
    ]
};

export {
    TEST_STOPPED_EC2_INSTANCE_ID,
    SQL_CONFIGURATION,
    FSX_CONFIGURATION,
    AD_CONFIGURATION,
    EC2_CONFIGURATION,
    NETWORKING_CONFIGURATION,
    INVENTORY_AWS_VPC_ID,
    DEPLOYMENT_AWS_VPC_ID,
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
    THIRTY_DAYS,
    CLOUD_WATCH_METRICS_RESPONSE
};
