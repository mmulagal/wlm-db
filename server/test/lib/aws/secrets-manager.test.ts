import { faker } from '@faker-js/faker';
import { getSecretsManagerClient, createSecret, putResourcePolicy } from '../../../src/lib/aws/secrets-manager';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';
import secretManagerResponse from '../../simulator/responses/aws/secrets-manager-create.json';
import secretManagerPolicyResponse from '../../simulator/responses/aws/secrets-manager-create-policy.json';

describe(' Secrets Manager client', () => {
    const credentialsId = `${faker.string.alpha(20)}`;
    it(' Secrets Manager client in valid region', async () => {
        const client = await getSecretsManagerClient(credentialsId, DEFAULT_AWS_REGION);
        expect(client).toBeDefined();
    });
    it(' Secrets Manager client in an invalid region', async () => {
        try {
            await createSecret(credentialsId, 'invalid-region', 'test-string-1', 'username', 'password', 'sample-arn');
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});

describe('Create Secrets Manager String', () => {
    it('Secrets Manager String', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await createSecret(
            credentialsId,
            DEFAULT_AWS_REGION,
            'test-string-1',
            'username',
            'password',
            'sample-arn'
        );
        expect(resp).toEqual(secretManagerResponse);
    });
    it('Secrets Manager Policy ', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await putResourcePolicy(credentialsId, DEFAULT_AWS_REGION, 'sample-secret-id', 'sample-arn');

        expect(resp).toEqual(secretManagerPolicyResponse);
    });
});
