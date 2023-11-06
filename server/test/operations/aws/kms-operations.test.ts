import { faker } from '@faker-js/faker';
import { getKmsKeysList } from '../../../src/operations/aws/kms-operations';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/aws/kms-scope';
import '../../simulator/scopes/opentelemetry-scope';

describe('KMS Operations', () => {
    it('list of Kms Keys', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await getKmsKeysList(credentialsId, DEFAULT_AWS_REGION);
        expect(resp).toBeDefined();
    });
});
