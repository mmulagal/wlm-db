import getStorageSavings from '../../../src/lib/cloud-manager/marketing';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/cloud-manager/marketing-scope';

describe('Marketing lib', () => {
    it('Getting storage savings', async () => {
        const response = await getStorageSavings(ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION, [
            'vol-0f32f6c69fb7e40ac'
        ]);
        expect(response.ebs).toBeDefined();
        expect(response.fsx).toBeDefined();
        expect(response.fsx_calculation).toBeDefined();
    });
});
