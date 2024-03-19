import { faker } from '@faker-js/faker';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/cloud-watch-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { calculateFsxnStorageEfficiency } from '../../../src/operations/aws/cloud-watch-operations';
import { DEFAULT_AWS_REGION } from '../../utils/consts';

describe('Cloud watch operations', () => {
    it('Calculate FSX storage efficiency', async () => {
        const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
        const resp = await calculateFsxnStorageEfficiency(DEFAULT_AWS_REGION, CREDENTIALS_ID, 'fs-1234567890abcdef0');
        expect(resp).toBeDefined();
    });
});
