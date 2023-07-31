import { getCloudformationClient, getStacks } from '../../../src/lib/aws/cloud-formation';
import cfStacks from '../../simulator/responses/aws/cloud-formation-stacks.json';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';

import '../../simulator/scopes/aws/directory-service-scope';

describe('Cloud formation client', () => {
    it('Cloud formation client in valid region', async () => {
        const client = await getCloudformationClient(DEFAULT_AWS_REGION);
        expect(client).toBeDefined();
    });
    it('Cloud formation client in an invalid region', async () => {
        const client = await getCloudformationClient('invalid-region');
        try {
            await getStacks(client);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});

describe('Cloud formation stacks', () => {
    it('VPC quota in valid region', async () => {
        const client = await getCloudformationClient(DEFAULT_AWS_REGION);
        const resp = await getStacks(client);
        expect(resp).toBeDefined();
        expect(resp.StackSummaries?.length).toBeGreaterThanOrEqual(cfStacks.stacks.length);
    });
    it('VPC quota in an invalid region', async () => {
        const client = await getCloudformationClient('invalid-region');
        try {
            await getStacks(client);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});
