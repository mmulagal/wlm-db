import { getCloudformationClient, listStacks, createStack } from '../../../src/lib/aws/cloud-formation';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';

const CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';

describe('Cloud formation client', () => {
    it('Cloud formation client in valid region', async () => {
        const client = await getCloudformationClient(CREDENTIALS_ID, DEFAULT_AWS_REGION);
        expect(client).toBeDefined();
    });
    it('Cloud formation client in an invalid region', async () => {
        try {
            await listStacks(CREDENTIALS_ID, 'invalid-region');
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});

describe('Cloud formation stacks', () => {
    it('VPC quota in valid region', async () => {
        const resp = await listStacks(CREDENTIALS_ID, DEFAULT_AWS_REGION);
        expect(resp).toBeDefined();
    });
    it('VPC quota in an invalid region', async () => {
        try {
            await listStacks(CREDENTIALS_ID, DEFAULT_AWS_REGION);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});

describe('Create cloud formation stack', () => {
    const params = [
        // Parameters
        {
            // Parameter
            ParameterKey: 'VPCName',
            ParameterValue: 'krithi_vpc'
        },
        {
            // Parameter
            ParameterKey: 'VPCCIDR',
            ParameterValue: '10.0.0.0/16'
        },
        {
            // Parameter
            ParameterKey: 'AvailabilityZones',
            ParameterValue: 'availability-zone-1,availability-zone-1'
        },
        {
            // Parameter
            ParameterKey: 'PrivateSubnetCIDRs',
            ParameterValue: '10.0.0.0/20,10.0.0.0/20'
        },
        {
            // Parameter
            ParameterKey: 'PublicSubnetCIDR',
            ParameterValue: '10.0.128.0/20'
        },
        {
            // Parameter
            ParameterKey: 'NumberOfPublicSubnets',
            ParameterValue: '1'
        }
    ];
    it('Create cloud formation stack', async () => {
        const resp = await createStack(CREDENTIALS_ID, DEFAULT_AWS_REGION, 'TestStack1', 'sampleurl', params);
        expect(resp).toBeDefined();
        expect(resp.StackId).toEqual(
            'arn:aws:cloudformation:ap-southeast-1:464262061435:stack/TestStack1/7a2cccd0-2fb0-11ee-a6b7-0253026d13ca'
        );
    });
});
