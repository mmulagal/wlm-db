import { faker } from '@faker-js/faker';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import { DATABASE_METRIC_TYPE } from '../../../src/utils/consts';
import {
    getDatabasesCount,
    getDataBasesSummary,
    getResourceUtilisation,
    getResourceDetails,
    callSsmExecution,
    getDBSummary,
    getTablesCount,
    getTablesList,
    getTablesSummary,
    getServerSummary,
    discoverMsSqlServer
} from '../../../src/operations/workloads/mssql/mssql-operations';

const credentialsId = `${faker.string.alphanumeric(20)}`;
const activeInstanceId = `${faker.string.alphanumeric(10)}`;
const standbyInstanceId = `${faker.string.alphanumeric(10)}`;
const commands = [' C:\\SSM\\ExecuteQueryFromSSM.ps1 -Query "SELECT @@version AS serverDetails"'];
const region = 'ap-southeast-1';

const getResourceUtilizationResponse = {
    percentUsed: 7,
    used: 342859776,
    total: 4294557696,
    remaining: 3951697920
};
const diskUtilizationResponse = {
    percentUsed: '3',
    remaining: '156186505216',
    total: '161058123776',
    used: '4871618560'
};
const databaseSummaryResponse = {
    databases: [
        {
            databaseId: 1,
            databaseName: 'Aaronview',
            creationDate: '/Date(1681235380963)/',
            databaseStatus: 'ONLINE',
            databaseSize: 553648128
        },
        {
            databaseId: 2,
            databaseName: 'Adamfort',
            creationDate: '/Date(1681233819663)/',
            databaseStatus: 'OFFLINE',
            databaseSize: 16777216
        },
        {
            databaseId: 3,
            databaseName: 'Adamsview',
            creationDate: '/Date(1681235388887)/',
            databaseStatus: 'ONLINE',
            databaseSize: 16777216
        },
        {
            databaseId: 4,
            databaseName: 'Alexandraside',
            creationDate: '/Date(1681234989220)/',
            databaseStatus: 'ONLINE',
            databaseSize: 16777216
        },
        {
            databaseId: 5,
            databaseName: 'Alexandraville',
            creationDate: '/Date(1681235398353)/',
            databaseStatus: 'OFFLINE',
            databaseSize: 16777216
        },
        {
            databaseId: 6,
            databaseName: 'Amandaberg',
            creationDate: '/Date(1681233818587)/',
            databaseStatus: 'ONLINE',
            databaseSize: 16777216
        },
        {
            databaseId: 7,
            databaseName: 'Angelashire',
            creationDate: '/Date(1681233816840)/',
            databaseStatus: 'ONLINE',
            databaseSize: 16777216
        }
    ]
};
const resourceDetailsResponse = [
    'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
    'ap-southeast-1',
    'i-07e76a4b916548dc0',
    'i-0880a21327284f67c'
];
const ssmResponse =
    'Microsoft SQL Server 2019 (RTM) - 15.0.2000.5 (X64) \n\tSep 24 2019 13:48:23 \n\tCopyright (C) 2019 Microsoft Corporation\n\tExpress Edition (64-bit) on Windows Server 2019 Datacenter 10.0 <X64> (Build 17763: ) (Hypervisor)\n';
const tablesListResponse = [
    {
        tableName: 'Croats',
        tableType: 'USER_TABLE',
        tableSchema: 'dbo',
        tableSize: 270336
    },
    {
        tableName: 'Employee',
        tableType: 'USER_TABLE',
        tableSchema: 'dbo',
        tableSize: 73728
    },
    {
        tableName: 'Insomnia',
        tableType: 'USER_TABLE',
        tableSchema: 'dbo',
        tableSize: 59973632
    },
    {
        tableName: 'KnightRiders',
        tableType: 'USER_TABLE',
        tableSchema: 'dbo',
        tableSize: 57614336
    },
    {
        tableName: 'People',
        tableType: 'USER_TABLE',
        tableSchema: 'dbo',
        tableSize: 73728
    },
    {
        tableName: 'Riders',
        tableType: 'USER_TABLE',
        tableSchema: 'dbo',
        tableSize: 3416064
    },
    {
        tableName: 'Supes',
        tableType: 'USER_TABLE',
        tableSchema: 'dbo',
        tableSize: 270336
    }
];
const tablesSummaryResponse = {
    tables: [
        {
            tableName: 'Croats',
            tableType: 'USER_TABLE',
            tableSchema: 'dbo',
            tableSize: 270336,
            databaseName: 'Aaronview'
        },
        {
            tableName: 'Employee',
            tableType: 'USER_TABLE',
            tableSchema: 'dbo',
            tableSize: 73728,
            databaseName: 'Aaronview'
        },
        {
            tableName: 'Insomnia',
            tableType: 'USER_TABLE',
            tableSchema: 'dbo',
            tableSize: 59973632,
            databaseName: 'Aaronview'
        },
        {
            tableName: 'KnightRiders',
            tableType: 'USER_TABLE',
            tableSchema: 'dbo',
            tableSize: 57614336,
            databaseName: 'Aaronview'
        },
        {
            tableName: 'People',
            tableType: 'USER_TABLE',
            tableSchema: 'dbo',
            tableSize: 73728,
            databaseName: 'Aaronview'
        },
        {
            tableName: 'Riders',
            tableType: 'USER_TABLE',
            tableSchema: 'dbo',
            tableSize: 3416064,
            databaseName: 'Aaronview'
        },
        {
            tableName: 'Supes',
            tableType: 'USER_TABLE',
            tableSchema: 'dbo',
            tableSize: 270336,
            databaseName: 'Aaronview'
        }
    ]
};
const serverSummaryResponse = {
    serverId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
    serverVersion: '15.0.2000.5',
    serverEdition: 'Microsoft SQL Server 2019 (RTM)',
    serverEngine: 'Express Edition (64-bit)',
    serverStatus: 'Running.',
    activeConnections: 2,
    deploymentModel: 'Non-clustered',
    activeNode: 'EC2AMAZ-GAAT3OE',
    standbyNode: 'EC2AMAZ-GAAT3OE'
};
const mssqlRegistrationResponse = {
    resourceId: '5c791ae7-0e86-486b-8dc2-bafef485b875',
    resourceName: 'EC2AMAZ-GAAT3OE\\DBSIQN_SQL'
};

describe('MSSQL Resource methods', () => {
    it('Get memory utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.MEMORY);
        expect(resp).toEqual(getResourceUtilizationResponse);
    });

    it('Get cpu utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.CPU);
        expect(resp).toEqual(getResourceUtilizationResponse);
    });

    it('Get disk utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.DISK);
        expect(resp).toEqual(diskUtilizationResponse);
    });

    it('Get databases summary', async () => {
        const resp = await getDataBasesSummary('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(databaseSummaryResponse);
    });

    it('Get databases count', async () => {
        const resp = await getDatabasesCount(credentialsId, region, activeInstanceId, standbyInstanceId);
        expect(resp.totalCount).toEqual(7);
    });

    it('Get resource details ', async () => {
        const resp = await getResourceDetails('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(resourceDetailsResponse);
    });

    it('SSN execution method', async () => {
        const resp = await callSsmExecution(credentialsId, activeInstanceId, standbyInstanceId, region, commands);
        expect(resp.serverDetails).toEqual(ssmResponse);
    });

    it('Get DB summary ', async () => {
        const resp = await getDBSummary(credentialsId, region, activeInstanceId, standbyInstanceId, 0, 75);
        expect(resp).toEqual(databaseSummaryResponse.databases);
    });

    it('Get tables count', async () => {
        const resp = await getTablesCount(credentialsId, region, activeInstanceId, standbyInstanceId, 'Aaronview');
        expect(resp.totalCount).toEqual(7);
    });

    it('Get tables list ', async () => {
        const resp = await getTablesList(
            credentialsId,
            region,
            activeInstanceId,
            standbyInstanceId,
            0,
            75,
            'Aaronview'
        );
        expect(resp).toEqual(tablesListResponse);
    });

    it('Get tables summary ', async () => {
        const resp = await getTablesSummary('36E53042-04E8-40C9-AE69-26E56CB0D216', 'Aaronview');
        expect(resp).toEqual(tablesSummaryResponse);
    });

    it('Get tables summary ', async () => {
        const resp = await getServerSummary('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(serverSummaryResponse);
    });

    it('Discover MSSQL server ', async () => {
        const resp = await discoverMsSqlServer(
            'account-HwskUzae',
            credentialsId,
            region,
            activeInstanceId,
            standbyInstanceId,
            'mssql'
        );
        expect(resp).toEqual(mssqlRegistrationResponse);
    });
});
