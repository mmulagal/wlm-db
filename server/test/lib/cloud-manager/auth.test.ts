import { getWfServiceToken, getBxpServiceToken } from '../../../src/lib/cloud-manager/auth';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';

describe('Get service token', () => {
    it('should return service token for WF intracluster services', async () => {
        const resp = await getWfServiceToken();
        expect(resp.token).toBeDefined();
    });

    it('should return service token for BXP services', async () => {
        const resp = await getBxpServiceToken();
        expect(resp.token).toBeDefined();
    });
});
