import initiateSecrets from '../../src/utils/secret';

describe('Secrets Manager', () => {
    it('Initiating secrets', async () => {
        const response = await initiateSecrets();
        expect(response).toBeUndefined();
    });
});
