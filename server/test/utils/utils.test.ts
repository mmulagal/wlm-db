import { createSecretsString } from '../../src/utils/utils';
import { DEFAULT_AWS_REGION } from '../../src/utils/consts';
import '../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../simulator/scopes/aws/service-quota-scope';
import '../simulator/scopes/aws/cloud-formation-scope';
import '../simulator/scopes/aws/secrets-manager-scope';

const CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';

describe(' Secrets Manager string', () => {
    it(' Create Secrets Manager String', async () => {
        const response = await createSecretsString(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'test-string-1',
            'username',
            'password'
        );
        expect(response).toEqual('test-string-1');
    });
});
