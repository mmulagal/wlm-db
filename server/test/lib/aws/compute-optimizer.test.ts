import { faker } from '@faker-js/faker';

import {
    getEnrollmentStatus,
    getEC2InstanceRecommendations,
    putRecommendationPreferences,
    getEffectiveRecommendationPreferences
} from '../../../src/lib/aws/compute-optimizer';

import { DEFAULT_AWS_REGION } from '../../utils/consts';

describe('Compute optimizer Lib', () => {
    const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
    it('Get enrollment status', async () => {
        const resp = await getEnrollmentStatus(DEFAULT_AWS_REGION, CREDENTIALS_ID, '464262061435');

        expect(resp).toBeDefined();
    });

    it('Get EC2 instance recommendations', async () => {
        const resp = await getEC2InstanceRecommendations(DEFAULT_AWS_REGION, CREDENTIALS_ID, '464262061435', {
            instanceArns: ['resourceArn'],
            recommendationPreferences: {
                cpuVendorArchitectures: ['CURRENT'] // CURRENT to view recommendations that are based on the same CPU vendor and architecture as the current instance.
            },
            filters: [
                {
                    name: 'Finding',
                    values: ['Overprovisioned']
                },
                {
                    name: 'InferredWorkloadTypes',
                    values: ['SQLServer']
                },
                {
                    name: 'FindingReasonCodes',
                    values: [
                        'CPUOverprovisioned',
                        'MemoryOverprovisioned',
                        'NetworkBandwidthOverprovisioned',
                        'NetworkPPSOverprovisioned'
                    ]
                }
            ]
        });

        expect(resp).toBeDefined();
    });

    it('Put recommendation preferences', async () => {
        const resp = await putRecommendationPreferences(DEFAULT_AWS_REGION, CREDENTIALS_ID, '464262061435', {
            resourceType: 'Ec2Instance',
            lookBackPeriod: 'DAYS_14',
            scope: {
                name: 'ResourceArn',
                value: 'instanceArn'
            },
            preferredResources: [
                {
                    name: 'Ec2InstanceTypes',
                    includeList: ['m5.large', 'm5.xlarge', 'm5.2xlarge', 'm5.4xlarge', 'm5.12xlarge', 'm5.24xlarge'],
                    excludeList: ['t*']
                }
            ]
        });

        expect(resp).toBeDefined();
    });

    it('Get effective recommendation preferences', async () => {
        const resp = await getEffectiveRecommendationPreferences(DEFAULT_AWS_REGION, CREDENTIALS_ID, '464262061435', {
            resourceArn: 'resourceArn'
        });

        expect(resp).toBeDefined();
    });
});
