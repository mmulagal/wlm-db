import { faker } from '@faker-js/faker';
import { GetProductsCommandInput } from '@aws-sdk/client-pricing';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import mockfsxStoragePriceGetProductsResponse from '../../simulator/scopes/aws/pricing-scope';
import '../../simulator/scopes/opentelemetry-scope';
import getProducts from '../../../src/lib/aws/pricing';

describe('Pricing Lib', () => {
    const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
    it('Get Products', async () => {
        const productFilters: GetProductsCommandInput = {
            Filters: [
                {
                    Type: 'TERM_MATCH',
                    Field: 'regionCode',
                    Value: 'us-east-1'
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
        const resp = await getProducts(CREDENTIALS_ID, productFilters);
        expect(resp).toEqual(mockfsxStoragePriceGetProductsResponse);
    });
});
