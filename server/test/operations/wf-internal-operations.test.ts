import { STORAGE_TYPE } from '@prisma/client';
import { createResource, deleteResource } from '../../src/lib/database/db';
import { getSystemStatus } from '../../src/operations/wf-internal-operations';
import { DEFAULT_AWS_CREDENTIALS_ID } from '../utils/consts';

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
