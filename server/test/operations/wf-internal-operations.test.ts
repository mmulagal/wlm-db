import { DATABASE_TYPE, STORAGE_TYPE } from '@prisma/client';
import type { MockInstance } from 'vitest';
import {
    createResource,
    deleteResource,
    upsertDatabaseInstance,
    deleteDatabaseInstance
} from '../../src/lib/database/db';
import {
    getFocusWadStatus,
    getLogsAnalysisStatus,
    getSystemStatus,
    getWidgetStatus,
    DEFAULT_WIDGET_LIMIT
} from '../../src/operations/wf-internal-operations';
import { DEMO_FOCUS_EVENT_ITEMS, DEMO_FOCUS_WAD_ITEMS } from '../../src/utils/demo-utils/demoMockdata';
import { DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../utils/consts';
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
    let nodeEnvironment: string;

    beforeAll(async () => {
        nodeEnvironment = process.env.NODE_ENV || 'demo';
        process.env.NODE_ENV = 'local_dev';
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
                resourceNames: 'test-resource-1,test-resource-2',
                engineType: 'MSSQL'
            },
            {
                name: 'autosize',
                severity: 'critical',
                count: 4,
                resourceNames: 'test-resource-3,test-resource-4',
                engineType: 'ORACLE'
            },
            {
                name: 'tiering-policy',
                severity: 'warning',
                count: 7,
                resourceNames: 'test-resource-5',
                engineType: 'PGSQL'
            }
        ]);
    });

    afterAll(async () => {
        await deleteResource(ACCOUNTID, 'i-homepage-status-test-1');
        await deleteResource(ACCOUNTID, 'i-homepage-status-test-2');
        await deleteResource(ACCOUNTID, 'i-homepage-status-test-3');
        await deleteResource(ACCOUNTID, 'i-homepage-status-test-4');
        queryRawSpy.mockRestore();
        process.env.NODE_ENV = nodeEnvironment;
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
        const { items, totalItems, severity } = await getFocusWadStatus(ACCOUNTID);
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
        const { items, totalItems, severity } = await getFocusWadStatus(ACCOUNTID, undefined, undefined, 7);
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
        const { items, totalItems, severity } = await getFocusWadStatus(ACCOUNTID, undefined, undefined, 5);
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

    test('Get homepage focus status should include path field', async () => {
        const { items } = await getFocusWadStatus(ACCOUNTID);
        expect(items.length).toBeGreaterThan(0);
        items.forEach(item => {
            expect(item.path).toBeTruthy();
            expect(item.path).toMatch(/^\/databases\/well-architected\/configName\/.*\/engineType\//);
        });
    });

    test('Get homepage focus status path should contain configName and engineType', async () => {
        const { items } = await getFocusWadStatus(ACCOUNTID);
        items.forEach(item => {
            expect(item.path).toBeDefined();
            const pathParts = item.path!.split('/');
            const configNameIndex = pathParts.indexOf('configName');
            const engineTypeIndex = pathParts.indexOf('engineType');
            expect(configNameIndex).toBeGreaterThan(-1);
            expect(engineTypeIndex).toBeGreaterThan(-1);
            expect(engineTypeIndex).toBeGreaterThan(configNameIndex);
            // Verify there's a value after configName
            expect(pathParts[configNameIndex + 1]).toBeTruthy();
            // Verify there's a value after engineType
            expect(pathParts[engineTypeIndex + 1]).toBeTruthy();
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
        const { items, totalItems, severity, noAnalysis } = await getFocusWadStatus(TEST_ACCOUNT_ID);
        expect(severity).toEqual('info');
        expect(noAnalysis).toBe(true);
        expect(totalItems).toEqual(0);
        expect(items.length).toEqual(0);
    });
});

describe('getLogsAnalysisStatus - happy path', () => {
    const TEST_ACCOUNT_ID = 'account-logs-status-test';
    const TEST_RESOURCE_ID = 'resource-logs-status-test';
    const TEST_INSTANCE_ID = 'db-instance-logs-status-test';
    const TEST_INSTANCE_NAME = 'MSSQLSERVER';
    let queryRawSpy: MockInstance;
    let nodeEnvironment: string;

    beforeAll(async () => {
        nodeEnvironment = process.env.NODE_ENV || 'demo';
        process.env.NODE_ENV = 'local_dev';

        await createResource(TEST_ACCOUNT_ID, {
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            resourceType: 'MSSQL',
            resourceId: TEST_RESOURCE_ID,
            storageType: STORAGE_TYPE.FSXN
        });
        await upsertDatabaseInstance(TEST_ACCOUNT_ID, {
            databaseInstanceId: TEST_INSTANCE_ID,
            databaseInstanceName: TEST_INSTANCE_NAME,
            resourceId: TEST_RESOURCE_ID,
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            databaseType: 'MSSQL',
            fsxnIds: '',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'standalone',
            fsxSvmId: {}
        });

        queryRawSpy = vi.spyOn(prisma.client, '$queryRaw').mockResolvedValue([
            {
                database_instance_id: TEST_INSTANCE_ID,
                resource_id: TEST_RESOURCE_ID,
                database_type: DATABASE_TYPE.mssql,
                database_instance_name: TEST_INSTANCE_NAME,
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'testhost.example.com',
                recommendations: [
                    {
                        error: 'Error: 25607, Severity: 24, State: 1.',
                        errorCode: '25607',
                        severity: '24',
                        uniqueErrorKey: '25607'
                    },
                    {
                        error: 'Error: 605, Severity: 21, State: 3.',
                        errorCode: '605',
                        severity: '21',
                        uniqueErrorKey: '605'
                    }
                ]
            }
        ]);
    });

    afterAll(async () => {
        queryRawSpy.mockRestore();
        await deleteDatabaseInstance(TEST_ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, TEST_RESOURCE_ID, [TEST_INSTANCE_ID]);
        await deleteResource(TEST_ACCOUNT_ID, TEST_RESOURCE_ID);
        process.env.NODE_ENV = nodeEnvironment;
    });

    test('should return high severity with unique errors and resources', async () => {
        const { items, totalItems, severity } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        expect(severity).toEqual('high');
        expect(totalItems).toEqual(2);
        expect(items.length).toEqual(2);
        items.forEach(item => {
            expect(item.description).toBeTruthy();
            expect(item.key).toBeTruthy();
            expect(item.label).toEqual(item.key);
            expect(Array.isArray(item.resources)).toBe(true);
            item.resources!.forEach(r => expect(r.name).toBeTruthy());
        });
    });

    test('should format MSSQL error key correctly', async () => {
        const { items } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        const firstItem = items[0];
        expect(firstItem.key).toMatch(/^Error: \d+, Severity: \d+, State: \d+$/);
    });

    test('should include deep-link href in resources', async () => {
        const { items } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        items.forEach(item => {
            item.resources?.forEach(resource => {
                expect(resource.href).toBeDefined();
                const href = resource.href as string;
                expect(href).toContain(`/databases/inventory/cred/${DEFAULT_AWS_CREDENTIALS_ID}`);
                expect(href).toContain(`/region/${DEFAULT_AWS_REGION}`);
                expect(href).toContain(`/databaseHost/${TEST_RESOURCE_ID}`);
                expect(href).toContain(`/databaseInstance/${TEST_INSTANCE_ID}`);
                expect(href).toContain('/logAnalyzerStatus/active');
                expect(href).toContain(`/engineType/${DATABASE_TYPE.mssql}`);
                expect(href).toContain('/hostname/testhost.example.com');
                expect(href).toContain(`/dbInstanceName/${TEST_INSTANCE_NAME}`);
            });
        });
    });

    test('should respect the limit parameter', async () => {
        const { items, totalItems } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID, undefined, undefined, 1);
        expect(totalItems).toEqual(2);
        expect(items.length).toEqual(1);
    });

    test('should include resource names for each error', async () => {
        const { items } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        items.forEach(item => {
            expect(item.resources).toBeDefined();
            expect(item.resources!.some(r => r.name === TEST_INSTANCE_NAME)).toBe(true);
        });
    });
});

describe('getLogsAnalysisStatus - no logs analysis performed', () => {
    const TEST_ACCOUNT_ID = 'account-logs-no-analysis-test';
    const TEST_RESOURCE_ID = 'resource-logs-no-analysis-test';
    const TEST_INSTANCE_ID = 'db-instance-logs-no-analysis-test';
    let queryRawSpy: MockInstance;
    let nodeEnvironment: string;

    beforeAll(async () => {
        nodeEnvironment = process.env.NODE_ENV || 'demo';
        process.env.NODE_ENV = 'local_dev';

        await createResource(TEST_ACCOUNT_ID, {
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            resourceType: 'MSSQL',
            resourceId: TEST_RESOURCE_ID,
            storageType: STORAGE_TYPE.FSXN
        });
        await upsertDatabaseInstance(TEST_ACCOUNT_ID, {
            databaseInstanceId: TEST_INSTANCE_ID,
            databaseInstanceName: 'MSSQLSERVER',
            resourceId: TEST_RESOURCE_ID,
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            databaseType: 'MSSQL',
            fsxnIds: '',
            isDefault: true,
            source: 'deployment',
            sqlDeploymentType: 'standalone',
            fsxSvmId: {}
        });

        queryRawSpy = vi.spyOn(prisma.client, '$queryRaw').mockResolvedValue([]);
    });

    afterAll(async () => {
        queryRawSpy.mockRestore();
        await deleteDatabaseInstance(TEST_ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, TEST_RESOURCE_ID, [TEST_INSTANCE_ID]);
        await deleteResource(TEST_ACCOUNT_ID, TEST_RESOURCE_ID);
        process.env.NODE_ENV = nodeEnvironment;
    });

    test('should return info severity and noAnalysis flag when resources exist but no reports', async () => {
        const { items, totalItems, severity, noAnalysis } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        expect(severity).toEqual('info');
        expect(noAnalysis).toBe(true);
        expect(totalItems).toEqual(0);
        expect(items.length).toEqual(0);
    });
});

describe('getLogsAnalysisStatus - deduplication across instances', () => {
    const TEST_ACCOUNT_ID = 'account-logs-dedup-test';
    let queryRawSpy: MockInstance;
    let nodeEnvironment: string;

    beforeAll(() => {
        nodeEnvironment = process.env.NODE_ENV || 'demo';
        process.env.NODE_ENV = 'local_dev';

        queryRawSpy = vi.spyOn(prisma.client, '$queryRaw').mockResolvedValue([
            {
                database_instance_id: 'db-instance-dedup-1',
                resource_id: 'resource-dedup-1',
                database_type: DATABASE_TYPE.mssql,
                database_instance_name: 'INSTANCE1',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host-dedup-1.example.com',
                recommendations: [
                    {
                        error: 'Error: 605, Severity: 21, State: 3.',
                        errorCode: '605',
                        severity: '18',
                        uniqueErrorKey: '605'
                    }
                ]
            },
            {
                database_instance_id: 'db-instance-dedup-2',
                resource_id: 'resource-dedup-2',
                database_type: DATABASE_TYPE.mssql,
                database_instance_name: 'INSTANCE2',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host-dedup-2.example.com',
                recommendations: [
                    {
                        error: 'Error: 605, Severity: 21, State: 3.',
                        errorCode: '605',
                        severity: '18',
                        uniqueErrorKey: '605'
                    }
                ]
            }
        ]);
    });

    afterAll(() => {
        queryRawSpy.mockRestore();
        process.env.NODE_ENV = nodeEnvironment;
    });

    test('should deduplicate the same error across multiple instances and accumulate count', async () => {
        const { items, totalItems, severity } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        expect(severity).toEqual('high');
        expect(totalItems).toEqual(1);
        expect(items.length).toEqual(1);
        expect(items[0].resources!.length).toEqual(2);
        const resourceNames = items[0].resources!.map(r => r.name);
        expect(resourceNames).toContain('INSTANCE1');
        expect(resourceNames).toContain('INSTANCE2');
    });
});

describe('getLogsAnalysisStatus - description precedence (error over cause)', () => {
    const TEST_ACCOUNT_ID = 'account-logs-desc-precedence-test';
    let queryRawSpy: MockInstance;
    let nodeEnvironment: string;

    beforeAll(() => {
        nodeEnvironment = process.env.NODE_ENV || 'demo';
        process.env.NODE_ENV = 'local_dev';

        queryRawSpy = vi.spyOn(prisma.client, '$queryRaw').mockResolvedValue([
            {
                database_instance_id: 'db-instance-desc-1',
                resource_id: 'resource-desc-1',
                database_type: DATABASE_TYPE.mssql,
                database_instance_name: 'INSTANCE1',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host-desc.example.com',
                recommendations: [
                    {
                        error: 'Original error message',
                        cause: 'AI explanation cause text',
                        errorCode: '605',
                        severity: '21',
                        uniqueErrorKey: '605'
                    }
                ]
            }
        ]);
    });

    afterAll(() => {
        queryRawSpy.mockRestore();
        process.env.NODE_ENV = nodeEnvironment;
    });

    test('should use cause for MSSQL description when both error and cause present', async () => {
        const { items } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        expect(items[0].description).toEqual('AI explanation cause text');
    });

    test('should fall back to cause when error is missing', async () => {
        queryRawSpy.mockResolvedValueOnce([
            {
                database_instance_id: 'db-instance-desc-2',
                resource_id: 'resource-desc-2',
                database_type: DATABASE_TYPE.mssql,
                database_instance_name: 'INSTANCE2',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host-desc.example.com',
                recommendations: [
                    {
                        error: '',
                        cause: 'AI explanation cause text',
                        errorCode: '605',
                        severity: '21',
                        uniqueErrorKey: '605'
                    }
                ]
            }
        ]);
        const { items } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        expect(items[0].description).toEqual('AI explanation cause text');
    });
});

describe('getLogsAnalysisStatus - analysis ran with no errors', () => {
    const TEST_ACCOUNT_ID = 'account-logs-no-errors-test';
    let queryRawSpy: MockInstance;
    let nodeEnvironment: string;

    beforeAll(() => {
        nodeEnvironment = process.env.NODE_ENV || 'demo';
        process.env.NODE_ENV = 'local_dev';

        queryRawSpy = vi.spyOn(prisma.client, '$queryRaw').mockResolvedValue([
            {
                database_instance_id: 'db-instance-no-errors-1',
                resource_id: 'resource-no-errors-1',
                database_type: DATABASE_TYPE.mssql,
                database_instance_name: 'INSTANCE1',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host-no-errors.example.com',
                recommendations: []
            }
        ]);
    });

    afterAll(() => {
        queryRawSpy.mockRestore();
        process.env.NODE_ENV = nodeEnvironment;
    });

    test('should return low severity when analysis ran but no errors found', async () => {
        const { items, totalItems, severity } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        expect(severity).toEqual('low');
        expect(totalItems).toEqual(0);
        expect(items.length).toEqual(0);
    });
});

describe('getFocusWadStatus - demo flow demoLimit branch', () => {
    test('should return demo items with default limit when no limit is provided', async () => {
        const { items, totalItems, severity } = await getFocusWadStatus('demo-account');
        expect(severity).toEqual('medium');
        expect(items.length).toEqual(DEFAULT_WIDGET_LIMIT);
        expect(totalItems).toEqual(DEFAULT_WIDGET_LIMIT);
        items.forEach(item => {
            expect(item.description).toBeTruthy();
            expect(item.key).toBeTruthy();
        });
    });

    test('should respect an explicit limit smaller than DEMO_FOCUS_WAD_ITEMS length', async () => {
        const { items, totalItems, severity } = await getFocusWadStatus('demo-account', undefined, undefined, 3);
        expect(severity).toEqual('medium');
        expect(items.length).toEqual(3);
        expect(totalItems).toEqual(3);
    });

    test('should return all demo items when limit equals DEMO_FOCUS_WAD_ITEMS length', async () => {
        const fullLength = DEMO_FOCUS_WAD_ITEMS.length;
        const { items, totalItems } = await getFocusWadStatus('demo-account', undefined, undefined, fullLength);
        expect(items.length).toEqual(fullLength);
        expect(totalItems).toEqual(fullLength);
    });

    test('should return all demo items when limit exceeds DEMO_FOCUS_WAD_ITEMS length', async () => {
        const fullLength = DEMO_FOCUS_WAD_ITEMS.length;
        const { items, totalItems } = await getFocusWadStatus('demo-account', undefined, undefined, 100);
        expect(items.length).toEqual(fullLength);
        expect(totalItems).toEqual(fullLength);
    });

    test('demo items should match the expected shape from DEMO_FOCUS_WAD_ITEMS', async () => {
        const { items } = await getFocusWadStatus('demo-account', undefined, undefined, 2);
        const expectedSlice = DEMO_FOCUS_WAD_ITEMS.slice(0, 2);
        expect(items).toEqual(expectedSlice);
    });
});

describe('getLogsAnalysisStatus - demo flow demoLimit branch', () => {
    test('should use default limit of 5 when no limit is provided', async () => {
        const { items, totalItems, severity } = await getLogsAnalysisStatus('demo-account');
        expect(severity).toEqual('medium');
        expect(items.length).toEqual(DEMO_FOCUS_EVENT_ITEMS.length);
        expect(totalItems).toEqual(DEMO_FOCUS_EVENT_ITEMS.length);
        items.forEach(item => {
            expect(item.description).toBeTruthy();
            expect(item.key).toBeTruthy();
        });
    });

    test('should respect an explicit limit smaller than DEMO_FOCUS_EVENT_ITEMS length', async () => {
        const { items, totalItems, severity } = await getLogsAnalysisStatus('demo-account', undefined, undefined, 2);
        expect(severity).toEqual('medium');
        expect(items.length).toEqual(2);
        expect(totalItems).toEqual(2);
    });

    test('limit of 1 returns exactly 1 item', async () => {
        const { items, totalItems } = await getLogsAnalysisStatus('demo-account', undefined, undefined, 1);
        expect(items.length).toEqual(1);
        expect(totalItems).toEqual(1);
    });

    test('should return all demo items when limit equals DEMO_FOCUS_EVENT_ITEMS length', async () => {
        const fullLength = DEMO_FOCUS_EVENT_ITEMS.length;
        const { items, totalItems } = await getLogsAnalysisStatus('demo-account', undefined, undefined, fullLength);
        expect(items.length).toEqual(fullLength);
        expect(totalItems).toEqual(fullLength);
    });

    test('should return all demo items when limit exceeds DEMO_FOCUS_EVENT_ITEMS length', async () => {
        const fullLength = DEMO_FOCUS_EVENT_ITEMS.length;
        const { items, totalItems } = await getLogsAnalysisStatus('demo-account', undefined, undefined, 100);
        expect(items.length).toEqual(fullLength);
        expect(totalItems).toEqual(fullLength);
    });

    test('demo items should match the expected shape from DEMO_FOCUS_EVENT_ITEMS', async () => {
        const { items } = await getLogsAnalysisStatus('demo-account', undefined, undefined, 2);
        const expectedSlice = DEMO_FOCUS_EVENT_ITEMS.slice(0, 2);
        expect(items).toEqual(expectedSlice);
    });
});

describe('getLogsAnalysisStatus - Oracle description handling', () => {
    const TEST_ACCOUNT_ID = 'account-logs-oracle-desc-test';
    let queryRawSpy: MockInstance;
    let nodeEnvironment: string;

    beforeAll(() => {
        nodeEnvironment = process.env.NODE_ENV || 'demo';
        process.env.NODE_ENV = 'local_dev';

        queryRawSpy = vi.spyOn(prisma.client, '$queryRaw').mockResolvedValue([
            {
                database_instance_id: 'db-instance-oracle-1',
                resource_id: 'resource-oracle-1',
                database_type: DATABASE_TYPE.oracle,
                database_instance_name: 'ORACLE1',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host-oracle.example.com',
                recommendations: [
                    {
                        error: 'ORA-00313: open failed for members of log group 3 of thread 1',
                        cause: 'AI explanation about log group failure',
                        errorCode: 'ORA-00313',
                        severity: 'IMPORTANT',
                        uniqueErrorKey: 'ORA-00313'
                    },
                    {
                        error: 'ORA-19625: error identifying file /path/to/users01.dbf',
                        cause: 'AI explanation about missing datafile',
                        errorCode: 'ORA-19625',
                        severity: 'IMPORTANT',
                        uniqueErrorKey: 'ORA-19625'
                    },
                    {
                        error: 'WARNING: Heavy swapping observed on system in last 5 mins',
                        cause: 'AI explanation about memory pressure',
                        severity: 'IMPORTANT',
                        uniqueErrorKey: 'warning-heavy-swapping-dummy'
                    }
                ]
            }
        ]);
    });

    afterAll(() => {
        queryRawSpy.mockRestore();
        process.env.NODE_ENV = nodeEnvironment;
    });

    test('should strip ORA prefix and capitalize first letter for Oracle description', async () => {
        const { items } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        const oraItems = items.filter(item => item.key?.startsWith('ORA-'));
        expect(oraItems.length).toBeGreaterThan(0);

        const oraItem = oraItems[0];
        expect(oraItem.description).not.toMatch(/^ORA-\d+:/);
        expect(oraItem.description).toMatch(/^[A-Z]/);
    });

    test('should ignore cause for Oracle and use error description', async () => {
        const { items } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        const oraItem = items.find(item => item.key === 'ORA-00313');
        expect(oraItem).toBeDefined();
        expect(oraItem!.description).toEqual('Open failed for members of log group 3 of thread 1');
    });

    test('should extract ORA code as key when errorCode is present', async () => {
        const { items } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        const oraItem = items.find(item => item.key === 'ORA-00313');
        expect(oraItem).toBeDefined();
        expect(oraItem!.label).toEqual('ORA-00313');
    });

    test('should handle non-ORA Oracle errors with capitalized description', async () => {
        const { items } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        const warningItem = items.find(item => item.description?.startsWith('WARNING'));
        expect(warningItem).toBeDefined();
        expect(warningItem!.description).toEqual('WARNING: Heavy swapping observed on system in last 5 mins');
    });
});

describe('getLogsAnalysisStatus - severity mapping', () => {
    const TEST_ACCOUNT_ID = 'account-logs-severity-map-test';
    let queryRawSpy: MockInstance;
    let nodeEnvironment: string;

    beforeAll(() => {
        nodeEnvironment = process.env.NODE_ENV || 'demo';
        process.env.NODE_ENV = 'local_dev';

        queryRawSpy = vi.spyOn(prisma.client, '$queryRaw').mockResolvedValue([
            {
                database_instance_id: 'db-instance-sev-1',
                resource_id: 'resource-sev-1',
                database_type: DATABASE_TYPE.mssql,
                database_instance_name: 'INSTANCE_CRITICAL',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host-sev.example.com',
                recommendations: [
                    {
                        error: 'Error: 999, Severity: 24, State: 1.',
                        errorCode: '999',
                        severity: '24',
                        uniqueErrorKey: '999'
                    }
                ]
            },
            {
                database_instance_id: 'db-instance-sev-2',
                resource_id: 'resource-sev-2',
                database_type: DATABASE_TYPE.mssql,
                database_instance_name: 'INSTANCE_SEVERE',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host-sev.example.com',
                recommendations: [
                    {
                        error: 'Error: 888, Severity: 18, State: 1.',
                        errorCode: '888',
                        severity: '18',
                        uniqueErrorKey: '888'
                    }
                ]
            },
            {
                database_instance_id: 'db-instance-sev-3',
                resource_id: 'resource-sev-3',
                database_type: DATABASE_TYPE.mssql,
                database_instance_name: 'INSTANCE_IMPORTANT',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host-sev.example.com',
                recommendations: [
                    {
                        error: 'Error: 777, Severity: 16, State: 1.',
                        errorCode: '777',
                        severity: '16',
                        uniqueErrorKey: '777'
                    }
                ]
            }
        ]);
    });

    afterAll(() => {
        queryRawSpy.mockRestore();
        process.env.NODE_ENV = nodeEnvironment;
    });

    test('should map critical (severity 24) to high', async () => {
        const { severity } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        expect(severity).toEqual('high');
    });

    test('should map severe (severity 18) to high', async () => {
        // Mock with only severe severity
        queryRawSpy.mockResolvedValueOnce([
            {
                database_instance_id: 'db-instance-severe-only',
                resource_id: 'resource-severe-only',
                database_type: DATABASE_TYPE.mssql,
                database_instance_name: 'INSTANCE_SEVERE_ONLY',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host.example.com',
                recommendations: [
                    {
                        error: 'Error: 100, Severity: 17, State: 1.',
                        errorCode: '100',
                        severity: '17',
                        uniqueErrorKey: '100'
                    }
                ]
            }
        ]);
        const { severity } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        expect(severity).toEqual('high');
    });

    test('should map important (severity 16) to medium', async () => {
        // Mock with only important severity
        queryRawSpy.mockResolvedValueOnce([
            {
                database_instance_id: 'db-instance-important-only',
                resource_id: 'resource-important-only',
                database_type: DATABASE_TYPE.mssql,
                database_instance_name: 'INSTANCE_IMPORTANT_ONLY',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host.example.com',
                recommendations: [
                    {
                        error: 'Error: 200, Severity: 16, State: 1.',
                        errorCode: '200',
                        severity: '16',
                        uniqueErrorKey: '200'
                    }
                ]
            }
        ]);
        const { severity } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        expect(severity).toEqual('medium');
    });

    test('should map Oracle CRITICAL to high', async () => {
        queryRawSpy.mockResolvedValueOnce([
            {
                database_instance_id: 'db-instance-oracle-critical',
                resource_id: 'resource-oracle-critical',
                database_type: DATABASE_TYPE.oracle,
                database_instance_name: 'ORACLE_CRITICAL',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host.example.com',
                recommendations: [
                    {
                        error: 'ORA-00600: internal error code',
                        errorCode: 'ORA-00600',
                        severity: 'CRITICAL',
                        uniqueErrorKey: 'ORA-00600'
                    }
                ]
            }
        ]);
        const { severity } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        expect(severity).toEqual('high');
    });

    test('should map Oracle IMPORTANT to medium', async () => {
        queryRawSpy.mockResolvedValueOnce([
            {
                database_instance_id: 'db-instance-oracle-important',
                resource_id: 'resource-oracle-important',
                database_type: DATABASE_TYPE.oracle,
                database_instance_name: 'ORACLE_IMPORTANT',
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                hostname: 'host.example.com',
                recommendations: [
                    {
                        error: 'WARNING: db_recovery_file_dest space low',
                        severity: 'IMPORTANT',
                        uniqueErrorKey: 'warning-recovery-dummy'
                    }
                ]
            }
        ]);
        const { severity } = await getLogsAnalysisStatus(TEST_ACCOUNT_ID);
        expect(severity).toEqual('medium');
    });
});
