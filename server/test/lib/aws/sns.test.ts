import { faker } from '@faker-js/faker';
import { listTopics, createTopic, subscribeTopic } from '../../../src/lib/aws/sns';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/sns-scope';
import '../../simulator/scopes/opentelemetry-scope';

describe('List SNS topics', () => {
    it('should return a list of SNS topics', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await listTopics('us-east-1', credentialsId);
        expect(resp.Topics?.length).toEqual(2);
    });

    it('should create a SNS topics', async () => {
        const policyStatement = {
            Sid: 'AllowCloudFormationService',
            Effect: 'Allow',
            Principal: {
                Service: 'cloudformation.amazonaws.com'
            },
            Action: 'SNS:Publish',
            Resource: 'arn:aws:sns:us-east-1:464262061435:wlmdb-test'
        };
        const resp = await createTopic('us-east-1', {
            Name: 'wlmdb-test',
            Attributes: {
                Policy: JSON.stringify({
                    Version: '2012-10-17',
                    Id: 'CloudFormationServicePolicy',
                    Statement: [policyStatement]
                })
            }
        });
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
