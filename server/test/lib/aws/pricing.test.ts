import { GetProductsCommandInput } from '@aws-sdk/client-pricing';
import mockGetProductsResponse from '../../simulator/scopes/aws/pricing-scope';
import getProducts from '../../../src/lib/aws/pricing';

describe('Pricing Lib', () => {
    it('Get Products', async () => {
        const productFilters: GetProductsCommandInput = {
            Filters: [
                {
                    Type: 'TERM_MATCH',
                    Field: 'regionCode',
                    Value: 'ap-southeast-1'
                },
                {
                    Type: 'TERM_MATCH',
                    Field: 'deploymentOption',
                    Value: 'Multi-AZ'
                },
                {
                    Type: 'TERM_MATCH',
                    Field: 'productFamily',
                    Value: 'Storage'
                },
                {
                    Type: 'TERM_MATCH',
                    Field: 'fileSystemType',
                    Value: 'ONTAP'
                },
                {
                    Type: 'TERM_MATCH',
                    Field: 'StorageType',
                    Value: 'SSD'
                }
            ],
            ServiceCode: 'AmazonFSx',
            FormatVersion: 'aws_v1'
        };
        const resp = await getProducts(productFilters);
        expect(resp.PriceList).toEqual(mockGetProductsResponse.PriceList);
    });
});
