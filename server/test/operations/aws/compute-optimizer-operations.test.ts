import { faker } from '@faker-js/faker';
import {
    createRecommendationForResource,
    getInstanceRecommendations,
    manageInstanceRecommendationPreReqs,
    translateFindingReasonCode
} from '../../../src/operations/aws/compute-optimizer-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';
import { getEc2Arn } from '../../../src/utils/utils';

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

    it('Manage instance recommendation prerequisites', async () => {
        const instanceTypes = await manageInstanceRecommendationPreReqs(
            '464262061435',
            DEFAULT_AWS_REGION,
            DEFAULT_AWS_CREDENTIALS_ID,
            getEc2Arn('464262061435', 'ap-southeast-1', 'i-test'),
            ACCOUNT_ID,
            ['i-partner-1', 'i-test'],
            ['vol-123456789'],
            'AOAG'
        );
        expect(instanceTypes).toBeDefined();
    });

    it('Manage instance recommendation prerequisites - managed instances', async () => {
        const instanceTypes = await manageInstanceRecommendationPreReqs(
            '464262061435',
            DEFAULT_AWS_REGION,
            DEFAULT_AWS_CREDENTIALS_ID,
            getEc2Arn('464262061435', 'ap-southeast-1', 'i-test'),
            ACCOUNT_ID,
            ['i-test'],
            [],
            'Standalone'
        );
        expect(instanceTypes).toBeDefined();
    });

    it('Translate finding reason code', () => {
        const resp = translateFindingReasonCode('MemoryOverprovisioned');
        expect(resp).toEqual('Memory over-provisioned');
    });
});
