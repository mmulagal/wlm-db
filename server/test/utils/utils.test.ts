import { createSecrets } from '../../src/operations/aws/secrets-manager-operations';
import { DEFAULT_AWS_REGION } from '../../src/utils/consts';
import '../simulator/scopes/aws/secrets-manager-scope';
import secretManagerResponse from '../simulator/responses/aws/secrets-manager-create.json';
import { checkAndRetrieveJsonObject } from '../../src/utils/utils';

const CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';
vi.mock('../../src/lib/aws/secrets-manager', () => ({
    createSecret: vi.fn().mockImplementation(async () => secretManagerResponse)
}));

describe(' Secrets Manager string', () => {
    it(' Create Secrets Manager String', async () => {
        const response = await createSecrets(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            [{ secretName: 'test-string-1', username: 'username', password: 'password' }],
            'sample-rolearn'
        );
        expect(response).toBeDefined();
    });

    it(' Check if valid json string', async () => {
        const response = checkAndRetrieveJsonObject(
            '[{ "secretName": "test-string-1", "username": "username", "password": "password" }]'
        );
        expect(response.isValid).toBeTruthy();
    });
    it(' Check if valid json string - negative', async () => {
        const response = checkAndRetrieveJsonObject('[{ abcde,ghij }]');
        expect(response.isValid).toBeFalsy();
    });
});
