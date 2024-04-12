import { faker } from '@faker-js/faker';
import { getSnsTopics, checkAndCreateTopic } from '../../../src/operations/aws/sns-operations';

import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/sns-scope';
import '../../simulator/scopes/opentelemetry-scope';

describe('List SNS topics', () => {
    it('should return a list of SNS topics', async () => {
        const credentialsId = `${faker.string.alpha(20)}`;
        const resp = await getSnsTopics(credentialsId, 'us-east-1');
        expect(resp.topics).toBeDefined();
    });

    it('should check and create SNS topic', async () => {
        const region = 'us-east-1';
        const queueName = 'wlmdb';
        const policyStatement = {
            Version: '2012-10-17',
            Statement: [
                {
                    Sid: 'AllowSNSNotifications',
                    Effect: 'Allow',
                    Principal: {
                        AWS: '*'
                    },
                    Action: ['SNS:Publish', 'SNS:Subscribe'],
                    Resource: 'arn:aws:sns:us-east-1:464262061435:wlmdb'
                }
            ]
        };
        process.env.KEY_ALIAS = 'alias/wlmdb-service';
        const wlmdbTopicArn = await checkAndCreateTopic(region, queueName, policyStatement);
        expect(wlmdbTopicArn).toBeDefined();
    });
});
