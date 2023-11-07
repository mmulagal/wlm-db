import { getServiceQuotasClient, listServiceQuota } from '../../../src/lib/aws/service-quotas';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import { DEFAULT_AWS_REGION, AWSServiceNames } from '../../../src/utils/consts';

import '../../simulator/scopes/aws/service-quota-scope';
import '../../simulator/scopes/opentelemetry-scope';

const CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';

describe('Service quota client', () => {
    it('Service quota client in valid region', async () => {
        const client = await getServiceQuotasClient(CREDENTIALS_ID, DEFAULT_AWS_REGION);
        expect(client).toBeDefined();
    });
    it('Service quota client in an invalid region', async () => {
        try {
            await listServiceQuota(CREDENTIALS_ID, DEFAULT_AWS_REGION, AWSServiceNames.CLOUDFORMATION);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});

describe('VPC quota', () => {
    it('VPC quota in valid region', async () => {
        const resp = await listServiceQuota(CREDENTIALS_ID, DEFAULT_AWS_REGION, AWSServiceNames.VPC);
        expect(resp).toBeDefined();
    });
    it('VPC quota in an invalid region', async () => {
        try {
            await listServiceQuota(CREDENTIALS_ID, DEFAULT_AWS_REGION, AWSServiceNames.VPC);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});

describe('Cloudformation quota', () => {
    it('Cloudformation quota in valid region', async () => {
        const resp = await listServiceQuota(CREDENTIALS_ID, DEFAULT_AWS_REGION, AWSServiceNames.CLOUDFORMATION);
        expect(resp).toBeDefined();
    });
    it('Cloudformation quota in an invalid region', async () => {
        try {
            await listServiceQuota(CREDENTIALS_ID, DEFAULT_AWS_REGION, AWSServiceNames.CLOUDFORMATION);
        } catch (error: any) {
            expect(error.code.includes('ENOTFOUND')).toBeTruthy();
        }
    });
});
