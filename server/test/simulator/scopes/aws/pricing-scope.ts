import { PricingClient, GetProductsCommand, GetProductsCommandInput, FilterType } from '@aws-sdk/client-pricing';
import { LazyJsonString } from '@smithy/smithy-client';
import { mockClient } from 'aws-sdk-client-mock';

const pricingMock = mockClient(PricingClient);

const ec2InstancePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Compute Instance", "attributes": {"servicecode": "AmazonEC2","instanceType": "m5.xlarge","location": "US East (N. Virginia)","memory": "1 GiB","vcpu": "2"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.192"}}}}}}}'
);

const ec2StoragePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Storage", "attributes": {"servicecode": "AmazonEC2","location": "US East (N. Virginia)"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.08"}}}}}}}'
);
const vpcStoragePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"attributes": {"servicecode": "AmazonVPC","location": "US East (N. Virginia)"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.08"}}}}}}}'
);

const ebsStoragePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Storage", "attributes": {"servicecode": "AmazonEC2","location": "US East (N. Virginia)"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.03"}}}}}}}'
);

const ebsIopsPrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "System Operation", "attributes": {"servicecode": "AmazonEC2","location": "US East (N. Virginia)"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.03"}}}}}}}'
);

const ebsThroughputPrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Provisioned Throughput", "attributes": {"servicecode": "AmazonEC2","location": "US East (N. Virginia)"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.03"}}}}}}}'
);
const fsxStoragePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Storage", "attributes": {"servicecode": "AmazonFSx","location": "US East (N. Virginia)", "deploymentOption": "Multi-AZ", "fileSystemType": "ONTAP"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.25"}}}}}}}'
);

const fsxIopsPrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Provisioned IOPS", "attributes": {"servicecode": "AmazonFSx","location": "US East (N. Virginia)", "deploymentOption": "Multi-AZ", "fileSystemType": "ONTAP"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.034"}}}}}}}'
);

const fsxReadPrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Request", "attributes": {"servicecode": "AmazonFSx","location": "US East (N. Virginia)", "deploymentOption": "Multi-AZ","fileSystemType": "ONTAP", "requestType": "Read"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.0000004"}}}}}}}'
);

const fsxWritePrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Request", "attributes": {"servicecode": "AmazonFSx","location": "US East (N. Virginia)", "deploymentOption": "Multi-AZ", "fileSystemType": "ONTAP", "requestType": "Write"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "0.000005"}}}}}}}'
);

const fsxThroughputPrice: LazyJsonString = LazyJsonString.fromObject(
    '{ "product": {"productFamily": "Provisioned Throughput", "attributes": {"servicecode": "AmazonFSx","location": "US East (N. Virginia)", "deploymentOption": "Multi-AZ", "fileSystemType": "ONTAP", "requestType": "Write"}},"terms": {"OnDemand": {"us-east-1": {"priceDimensions": {"us-east-1-ondemand": {"pricePerUnit": {"USD": "1.20"}}}}}}}'
);

const mockec2InstancePriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [ec2InstancePrice]
};

const mockec2StoragePriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [ec2StoragePrice]
};

const mockebsStoragePriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [ebsStoragePrice, ebsIopsPrice, ebsThroughputPrice]
};
const mockfsxStoragePriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [fsxStoragePrice]
};
// const mockfsxIopsPriceGetProductsResponse = {
//     $metadata: {
//         httpStatusCode: 200,
//         requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
//         extendedRequestId: undefined,
//         cfId: undefined,
//         attempts: 1,
//         totalRetryDelay: 0
//     },
//     FormatVersion: 'aws_v1',
//     PriceList: [fsxIopsPrice]
// };
// const mockfsxReadPriceGetProductsResponse = {
//     $metadata: {
//         httpStatusCode: 200,
//         requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
//         extendedRequestId: undefined,
//         cfId: undefined,
//         attempts: 1,
//         totalRetryDelay: 0
//     },
//     FormatVersion: 'aws_v1',
//     PriceList: [fsxReadPrice]
// };
// const mockfsxWritePriceGetProductsResponse = {
//     $metadata: {
//         httpStatusCode: 200,
//         requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
//         extendedRequestId: undefined,
//         cfId: undefined,
//         attempts: 1,
//         totalRetryDelay: 0
//     },
//     FormatVersion: 'aws_v1',
//     PriceList: [fsxWritePrice]
// };
const mockfsxThroughputPriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [fsxThroughputPrice, fsxIopsPrice, fsxReadPrice, fsxWritePrice]
};
const mockVPCPriceGetProductsResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'c8501a83-530c-47ce-9ebd-3a8b9674f759',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    FormatVersion: 'aws_v1',
    PriceList: [vpcStoragePrice]
};

// const FSXREADREQUESTSRATEFILTER: GetProductsCommandInput = {
//     Filters: [
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'regionCode',
//             Value: 'us-east-1'
//         },
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'deploymentOption',
//             Value: 'Multi-AZ'
//         },
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'productFamily',
//             Value: 'Request'
//         },
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'fileSystemType',
//             Value: 'ONTAP'
//         },
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'requestType',
//             Value: 'Read'
//         }
//     ],
//     ServiceCode: 'AmazonFSx',
//     FormatVersion: 'aws_v1'
// };

const EC2STORAGERATEFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'productFamily',
            Value: 'Storage'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'volumeType',
            Value: 'General Purpose'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'volumeApiName',
            Value: 'gp3'
        }
    ],
    ServiceCode: 'AmazonEC2',
    FormatVersion: 'aws_v1'
};

const EBSSTORAGERATEFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'productFamily',
            Value: 'Storage'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'volumeApiName',
            Value: 'gp2'
        }
    ],
    ServiceCode: 'AmazonEC2',
    FormatVersion: 'aws_v1'
};

const FSXTHROUGHPUTRATEFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'deploymentOption',
            Value: 'Multi-AZ'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'fileSystemType',
            Value: 'ONTAP'
        }
    ],
    ServiceCode: 'AmazonFSx',
    FormatVersion: 'aws_v1'
};

// const FSXIOPSRATEFILTER: GetProductsCommandInput = {
//     Filters: [
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'regionCode',
//             Value: 'ap-southeast-1'
//         },
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'deploymentOption',
//             Value: 'Multi-AZ'
//         },
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'productFamily',
//             Value: 'Provisioned IOPS'
//         },
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'fileSystemType',
//             Value: 'ONTAP'
//         }
//     ],
//     ServiceCode: 'AmazonFSx',
//     FormatVersion: 'aws_v1'
// };

const FSXSTORAGERATEFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'deploymentOption',
            Value: 'Multi-AZ'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'productFamily',
            Value: 'Storage'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'fileSystemType',
            Value: 'ONTAP'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'StorageType',
            Value: 'SSD'
        }
    ],
    ServiceCode: 'AmazonFSx',
    FormatVersion: 'aws_v1'
};

const EC2INSTANCERATEFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'preInstalledSw',
            Value: 'SQL std'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'productFamily',
            Value: 'Compute Instance'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'instanceType',
            Value: 'm5.xlarge'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'operatingSystem',
            Value: 'windows'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'tenancy',
            Value: 'Shared'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'CapacityStatus',
            Value: 'Used'
        }
    ],
    ServiceCode: 'AmazonEC2',
    FormatVersion: 'aws_v1'
};

// const FSXWRITEREQUESTSRATEFILTER: GetProductsCommandInput = {
//     Filters: [
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'regionCode',
//             Value: 'ap-southeast-1'
//         },
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'deploymentOption',
//             Value: 'Multi-AZ'
//         },
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'productFamily',
//             Value: 'Request'
//         },
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'fileSystemType',
//             Value: 'ONTAP'
//         },
//         {
//             Type: FilterType.TERM_MATCH,
//             Field: 'requestType',
//             Value: 'Write'
//         }
//     ],
//     ServiceCode: 'AmazonFSx',
//     FormatVersion: 'aws_v1'
// };

const price: LazyJsonString = LazyJsonString.fromObject(
    '{"product":{"productFamily":"Compute Instance","attributes":{"servicecode":"AmazonEC2","instanceType":"t3.micro","location":"US East (N. Virginia)","memory":"1 GiB","vcpu":"2"}},"terms":{"OnDemand":{"us-east-1":{"priceDimensions":{"us-east-1-ondemand":{"pricePerUnit":{"USD":"0.00158"}}}}}}}'
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
const VPCFILTER: GetProductsCommandInput = {
    Filters: [
        {
            Type: FilterType.TERM_MATCH,
            Field: 'regionCode',
            Value: 'ap-southeast-1'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'group',
            Value: 'AWSClientVPN'
        },
        {
            Type: FilterType.TERM_MATCH,
            Field: 'operation',
            Value: 'ClientVPNConnections'
        }
    ],
    ServiceCode: 'AmazonVPC',
    FormatVersion: 'aws_v1'
};

//pricingMock.on(GetProductsCommand, FSXIOPSRATEFILTER).resolves(mockfsxIopsPriceGetProductsResponse);
//pricingMock.on(GetProductsCommand, FSXREADREQUESTSRATEFILTER).resolves(mockfsxReadPriceGetProductsResponse);
pricingMock.on(GetProductsCommand, FSXSTORAGERATEFILTER).resolves(mockfsxStoragePriceGetProductsResponse);
pricingMock.on(GetProductsCommand, FSXTHROUGHPUTRATEFILTER).resolves(mockfsxThroughputPriceGetProductsResponse);
// pricingMock.on(GetProductsCommand, FSXWRITEREQUESTSRATEFILTER).resolves(mockfsxWritePriceGetProductsResponse);
pricingMock.on(GetProductsCommand, EC2INSTANCERATEFILTER).resolves(mockec2InstancePriceGetProductsResponse);
pricingMock.on(GetProductsCommand, EC2STORAGERATEFILTER).resolves(mockec2StoragePriceGetProductsResponse);
pricingMock.on(GetProductsCommand, EBSSTORAGERATEFILTER).resolves(mockebsStoragePriceGetProductsResponse);
//pricingMock.on(GetProductsCommand).resolves(mockGetProductsResponse);
pricingMock.on(GetProductsCommand, VPCFILTER).resolves(mockVPCPriceGetProductsResponse);

export default mockGetProductsResponse;
