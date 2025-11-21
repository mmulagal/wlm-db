import { STORAGE_TYPE } from '@prisma/client';
import { createResource, deleteResource } from '../../src/lib/database/db';
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
    let queryRawSpy: any;

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
                count: 2
            },
            {
                name: 'autosize',
                severity: 'critical',
                count: 4
            },
            {
                name: 'tiering-policy',
                severity: 'warning',
                count: 7
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
        const mssqlData = data.find(item => item.label === 'Microsoft SQL Server');
        expect(mssqlData?.value).toEqual(2); // 2 MSSQL resources across regions
        const oracleData = data.find(item => item.label === 'Oracle');
        expect(oracleData?.value).toEqual(1);
        const pgsqlData = data.find(item => item.label === 'PostgreSQL');
        expect(pgsqlData?.value).toEqual(1);
    });

    test('Get homepage widget status with a region', async () => {
        const {
            items: [{ data }]
        } = await getWidgetStatus(ACCOUNTID, undefined, 'us-east-1');
        expect(data?.length).toEqual(3);
    });

    test('Get homepage focus status', async () => {
        const { items, totalItems, severity } = await getFocusStatus(ACCOUNTID);
        expect(items?.length).toEqual(2);
        expect(totalItems).toEqual(6);
        expect(severity).toEqual('high');
    });

    test('Get homepage focus status with a limit of 7', async () => {
        const { items, totalItems, severity } = await getFocusStatus(ACCOUNTID, undefined, undefined, 7);
        const perfEfficiencyItem = items.filter(item => item.description === 'autosize-mode');
        const operationalExcellenceItem = items.filter(item => item.description === 'autosize');
        expect(perfEfficiencyItem.length).toEqual(2);
        expect(operationalExcellenceItem.length).toEqual(4);
        expect(totalItems).toEqual(6);
        expect(severity).toEqual('high');
    });

    test('Get homepage focus status with a limit of 5', async () => {
        const { items, totalItems, severity } = await getFocusStatus(ACCOUNTID, undefined, undefined, 5);
        const perfEfficiencyItem = items.filter(item => item.description === 'autosize-mode');
        const operationalExcellenceItem = items.filter(item => item.description === 'autosize');
        expect(perfEfficiencyItem.length).toEqual(2);
        expect(operationalExcellenceItem.length).toEqual(3);
        expect(totalItems).toEqual(6);
        expect(severity).toEqual('high');
    });
});
