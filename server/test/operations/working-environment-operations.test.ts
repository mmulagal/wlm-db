import { getResourceRelationships } from '../../src/operations/working-environment-operations';
import '../simulator/scopes/cloud-manager/link-service-scope';
import '../simulator/scopes/opentelemetry-scope';
import '../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../simulator/scopes/jwt-scope';
import '../simulator/scopes/cloud-manager/wlmdb-scope';
import '../simulator/scopes/cloud-manager/fsx-core-scope';

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
