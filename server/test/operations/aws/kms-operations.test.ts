import { faker } from '@faker-js/faker';
import { getFsxKmsKeysList, encryptString, decryptString } from '../../../src/operations/aws/kms-operations';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/kms-scope';
import '../../simulator/scopes/opentelemetry-scope';

const ENCRYPTED_STRING =
    'AQICAHh3E4vx4WZ1lHTUVZz733FZkm0T3Fa7t1wYdyu17neJKQFpPnWZiX6JENbOLJSQ+VtkAAAAbzBtBgkqhkiG9w0BBwagYDBeAgEAMFkGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMjnysxn+YF2ZVaV+vAgEQgCx3QNSFynLQX3XS7jdQ5ViEpQzWuiKf3VYAO09GuX9gk+r3ickZsXvuYVxNZg==';
describe('KMS Operations', () => {
    it('list of Kms Keys', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await getFsxKmsKeysList(credentialsId, DEFAULT_AWS_REGION);
        expect(resp.keys.length).toBeGreaterThan(0);
    });

    it('Encrypt string', async () => {
        const resp = await encryptString('Hello! encrypt me');
        expect(resp).toEqual(ENCRYPTED_STRING);
    });

    it('Decrypt string', async () => {
        const resp = await decryptString(ENCRYPTED_STRING);
        expect(resp).toEqual('Hello! encrypt me');
    });
});
