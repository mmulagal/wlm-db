import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/aws/pricing-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { DEFAULT_AWS_CREDENTIALS_TYPE } from '../../utils/consts';
import calculatePrice from '../../../src/operations/aws/pricing-operations';
import { PricingServiceRequestType } from '../../../src/routes/types/pricing.types';

describe('Pricing Operations', () => {
    it('calculate Price', async () => {
        const credentialsType = DEFAULT_AWS_CREDENTIALS_TYPE;

        const pricingRequest: PricingServiceRequestType = {
            compute: {
                regionCode: 'ap-southeast-1',
                instanceType: 'm5.xlarge',
                sqlSoftwareType: 'SQL std',
                sqlDeploymentMode: 'fci'
            },
            storage: {
                regionCode: 'ap-southeast-1',
                diskSize: 102400,
                throughput: 1024,
                iops: 0,
                deploymentOption: 'MULTI_AZ_1'
            },
            vpc: {
                regionCode: 'ap-southeast-1'
            }
        };

        const { compute, storage, vpc } = pricingRequest;
        const resp = await calculatePrice(credentialsType, compute, storage, vpc);
        expect(resp).toBeDefined();
    });
});
