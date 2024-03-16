import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/pricing-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/opentelemetry-scope';
import calculatePrice from '../../../src/operations/aws/pricing-operations';
import { PricingServiceRequestType } from '../../../src/routes/types/pricing.types';

describe('Pricing Operations', () => {
    it('calculate Price', async () => {
        const pricingRequest: PricingServiceRequestType = {
            compute: {
                regionCode: 'ap-southeast-1',
                instanceType: 'm5.xlarge',
                sqlSoftwareType: 'SQL std',
                sqlDeploymentMode: 'fci'
            },
            fsxnStorage: {
                regionCode: 'ap-southeast-1',
                diskSize: 102400,
                throughput: 1024,
                iops: 0,
                deploymentOption: 'MULTI_AZ_1'
            },
            ebsStorage: { regionCode: 'ap-southeast-1', size: 102400, throughput: 1024, iops: 0, volumeType: 'gp2' },
            vpc: {
                regionCode: 'ap-southeast-1'
            }
        };

        const { compute, fsxnStorage, vpc, ebsStorage } = pricingRequest;
        const resp = await calculatePrice(compute, fsxnStorage, vpc, ebsStorage);
        expect(resp).toBeDefined();
    });
});
