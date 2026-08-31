import {
    getHostAndSqlServerInfo,
    discoverPgSqlResources,
    discoverOracleResources,
    markManagedSqlInstances
} from '../../src/operations/discover-operations';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';

type SqlInstanceFixture = Pick<
    Parameters<typeof markManagedSqlInstances>[0][number],
    'database_instance_id' | 'database_instance_name'
> &
    Partial<Pick<Parameters<typeof markManagedSqlInstances>[0][number], 'database_type' | 'resource_id'>>;

const markManaged = (
    discovered: SqlInstanceFixture[],
    managed: SqlInstanceFixture[],
    hostResourceIds?: string[]
): Array<boolean | undefined> =>
    markManagedSqlInstances(
        discovered as unknown as Parameters<typeof markManagedSqlInstances>[0],
        managed as unknown as Parameters<typeof markManagedSqlInstances>[1],
        hostResourceIds
    ).map(instance => instance.isManaged);

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

describe('Discover operations: managed state of discovered SQL instances', () => {
    const discoveredInstances: SqlInstanceFixture[] = [
        { database_instance_id: 'guid-1', database_instance_name: 'MSSQLSERVER' },
        { database_instance_id: 'guid-2', database_instance_name: 'REPORTING' }
    ];
    const managedInstances: SqlInstanceFixture[] = [
        { database_instance_id: 'guid-1', database_instance_name: 'MSSQLSERVER', resource_id: 'wlmdb-host-1' },
        { database_instance_id: 'guid-2', database_instance_name: 'REPORTING', resource_id: 'wlmdb-host-2' }
    ];
    const withoutGuid: SqlInstanceFixture[] = [{ database_instance_id: '', database_instance_name: 'mssqlserver' }];

    const managedStates = (managedRecords: SqlInstanceFixture[]) => markManaged(discoveredInstances, managedRecords);

    it('reports every instance as unmanaged when there are no wlmdb records', () => {
        expect(managedStates([])).toEqual([false, false]);
    });

    it('reports only the registered instance as managed', () => {
        expect(managedStates([managedInstances[0]])).toEqual([true, false]);
    });

    it('reports every instance as managed when all of them are registered', () => {
        expect(managedStates(managedInstances)).toEqual([true, true]);
    });

    it('matches on instance name when the server GUID is unavailable', () => {
        expect(markManaged(withoutGuid, managedInstances, ['wlmdb-host-1'])).toEqual([true]);
    });

    it('does not match an instance name from another host when the server GUID is unavailable', () => {
        expect(markManaged(withoutGuid, managedInstances, ['wlmdb-host-2'])).toEqual([false]);
    });

    it('does not match on instance name when the host has no wlmdb record', () => {
        expect(markManaged(withoutGuid, managedInstances)).toEqual([false]);
    });

    it('ignores managed records belonging to another database type', () => {
        const oracleRecords = managedInstances.map(instance => ({ ...instance, database_type: 'ORACLE' }));

        expect(managedStates(oracleRecords)).toEqual([false, false]);
    });

    it('considers records typed as MSSQL and records registered without a type', () => {
        const [mssqlRecord, untypedRecord] = [{ ...managedInstances[0], database_type: 'MSSQL' }, managedInstances[1]];

        expect(managedStates([mssqlRecord, untypedRecord])).toEqual([true, true]);
    });

    it('matches server GUIDs regardless of casing', () => {
        const upperCaseGuid: SqlInstanceFixture[] = [
            { database_instance_id: 'GUID-1', database_instance_name: 'MSSQLSERVER' }
        ];

        expect(markManaged(upperCaseGuid, managedInstances)).toEqual([true]);
    });
});

describe('Discover operations: AOAG Standalone', () => {
    it('should return AOAG details for AOAG standalone instances', async () => {
        const response = await getHostAndSqlServerInfo(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 20);
        const aoagInstance = response.items.find(
            item =>
                item.sqlServerInstances?.[0]?.sqlServerDeploymentType === 'AOAG' &&
                item.sqlServerInstances?.[0]?.aoagDetails !== undefined
        );
        expect(aoagInstance).toBeDefined();
        expect(aoagInstance?.sqlServerInstances?.[0]?.aoagDetails).toBeDefined();
        expect(aoagInstance?.sqlServerInstances?.[0]?.aoagClusterNodeDetails).toBeDefined();
        expect(aoagInstance?.sqlServerInstances?.[0]?.aoagClusterNodeDetails?.length).toBeGreaterThan(0);
    }, 10000);

    it('should return aoagClusterNodeDetails with required fields', async () => {
        const response = await getHostAndSqlServerInfo(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, 20);
        const aoagInstance = response.items.find(
            item =>
                item.sqlServerInstances?.[0]?.sqlServerDeploymentType === 'AOAG' &&
                item.sqlServerInstances?.[0]?.aoagClusterNodeDetails !== undefined
        );
        const clusterNodeDetails = aoagInstance?.sqlServerInstances?.[0]?.aoagClusterNodeDetails?.[0];
        expect(clusterNodeDetails?.node).toBeDefined();
        expect(clusterNodeDetails?.ip).toBeDefined();
        expect(clusterNodeDetails?.ec2InstanceId).toBeDefined();
    }, 10000);
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
