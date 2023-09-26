import { createResource, deleteResource } from '../../src/lib/database/db';
import { getWeRelationships } from '../../src/operations/working-environment-operations';
import { ACCOUNT_ID } from '../utils/consts';

vi.mock('../../src/utils/async-local-storage.ts', () => ({
    getAsyncLocalStorageResource() {
        return ACCOUNT_ID;
    }
}));

describe('Working Environments Operations', () => {

    it('Get Working environments relationships', async () => {
        await createResource(ACCOUNT_ID, {
            resourceId: 'i-1a2b3c4d5e',
            resourceName: 'sqlnode1',
            resourceType: 'MSSQL',
            cloudProviderAccountId: '464262061435',
            cloudProviderName: 'AWS',
            coRelationId: 'fsx-1234',
            region: 'ap-southeast-1'
        });

        const resp = await getWeRelationships();
        expect(resp[0].source.id).toEqual('i-1a2b3c4d5e');
        expect(resp[0].target.id).toEqual('fsx-1234');

        await deleteResource(ACCOUNT_ID, 'i-1a2b3c4d5e');
    });

});