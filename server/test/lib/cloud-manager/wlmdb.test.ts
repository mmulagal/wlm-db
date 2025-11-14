import { getWlmdbPolicy } from '../../../src/lib/cloud-manager/wlmdb';

describe('WLMDB lib', () => {
    it('Get WLMDB policy', async () => {
        const response = await getWlmdbPolicy();
        expect(response.operate).toBeDefined();
        expect(response.view).toBeDefined();
    });
});
