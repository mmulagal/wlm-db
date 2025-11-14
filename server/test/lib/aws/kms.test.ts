import { faker } from '@faker-js/faker';
import { decrypt, describeKey, encrypt, listAliases, listKeys } from '../../../src/lib/aws/kms';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';

describe('KMS Lib', () => {
    it('should return a kms key', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const params = {
            KeyId: 'arn:aws:kms:us-east-1:210811600188:key/0a93acf4-ca6e-4847-8baa-9b0f561567b1'
        };
        const resp = await describeKey(credentialsId, DEFAULT_AWS_REGION, params);
        expect(resp).toBeDefined();
    });

    it('should return a list of kms keys', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await listKeys(credentialsId, DEFAULT_AWS_REGION);
        expect(resp.length).toBeGreaterThan(0);
    });

    it('should return a list of key aliases', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const params = {
            KeyId: '0a93acf4-ca6e-4847-8baa-9b0f561567b1'
        };
        const resp = await listAliases(credentialsId, DEFAULT_AWS_REGION, params);
        expect(resp.length).toBeGreaterThan(0);
    });

    it('should encrypt a string', async () => {
        const params = {
            KeyId: '1234abcd-12ab-34cd-56ef-1234567890ab',
            Plaintext: Buffer.from('abcdef')
        };
        const resp = await encrypt(params);
        expect(resp.CiphertextBlob).toBeDefined();
    });

    it('should decrypt a string', async () => {
        const params = {
            KeyId: '1234abcd-12ab-34cd-56ef-1234567890ab',
            CiphertextBlob: Buffer.from('abcdef')
        };
        const resp = await decrypt(params);
        expect(resp.Plaintext).toBeDefined();
    });
});
