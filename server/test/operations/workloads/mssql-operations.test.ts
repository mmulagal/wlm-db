import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ssm-scope';
import mssqlResponse from '../../simulator/responses/workload/mssql-operations-response.json';
import {
    ACCOUNT_ID,
    CREDENTIALS_ID,
    ACTIVE_INSTANCE_ID,
    STANDBY_INSTANCE_ID,
    DEFAULT_AWS_REGION
} from '../../utils/consts';
import { DATABASE_METRIC_TYPE } from '../../../src/utils/consts';
import {
    getDatabasesCount,
    getDataBasesSummary,
    getResourceUtilisation,
    getResourceDetails,
    getTablesCount,
    getTablesSummary,
    getServerSummary,
    discoverMsSqlServer
} from '../../../src/operations/workloads/mssql/mssql-operations';

// const credentialsId = `${faker.string.alphanumeric(20)}`;
// const activeInstanceId = `${faker.string.alphanumeric(10)}`;
// const standbyInstanceId = `${faker.string.alphanumeric(10)}`;
// const region = 'ap-southeast-1';

// const getResourceUtilizationResponse = {
//     percentUsed: 7,
//     used: 342859776,
//     total: 4294557696,
//     remaining: 3951697920
// };
// const diskUtilizationResponse = {
//     percentUsed: '0',
//     remaining: '39981088768',
//     total: '40128937984',
//     used: '147849216'
// };
// const databaseSummaryResponse = {
//     databases: [
//         {
//             databaseId: 224,
//             databaseName: 'Aaronview',
//             creationDate: '2023-04-11T17:49:55.340',
//             databaseStatus: 'ONLINE',
//             databaseSize: 16777216
//         },
//         {
//             databaseId: 120,
//             databaseName: 'North_Anna',
//             creationDate: '2023-04-11T17:43:27.590',
//             databaseStatus: 'ONLINE',
//             databaseSize: 16777216
//         },
//         {
//             databaseId: 136,
//             databaseName: 'North_Brandon',
//             creationDate: '2023-04-11T17:43:32.410',
//             databaseStatus: 'ONLINE',
//             databaseSize: 16777216
//         },
//         {
//             databaseId: 67,
//             databaseName: 'North_Brian',
//             creationDate: '2023-04-11T17:43:11.783',
//             databaseStatus: 'ONLINE',
//             databaseSize: 16777216
//         },
//         {
//             databaseId: 144,
//             databaseName: 'North_Clarence',
//             creationDate: '2023-04-11T17:43:34.893',
//             databaseStatus: 'ONLINE',
//             databaseSize: 16777216
//         },
//         {
//             databaseId: 133,
//             databaseName: 'North_Derek',
//             creationDate: '2023-04-11T17:43:31.547',
//             databaseStatus: 'ONLINE',
//             databaseSize: 16777216
//         },
//         {
//             databaseId: 61,
//             databaseName: 'North_Josephfort',
//             creationDate: '2023-04-11T17:43:10.043',
//             databaseStatus: 'ONLINE',
//             databaseSize: 16777216
//         }
//     ]
// };
// const resourceDetailsResponse = [
//     'f6082f35-c1db-4619-bb5c-84bcb5bf3286',
//     'ap-southeast-1',
//     'i-07e76a4b916548dc0',
//     'i-0880a21327284f67c'
// ];
// const tablesSummaryResponse = {
//     tables: [
//         {
//             tableName: 'Croats',
//             tableType: 'USER_TABLE',
//             tableSchema: 'dbo',
//             tableSize: 270336,
//             databaseName: 'Aaronview'
//         },
//         {
//             tableName: 'Employee',
//             tableType: 'USER_TABLE',
//             tableSchema: 'dbo',
//             tableSize: 73728,
//             databaseName: 'Aaronview'
//         },
//         {
//             tableName: 'Insomnia',
//             tableType: 'USER_TABLE',
//             tableSchema: 'dbo',
//             tableSize: 59973632,
//             databaseName: 'Aaronview'
//         },
//         {
//             tableName: 'KnightRiders',
//             tableType: 'USER_TABLE',
//             tableSchema: 'dbo',
//             tableSize: 57614336,
//             databaseName: 'Aaronview'
//         },
//         {
//             tableName: 'People',
//             tableType: 'USER_TABLE',
//             tableSchema: 'dbo',
//             tableSize: 73728,
//             databaseName: 'Aaronview'
//         },
//         {
//             tableName: 'Riders',
//             tableType: 'USER_TABLE',
//             tableSchema: 'dbo',
//             tableSize: 3416064,
//             databaseName: 'Aaronview'
//         },
//         {
//             tableName: 'Supes',
//             tableType: 'USER_TABLE',
//             tableSchema: 'dbo',
//             tableSize: 270336,
//             databaseName: 'Aaronview'
//         }
//     ]
// };
// const serverSummaryResponse = {
//     serverId: '36E53042-04E8-40C9-AE69-26E56CB0D216',
//     serverVersion: '13.0.6404.1',
//     serverEdition: 'Microsoft SQL Server 2016 (SP3-OD) (KB5006943)',
//     serverEngine: 'Standard Edition (64-bit)',
//     serverStatus: 'Running',
//     activeConnections: 8,
//     deploymentModel: 'Always On Failover Cluster Instance',
//     activeNode: 'SQLNODE1-39362',
//     standbyNode: 'SQLNODE2-39362'
// };
// const mssqlRegistrationResponse = {
//     resourceId: '5c791ae7-0e86-486b-8dc2-bafef485b875',
//     resourceName: 'EC2AMAZ-GAAT3OE\\DUMMY_SQL'
// };

describe('MSSQL Resource methods', () => {
    it('Get memory utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.MEMORY);
        expect(resp).toEqual(mssqlResponse.getResourceUtilizationResponse);
    });

    it('Get cpu utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.CPU);
        expect(resp).toEqual(mssqlResponse.getResourceUtilizationResponse);
    });

    it('Get disk utilization', async () => {
        const resp = await getResourceUtilisation('36E53042-04E8-40C9-AE69-26E56CB0D216', DATABASE_METRIC_TYPE.DISK);
        expect(resp).toEqual(mssqlResponse.diskUtilizationResponse);
    });

    it('Get databases summary', async () => {
        const resp = await getDataBasesSummary('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(mssqlResponse.databaseSummaryResponse);
    });

    it('Get databases count', async () => {
        const resp = await getDatabasesCount(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ACTIVE_INSTANCE_ID,
            STANDBY_INSTANCE_ID
        );
        expect(resp.totalCount).toEqual(7);
    });

    it('Get resource details ', async () => {
        const resp = await getResourceDetails('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(mssqlResponse.resourceDetailsResponse);
    });

    it('Get tables count', async () => {
        const resp = await getTablesCount(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ACTIVE_INSTANCE_ID,
            STANDBY_INSTANCE_ID,
            'Aaronview'
        );
        expect(resp.totalCount).toEqual(7);
    });

    it('Get tables summary ', async () => {
        const resp = await getTablesSummary('36E53042-04E8-40C9-AE69-26E56CB0D216', 'Aaronview');
        expect(resp).toEqual(mssqlResponse.tablesSummaryResponse);
    });

    it('Get Server summary ', async () => {
        const resp = await getServerSummary('36E53042-04E8-40C9-AE69-26E56CB0D216');
        expect(resp).toEqual(mssqlResponse.serverSummaryResponse);
    });

    it('Discover MSSQL server ', async () => {
        const resp = await discoverMsSqlServer(
            ACCOUNT_ID,
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            ACTIVE_INSTANCE_ID,
            STANDBY_INSTANCE_ID,
            'mssql'
        );
        expect(resp).toEqual(mssqlResponse.mssqlRegistrationResponse);
    });
});
