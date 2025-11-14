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
                fsxnResourceInfo: [
                    {
                        diskSize: 102400,
                        throughput: 1024,
                        iops: 0,
                        deploymentOption: 'MULTI_AZ_1'
                    }
                ]
            },
            ebsStorage: {
                regionCode: 'ap-southeast-1',
                ebsResourceInfo: [
                    { id: 'vol-test-1', size: 102400, throughput: 1024, iops: 0, volumeType: 'gp3' },
                    { id: 'vol-test-2', size: 102400, throughput: 1024, volumeType: 'gp2' },
                    { id: 'vol-test-3', size: 102400, iops: 0, volumeType: 'st1' }
                ]
            },
            vpc: {
                regionCode: 'ap-southeast-1'
            }
        };

        const { compute, fsxnStorage, vpc, ebsStorage } = pricingRequest;
        const resp = await calculatePrice(compute, fsxnStorage, vpc, ebsStorage);
        expect(resp).toBeDefined();
        expect(resp.ebsStorage?.ebsBreakdownByVolumeType).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 'ROOT_VOLUME1' })])
        ); // ROOT_VOLUME1 is always present if there's an ec2;
    });

    // TODO: Fix the test case, to run it with scope instead of actual API call
    it.skip('Calculate FSxWindows capacity price', async () => {
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
