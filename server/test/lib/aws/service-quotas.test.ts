import { getServiceQuotasClient, getVpcQuota, getCloudFormationQuota } from '../../../src/lib/aws/service-quotas';
import quotaResponse from '../../simulator/responses/aws/service-quotas.json';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';

import '../../simulator/scopes/aws/service-quota-scope';

const CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';

describe('Service quota client', () => {
    it('Service quota client in valid region', async () => {
        const client = await getServiceQuotasClient(CREDENTIALS_ID, DEFAULT_AWS_REGION);
        expect(client).toBeDefined();
    });
    it('Service quota client in an invalid region', async () => {
        const client = await getServiceQuotasClient(CREDENTIALS_ID, 'invalid-region');
        try {
            await getVpcQuota(client);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});

describe('VPC quota', () => {
    it('VPC quota in valid region', async () => {
        const client = await getServiceQuotasClient(CREDENTIALS_ID, DEFAULT_AWS_REGION);
        const resp = await getVpcQuota(client);
        expect(resp).toBeDefined();
    });
    it('VPC quota in an invalid region', async () => {
        const client = await getServiceQuotasClient(CREDENTIALS_ID, 'invalid-region');
        try {
            await getVpcQuota(client);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});

describe('Cloudformation quota', () => {
    it('Cloudformation quota in valid region', async () => {
        const client = await getServiceQuotasClient(CREDENTIALS_ID, DEFAULT_AWS_REGION);
        const resp = await getCloudFormationQuota(client);
        expect(resp).toBeDefined();
    });
    it('Cloudformation quota in an invalid region', async () => {
        const client = await getServiceQuotasClient(CREDENTIALS_ID, 'invalid-region');
        try {
            await getCloudFormationQuota(client);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});
