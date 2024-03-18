import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import {
    getProductRates,
    calculateFsxWindowsCapacityPrice,
    calculatePrice
} from '../../../src/operations/aws/pricing-operations';
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

    it('Calculate FSxWindows capacity price', async () => {
        const capacity = 1024;
        const storageType = 'ssd';
        const iops = 0;
        const throughput = 125;
        const expectedPrice = 469.62;

        const { fsxwStorage: storageRates } = await getProductRates([
            {
                name: 'fsxwStorage',
                input: {
                    Filters: [
                        {
                            Type: 'TERM_MATCH',
                            Field: 'fileSystemType',
                            Value: 'Windows'
                        },
                        {
                            Type: 'TERM_MATCH',
                            Field: 'deploymentOption',
                            Value: 'Single-AZ'
                        },
                        {
                            Type: 'TERM_MATCH',
                            Field: 'regionCode',
                            Value: 'ap-southeast-1'
                        }
                    ],
                    ServiceCode: 'AmazonFSx',
                    FormatVersion: 'aws_v1'
                }
            }
        ]);
        let resp = calculateFsxWindowsCapacityPrice(capacity, storageType, iops, throughput, 1, storageRates);
        resp = Number(resp.toFixed(2));
        expect(resp).toEqual(expectedPrice);
    });
});
