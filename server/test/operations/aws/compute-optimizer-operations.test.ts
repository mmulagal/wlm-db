import { faker } from '@faker-js/faker';
import {
    createRecommendationForResource,
    getInstanceRecommendations
} from '../../../src/operations/aws/compute-optimizer-operations';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/pricing-scope';
import '../../simulator/scopes/aws/compute-optimizer-scope';
import '../../simulator/scopes/aws/cloud-watch-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/ec2-scope';
import { ACCOUNT_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

describe('Compute optimizer operations', () => {
    it('Create recommendations for resource', async () => {
        const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
        const resp = await createRecommendationForResource(
            DEFAULT_AWS_REGION,
            CREDENTIALS_ID,
            ACCOUNT_ID,
            ['i-1234567890abcdef0', 'i-9234567890abcdef1'],
            ['t3.micro'],
            '464262061435'
        );

        expect(resp).toBeUndefined();
    });

    it('Get instance recommendations', async () => {
        const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
        const resp = await getInstanceRecommendations(
            DEFAULT_AWS_REGION,
            CREDENTIALS_ID,
            ACCOUNT_ID,
            'i-1234567890abcdef0',
            [
                {
                    ec2InstanceId: 'i-1234567890abcdef0',
                    ec2InstanceType: 't2.micro',
                    ec2InstancePrivateIpAddress: '10.0.0.1',
                    ec2InstanceName: 'aoag-node-1',
                    ec2UsageOperation: 'RunInstances:0102'
                },
                {
                    ec2InstanceId: 'i-9234567890abcdef1',
                    ec2InstanceType: 't2.micro',
                    ec2InstancePrivateIpAddress: '10.0.0.2',
                    ec2InstanceName: 'aoag-node-2',
                    ec2UsageOperation: 'RunInstances:0102'
                }
            ],
            ['ebs-01234567890'],
            'Standalone'
        );

        expect(resp).toBeDefined();
    });
});
