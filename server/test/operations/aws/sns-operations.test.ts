import { getSnsTopics } from '../../../src/operations/aws/sns-operations';
import { faker } from '@faker-js/faker';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/sns-scope';

describe('List SNS topics', () => {
    it('should return a list of SNS topics', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await getSnsTopics(credentialsId, 'us-east-1');
        expect(resp.topics).toBeDefined();
    });
});
