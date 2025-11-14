import { faker } from '@faker-js/faker';

import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { generateUbrCredentials } from '../../../src/operations/ubr-protection-operations';

describe('UBR protection operations', () => {
    it('Should register UBR credentials with valid parameters', async () => {
        const response = await generateUbrCredentials({
            accountId: ACCOUNT_ID,
            region: DEFAULT_AWS_REGION,
            credentialsId: CREDENTIALS_ID,
            ec2InstanceIds: [faker.string.alphanumeric(20)],
            sqlInstanceName: faker.string.alpha(10),
            workspaceId: faker.string.uuid(),
            connectorId: faker.string.uuid(),
            resourceId: faker.string.uuid()
        });
        expect(response).toBeDefined();
    });
});
