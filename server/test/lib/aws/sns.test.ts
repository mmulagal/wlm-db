import { listTopics, createTopic, subscribeTopic } from '../../../src/lib/aws/sns';
import { faker } from '@faker-js/faker';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/sns-scope';
import snsTopics from '../../simulator/responses/aws/sns-topics.json';

describe('List SNS topics', () => {
    it('should return a list of SNS topics', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await listTopics(credentialsId, 'us-east-1');
        expect(resp).toEqual(snsTopics);
    });

    it('should create a SNS topics', async () => {
        const resp = await createTopic('us-east-1', 'WLMDB');
        expect(resp).toBeDefined();
    });

    it('should subscribe to SNS topic', async () => {
        const resp = await subscribeTopic('us-east-1', {
            Protocol: 'sqs',
            TopicArn: 'arn:aws:sns:us-east-1:464262061435:SGTESTTOPIC',
            Endpoint: 'arn:aws:sqs:us-east-1:464262061435:SGTESTQ'
        });
        expect(resp).toBeDefined();
    });
});
