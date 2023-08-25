import { getSnsTopics } from '../../../src/operations/aws/sns-operations';
import { faker } from '@faker-js/faker';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/sns-scope';
import '../../simulator/scopes/opentelemetry-scope';

const opsresponse = {
    topics: [
        {
            topicArn: 'arn:aws:sns:ap-southeast-1:464262061435:LaunchWizardEventForwarder-DO_NOT_MODIFY',
            topicName: 'LaunchWizardEventForwarder-DO_NOT_MODIFY'
        },
        {
            topicArn: 'arn:aws:sns:ap-southeast-1:464262061435:config-topic-464262061435',
            topicName: 'config-topic-464262061435'
        }
    ]
};

describe('List SNS topics', () => {
    it('should return a list of SNS topics', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await getSnsTopics(credentialsId, 'us-east-1');
        expect(resp).toEqual(opsresponse);
    });
});
