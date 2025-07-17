import { faker } from '@faker-js/faker';
import registerUbrCredentials from '../../../src/lib/cloud-manager/ubr';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/cloud-manager/ubr-scope';

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
});
