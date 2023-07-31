import { getCloudformationClient, listStacks } from '../../../src/lib/aws/cloud-formation';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';

import '../../simulator/scopes/aws/cloud-formation-scope';

const CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';

describe('Cloud formation client', () => {
    it('Cloud formation client in valid region', async () => {
        const client = await getCloudformationClient(CREDENTIALS_ID, DEFAULT_AWS_REGION);
        expect(client).toBeDefined();
    });
    it('Cloud formation client in an invalid region', async () => {
        const client = await getCloudformationClient(CREDENTIALS_ID, 'invalid-region');
        try {
            await listStacks(client);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});

describe('Cloud formation stacks', () => {
    it('VPC quota in valid region', async () => {
        const client = await getCloudformationClient(CREDENTIALS_ID, DEFAULT_AWS_REGION);
        const resp = await listStacks(client);
        expect(resp).toBeDefined();
    });
    it('VPC quota in an invalid region', async () => {
        const client = await getCloudformationClient(CREDENTIALS_ID, 'invalid-region');
        try {
            await listStacks(client);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});
