import {
    getHostAndSqlServerInfo,
    discoverPgSqlResources,
    discoverOracleResources
} from '../../src/operations/discover-operations';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';

describe('Discover operations', () => {
    it('Get host and SQL Server instance details', async () => {
        const response = await getHostAndSqlServerInfo(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 10);
        expect(response).toBeDefined();
    }, 10000);

    // it('Manage an EC2 hosting SQL Server: No SSM connectivity)', async () => {
    //     try {
    //         await manageSqlServer(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 'i-1d9i5v18g5392mf1v');
    //     } catch (error: any) {
    //         expect(error.message).toEqual(
    //             // eslint-disable-next-line quotes
    //             "Unable to manage instance 'i-1d9i5v18g5392mf1v'. Reason: no SSM connectivity."
    //         );
    //     }
    // });
});

describe('Discover operations: PGSQL', () => {
    it('Discover EC2 instances hosting PostgreSQL Server', async () => {
        const response = await discoverPgSqlResources(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 10);
        const connectedResources = response.items.find(item => item.ssmState === 'connected');
        expect(connectedResources?.pgsqlServerInstances?.[0]?.pgsqlServerVersion).toEqual('psql (PostgreSQL) 16.5');
        expect(response).toBeDefined();
    });
});

describe('Discover operations: Oracle', () => {
    it('Discover EC2 instances hosting Oracle Server', async () => {
        const response = await discoverOracleResources(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 10);
        const connectedResources = response.items.find(item => item.ssmState === 'connected');
        expect(connectedResources?.databaseInstanceDetails).toBeDefined();
        expect(response).toBeDefined();
    });
});
