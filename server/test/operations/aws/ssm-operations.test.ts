import { executeSSMDocument } from '../../../src/operations/aws/ssm-operations';
import { faker } from '@faker-js/faker';
import { SSM_PARAMS } from '../../utils/consts';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ssm-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';

describe('executeSsmDocument', () => {
    it('executeSsmDocument', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;

        const resp = await executeSSMDocument(credentialsId, 'ap-southeast-1', SSM_PARAMS);
        expect(resp).toBeDefined();
    });
});
