import { faker } from '@faker-js/faker';
import { getSnsTopics } from '../../../src/operations/aws/sns-operations';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/aws/sns-scope';
import '../../simulator/scopes/opentelemetry-scope';

describe('List SNS topics', () => {
    it('should return a list of SNS topics', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await getSnsTopics(credentialsId, 'us-east-1');
        expect(resp.topics).toBeDefined();
    });
});
