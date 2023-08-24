import { listTopics } from '../../../src/lib/aws/sns';
import { faker } from '@faker-js/faker';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/sns-scope';
import '../../simulator/scopes/opentelemetry-scope';
import snsTopics from '../../simulator/responses/aws/sns-topics.json';

describe('List SNS topics', () => {
    it('should return a list of SNS topics', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await listTopics(credentialsId, 'us-east-1');
        expect(resp).toEqual(snsTopics);
    });
});
