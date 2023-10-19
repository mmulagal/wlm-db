import { createResource, deleteResource } from '../../src/lib/database/db';
import getSystemStatus from '../../src/operations/system-operations';

describe('System Operations', () => {
    it('Get system status- no resource', async () => {
        const resp = await getSystemStatus('empty-test');
        expect(resp.isActive).toEqual(false);
    });

    it('Get system status - resource present', async () => {
        await deleteResource('account-with-resource', 'i-1a2b3c4d5e');
        await createResource('account-with-resource', {
            resourceId: 'i-1a2b3c4d5e',
            resourceName: 'sqlnode1',
            resourceType: 'MSSQL',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            coRelationId: 'fsx-1234',
            region: 'DEFAULT_AWS_REGION'
        });
        const resp = await getSystemStatus('account-with-resource');
        expect(resp.isActive).toEqual(true);
        await deleteResource('account-with-resource', 'i-1a2b3c4d5e');
    });
});
