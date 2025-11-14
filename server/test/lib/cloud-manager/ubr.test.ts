import { faker } from '@faker-js/faker';
import { registerUbrCredentials, listRegisteredUbrCredentials } from '../../../src/lib/cloud-manager/ubr';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

describe('UBR - Unified Backup and Recovery', () => {
    it('Register UBR credentials', async () => {
        const response = await registerUbrCredentials({
            accountId: ACCOUNT_ID,
            credentialsId: CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION,
            sqlInstanceName: faker.string.alpha(10),
            username: faker.internet.username(),
            password: faker.internet.password(),
            resourceId: faker.string.alphanumeric(20),
            workspaceId: faker.string.uuid(),
            connectorId: faker.string.alphanumeric(32)
        });
        expect(response?.credentialsId).toBeDefined();
    });

    it('List registered UBR credentials', async () => {
        const response = await listRegisteredUbrCredentials({
            accountId: ACCOUNT_ID,
            workspaceId: faker.string.uuid()
        });
        expect(response?.credentials).toBeDefined();
        expect(response?.credentials.length).toBeGreaterThan(0);
        expect(response?.credentials[0].credentialsId).toBeDefined();
    });
});
