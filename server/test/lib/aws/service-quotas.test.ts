import { getServiceQuotasClient, getVpcQuota, getCloudFormationQuota } from '../../../src/lib/aws/service-quotas';
import vpcQuotaResponse from '../../simulator/responses/aws/service-vpc-quotas.json';
import cfQuotaResponse from '../../simulator/responses/aws/service-cf-quotas.json';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import { DEFAULT_AWS_REGION } from '../../../src/utils/consts';

import '../../simulator/scopes/aws/directory-service-scope';

describe('Service quota client', () => {
    it('Service quota client in valid region', async () => {
        const client = await getServiceQuotasClient(DEFAULT_AWS_REGION);
        expect(client).toBeDefined();
    });
    it('Service quota client in an invalid region', async () => {
        const client = await getServiceQuotasClient('invalid-region');
        try {
            await getVpcQuota(client);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});

describe('VPC quota', () => {
    it('VPC quota in valid region', async () => {
        const client = await getServiceQuotasClient(DEFAULT_AWS_REGION);
        const resp = await getVpcQuota(client);
        expect(resp.Quotas?.length).toEqual(vpcQuotaResponse.Quotas.length);
    });
    it('VPC quota in an invalid region', async () => {
        const client = await getServiceQuotasClient('invalid-region');
        try {
            await getVpcQuota(client);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});

describe('Cloudformation quota', () => {
    it('Cloudformation quota in valid region', async () => {
        const client = await getServiceQuotasClient(DEFAULT_AWS_REGION);
        const resp = await getCloudFormationQuota(client);
        expect(resp.Quotas?.length).toEqual(cfQuotaResponse.Quotas.length);
    });
    it('Cloudformation quota in an invalid region', async () => {
        const client = await getServiceQuotasClient('invalid-region');
        try {
            await getCloudFormationQuota(client);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});
