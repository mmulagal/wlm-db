import { getWlmdbPolicy } from '../../../src/lib/cloud-manager/wlmdb';
import '../../simulator/scopes/cloud-manager/wlmdb-scope';

describe('WLMDB lib', () => {
    it('Get WLMDB policy', async () => {
        const response = await getWlmdbPolicy();
        expect(response.operate).toBeDefined();
        expect(response.view).toBeDefined();
    });
});
