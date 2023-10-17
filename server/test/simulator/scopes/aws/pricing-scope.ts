import { PricingClient, GetProductsCommand } from '@aws-sdk/client-pricing';
import { LazyJsonString } from '@smithy/smithy-client';
import { mockClient } from 'aws-sdk-client-mock';

const pricingMock = mockClient(PricingClient);

const price: LazyJsonString = LazyJsonString.fromObject(
    '{"product":{"productFamily":"Compute Instance","attributes":{"servicecode":"AmazonEC2","instanceType":"t3.micro","location":"US East (N. Virginia)","memory":"1 GiB","vcpu":"2"}},"terms":{"OnDemand":{"us-east-1":{"priceDimensions":{"us-east-1-ondemand":{"pricePerUnit":{"USD":"0.0058"}}}}}}}'
);

const mockGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [price]
};

pricingMock.on(GetProductsCommand).resolves(mockGetProductsResponse);

export default mockGetProductsResponse;
