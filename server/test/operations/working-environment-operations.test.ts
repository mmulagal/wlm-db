import { getResourceRelationships } from '../../src/operations/working-environment-operations';

vi.mock('../../src/lib/database/db.ts', () => ({
    listRelationshipsResources() {
        return [
            {
                resource_id: '5C791AE7-0E86-486B-8DC2-BAFEF485B875',
                co_relation_id: 'fs-0d5efc3057c4f12cb'
            }
        ];
    }
}));

describe('Working Environments Operations', () => {
    it('Get Working environments relationships', async () => {
        const resp = await getResourceRelationships();
        expect(resp[0].source.id).toEqual('5C791AE7-0E86-486B-8DC2-BAFEF485B875');
        expect(resp[0].target.id).toEqual('fs-0d5efc3057c4f12cb');
    });
});
