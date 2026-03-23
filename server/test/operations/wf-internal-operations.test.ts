import { STORAGE_TYPE } from '@prisma/client';
import type { MockInstance } from 'vitest';
import {
    createResource,
    deleteResource,
    upsertDatabaseInstance,
    deleteDatabaseInstance
} from '../../src/lib/database/db';
import { getFocusStatus, getSystemStatus, getWidgetStatus } from '../../src/operations/wf-internal-operations';
import { DEFAULT_AWS_CREDENTIALS_ID } from '../utils/consts';
import { prisma } from '../../src/utils/prisma-utils';
import { ACCOUNTID } from '../../src/utils/consts';

describe('WF Internal Operations', () => {
    it.skip('Get system status- no resource', async () => {
        // Its not mocked as we are making actual api call
        const resp = await getSystemStatus('empty-test');
        expect(resp.isActive).toEqual(false);
    });

    it.skip('Get system status - resource present', async () => {
        // Since we are not checking status based on resources skipping the test
        await deleteResource('account-with-resource', 'i-1a2b3c4d5e');
        await createResource('account-with-resource', {
            resourceId: 'i-1a2b3c4d5e',
            resourceName: 'sqlnode1',
            resourceType: 'MSSQL',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            coRelationId: 'fsx-1234',
            region: 'DEFAULT_AWS_REGION',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: STORAGE_TYPE.FSXN
        });
        const resp = await getSystemStatus('account-with-resource');
        expect(resp.isActive).toEqual(true);
        await deleteResource('account-with-resource', 'i-1a2b3c4d5e');
    });
});

describe('Homepage status operations', () => {
    let queryRawSpy: MockInstance;

    beforeAll(async () => {
        await createResource(ACCOUNTID, {
            region: 'us-east-1',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            resourceType: 'MSSQL',
            resourceId: 'i-homepage-status-test-1',
            storageType: STORAGE_TYPE.EBS
        });
        await createResource(ACCOUNTID, {
            region: 'us-east-1',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            resourceType: 'ORACLE',
            resourceId: 'i-homepage-status-test-2',
            storageType: STORAGE_TYPE.FSXN
        });
        await createResource(ACCOUNTID, {
            region: 'us-east-1',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            resourceType: 'PGSQL',
            resourceId: 'i-homepage-status-test-3',
            storageType: STORAGE_TYPE.FSXW
        });
        await createResource(ACCOUNTID, {
            region: 'us-west-1',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            resourceType: 'MSSQL',
            resourceId: 'i-homepage-status-test-4',
            storageType: STORAGE_TYPE.FSXN
        });

        // Mock $queryRaw to return a specific value
        queryRawSpy = vi.spyOn(prisma.client, '$queryRaw').mockResolvedValue([
            {
                name: 'autosize-mode',
                severity: 'critical',
                count: 2,
                resourceNames: 'test-resource-1,test-resource-2'
            },
            {
                name: 'autosize',
                severity: 'critical',
                count: 4,
                resourceNames: 'test-resource-3,test-resource-4'
            },
            {
                name: 'tiering-policy',
                severity: 'warning',
                count: 7,
                resourceNames: 'test-resource-5'
            }
        ]);
    });

    afterAll(async () => {
        await deleteResource(ACCOUNTID, 'i-homepage-status-test-1');
        await deleteResource(ACCOUNTID, 'i-homepage-status-test-2');
        await deleteResource(ACCOUNTID, 'i-homepage-status-test-3');
        await deleteResource(ACCOUNTID, 'i-homepage-status-test-4');
        queryRawSpy.mockRestore();
    });

    test('Get homepage widget status', async () => {
        const {
            items: [{ data }]
        } = await getWidgetStatus(ACCOUNTID);
        expect(data?.length).toEqual(3);
        const mssqlData = data.find(item => item.id === 'mssql');
        expect(mssqlData?.value).toBeTypeOf('number');
        const oracleData = data.find(item => item.id === 'oracle');
        expect(oracleData?.value).toBeTypeOf('number');
        const pgsqlData = data.find(item => item.id === 'pgsql');
        expect(pgsqlData?.value).toBeTypeOf('number');
    });

    test('Get homepage widget status with a region', async () => {
        const {
            items: [{ data }]
        } = await getWidgetStatus(ACCOUNTID, undefined, 'us-east-1');
        expect(data?.length).toEqual(3);
    });

    test('Get homepage focus status', async () => {
        const { items, totalItems, severity } = await getFocusStatus(ACCOUNTID);
        expect(items?.length).toBeGreaterThan(0);
        expect(totalItems).toEqual(6);
        expect(severity).toEqual('high');
        items.forEach(item => {
            expect(item.description).toBeTruthy();
            expect(item.label).toBeTruthy();
            expect(item.key).toBeTruthy();
            expect(Array.isArray(item.resources)).toBe(true);
            item.resources!.forEach(r => expect(r.name).toBeTruthy());
        });
    });

    test('Get homepage focus status with a limit of 7', async () => {
        const { items, totalItems, severity } = await getFocusStatus(ACCOUNTID, undefined, undefined, 7);
        expect(totalItems).toEqual(6);
        expect(severity).toEqual('high');
        items.forEach(item => {
            expect(item.description).toBeTruthy();
            expect(item.label).toBeTruthy();
            expect(item.key).toBeTruthy();
            expect(Array.isArray(item.resources)).toBe(true);
        });
    });

    test('Get homepage focus status with a limit of 5', async () => {
        const { items, totalItems, severity } = await getFocusStatus(ACCOUNTID, undefined, undefined, 5);
        expect(totalItems).toEqual(6);
        expect(severity).toEqual('high');
        expect(items.length).toBeLessThanOrEqual(5);
        const uniqueKeys = new Set(items.map(item => item.key));
        expect(uniqueKeys.size).toEqual(items.length);
        items.forEach(item => {
            expect(item.description).toBeTruthy();
            expect(item.label).toBeTruthy();
            expect(item.key).toBeTruthy();
            expect(Array.isArray(item.resources)).toBe(true);
        });
    });
});

describe('getFocusStatus - assessment not run warning', () => {
    const TEST_ACCOUNT_ID = 'account-assessment-warning-test';
    const TEST_RESOURCE_ID = 'resource-assessment-warning-test';
    const TEST_INSTANCE_ID = 'i-assessment-warning-test';
    let queryRawSpy: MockInstance;
    let aggregateSpy: MockInstance;
    let nodeEnvironment: string;

    beforeAll(async () => {
        nodeEnvironment = process.env.NODE_ENV || 'demo';
        process.env.NODE_ENV = 'local_dev';
        // Create a database instance without any assessment results
        await upsertDatabaseInstance(TEST_ACCOUNT_ID, {
            databaseInstanceId: TEST_INSTANCE_ID,
            databaseInstanceName: 'test-instance',
            resourceId: TEST_RESOURCE_ID,
            region: 'us-east-1',
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            databaseType: 'MSSQL',
            fsxnIds: '',
            isDefault: false,
            source: 'wlmdb',
            sqlDeploymentType: 'standalone',
            fsxSvmId: {}
        });

        // Mock $queryRaw to return empty array (no severity items from assessment)
        queryRawSpy = vi.spyOn(prisma.client, '$queryRaw').mockResolvedValue([]);

        // Mock aggregate to return 0 instances with assessment results (prismock limitation)
        aggregateSpy = vi.spyOn(prisma.client.database_instances, 'aggregate').mockResolvedValue({
            _count: { id: 0 },
            _avg: {},
            _sum: {},
            _min: {},
            _max: {}
        });
    });

    afterAll(async () => {
        queryRawSpy.mockRestore();
        aggregateSpy.mockRestore();
        // Clean up test data
        await deleteDatabaseInstance(TEST_ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, TEST_RESOURCE_ID, [TEST_INSTANCE_ID]);
        // Reset the node environemnt variable
        process.env.NODE_ENV = nodeEnvironment;
    });

    test('should return info severity when database instances exist but no assessment results', async () => {
        const { items, totalItems, severity, noAnalysis } = await getFocusStatus(TEST_ACCOUNT_ID);
        expect(severity).toEqual('info');
        expect(noAnalysis).toBe(true);
        expect(totalItems).toEqual(0);
        expect(items.length).toEqual(1);
        expect(items[0].description).toContain('well-architected');
        expect(items[0].label).toBeUndefined();
        expect(items[0].resources).toBeUndefined();
    });
});
