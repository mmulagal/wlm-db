import { GetProductsCommandInput, GetProductsCommandOutput } from '@aws-sdk/client-pricing';
import { LazyJsonString } from '@smithy/smithy-client';
import { PricingServiceRequestType, PricingServiceResponseType } from '../../routes/types/pricing.types';
import getLogger from '../../utils/logger';
import { calculateFsxStorageCapacity } from '../../utils/utils';
import {
    DEFAULT_AWS_REGION,
    FCI,
    MAX_READ_REQUEST_FSXN,
    MAX_WRITE_REQUEST_FSXN,
    MIN_DISKSIZE,
    MIN_THROUGHPUT,
    SINGLE_AZ
} from '../../utils/consts';
import getProducts from '../../lib/aws/pricing';

const logger = getLogger();

interface PriceObject {
    unit: string;
    pricePerUnit: {
        USD: string;
    };
}

interface Terms {
    OnDemand: {
        [key: string]: {
            priceDimensions: {
                [key: string]: PriceObject;
            };
        };
    };
}

interface Product {
    product: {
        productFamily: string;
        attributes: {
            [key: string]: string;
        };
        sku: string;
    };
    serviceCode: string;
    terms: Terms;
}

interface Filter {
    Type: string;
    Field: string;
    Value: string;
}

const HOURS_IN_MONTH = 730;
const DEFAULT_EBS_STORAGE = 100; // 100GB

const sqlSoftwareTypes = new Map<string, string>([
    ['standard', 'SQL std'],
    ['enterprise', 'SQL ent'],
    ['web', 'SQL web']
]);

const AWS_PRICING_FORMAT_VERSION = {
    FormatVersion: 'aws_v1'
};

const AWS_PRICING_FILTER_TERM_MATCH = 'TERM_MATCH';

const fsxService = {
    ServiceCode: 'AmazonFSx'
};

const ec2Service = {
    ServiceCode: 'AmazonEC2'
};

const storageProductFamily: Filter = {
    Type: AWS_PRICING_FILTER_TERM_MATCH,
    Field: 'productFamily',
    Value: 'Storage'
};

const readWriteRequestProductFamily: Filter = {
    Type: AWS_PRICING_FILTER_TERM_MATCH,
    Field: 'productFamily',
    Value: 'Request'
};

function getPriceUtil(rate: number, quantity: number, resourceCount = 1): number {
    logger.info('Calculating price');

    return quantity * rate * resourceCount;
}

function getRegionCodeFilter(region?: string): Filter {
    logger.debug('Getting region code', { region });

    return {
        Type: AWS_PRICING_FILTER_TERM_MATCH,
        Field: 'regionCode',
        Value: region || DEFAULT_AWS_REGION
    };
}

function getDeploymentOption(deploymentOption?: string): Filter {
    logger.debug('Getting deployment option', { deploymentOption });

    const deploymentString: string = deploymentOption === SINGLE_AZ ? 'Single-AZ_2N' : 'Multi-AZ';

    return {
        Type: AWS_PRICING_FILTER_TERM_MATCH,
        Field: 'deploymentOption',
        Value: deploymentString
    };
}

function getSqlSoftwareEdition(sqlSoftwareType: string): Filter {
    logger.debug('Get sql software edition for filter', { sqlSoftwareType });

    const edition = sqlSoftwareTypes.get(sqlSoftwareType?.toLocaleLowerCase()) || sqlSoftwareTypes.get('standard');

    return {
        Type: AWS_PRICING_FILTER_TERM_MATCH,
        Field: 'preInstalledSw',
        Value: edition!
    };
}

function getEc2InstaceInput(compute: PricingServiceRequestType['compute']): GetProductsCommandInput {
    logger.info('Get ec2 instance input', { compute });

    return {
        Filters: [
            getRegionCodeFilter(compute.regionCode),
            getSqlSoftwareEdition(compute.sqlSoftwareType),
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'productFamily',
                Value: 'Compute Instance'
            },
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'instanceType',
                Value: compute.instanceType
            },
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'operatingSystem',
                Value: 'windows'
            },
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'tenancy',
                Value: 'Shared' // default Shared for now
            },
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'CapacityStatus',
                Value: 'Used' // On-demand
            }
        ],
        ...ec2Service,
        ...AWS_PRICING_FORMAT_VERSION
    };
}

function getEc2StorageInput(compute: PricingServiceRequestType['compute']): GetProductsCommandInput {
    logger.info('Getting ec2 storage (EBS) input');

    return {
        Filters: [
            getRegionCodeFilter(compute.regionCode),
            storageProductFamily,
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'volumeType',
                Value: 'General Purpose'
            },
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'volumeApiName',
                Value: 'gp2'
            }
        ],
        ...ec2Service,
        ...AWS_PRICING_FORMAT_VERSION
    };
}

function getFSxNStorageInput(storage: PricingServiceRequestType['storage']): GetProductsCommandInput {
    logger.info('Geting FSxN Storage Input', { storage });

    return {
        Filters: [
            getRegionCodeFilter(storage?.regionCode),
            getDeploymentOption(storage?.deploymentOption),
            storageProductFamily,
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'fileSystemType',
                Value: 'ONTAP'
            },
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'StorageType',
                Value: 'SSD'
            }
        ],
        ...fsxService,
        ...AWS_PRICING_FORMAT_VERSION
    };
}

function getFSxNThroughputInput(storage: PricingServiceRequestType['storage']): GetProductsCommandInput {
    logger.info('Geting FSxN Throughput Input', { storage });

    return {
        Filters: [
            getRegionCodeFilter(storage?.regionCode),
            getDeploymentOption(storage?.deploymentOption),
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'productFamily',
                Value: 'Provisioned Throughput'
            },
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'fileSystemType',
                Value: 'ONTAP'
            }
        ],
        ...fsxService,
        ...AWS_PRICING_FORMAT_VERSION
    };
}

function getFSxNIopsInput(storage: PricingServiceRequestType['storage']): GetProductsCommandInput {
    logger.info('Geting FSxN Iops Input', { storage });

    return {
        Filters: [
            getRegionCodeFilter(storage?.regionCode),
            getDeploymentOption(storage?.deploymentOption),
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'productFamily',
                Value: 'Provisioned IOPS'
            },
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'fileSystemType',
                Value: 'ONTAP'
            }
        ],
        ...fsxService,
        ...AWS_PRICING_FORMAT_VERSION
    };
}

function getFSxNReadRequestsInput(storage: PricingServiceRequestType['storage']): GetProductsCommandInput {
    logger.info('Geting FSxN read requests Input', { storage });

    return {
        Filters: [
            getRegionCodeFilter(storage?.regionCode),
            getDeploymentOption(storage?.deploymentOption),
            readWriteRequestProductFamily,
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'fileSystemType',
                Value: 'ONTAP'
            },
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'requestType',
                Value: 'Read'
            }
        ],
        ...fsxService,
        ...AWS_PRICING_FORMAT_VERSION
    };
}

function getFSxNWriteRequestsInput(storage: PricingServiceRequestType['storage']): GetProductsCommandInput {
    logger.info('Geting FSxN write requests Input', { storage });

    return {
        Filters: [
            getRegionCodeFilter(storage?.regionCode),
            getDeploymentOption(storage?.deploymentOption),
            readWriteRequestProductFamily,
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'fileSystemType',
                Value: 'ONTAP'
            },
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'requestType',
                Value: 'Write'
            }
        ],
        ...fsxService,
        ...AWS_PRICING_FORMAT_VERSION
    };
}

function getVpcInput(vpcInfo: PricingServiceRequestType['vpc']): GetProductsCommandInput {
    logger.info('Get VPC input', vpcInfo);

    return {
        ...AWS_PRICING_FORMAT_VERSION,
        ServiceCode: 'AmazonVPC',
        Filters: [
            getRegionCodeFilter(vpcInfo?.regionCode),
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'group',
                Value: 'AWSClientVPN'
            },
            {
                Type: AWS_PRICING_FILTER_TERM_MATCH,
                Field: 'operation',
                Value: 'ClientVPNConnections'
            }
        ]
    };
}

function parseResponse(response: GetProductsCommandOutput): number {
    logger.info('Parse Pricing Response', { response });

    /**
     * Sample response:
     * [{
            "product": {
                "productFamily": "Storage",
                "attributes": {
                    ...
                },
                "sku": "NXJD8KBTG7YXFF7F"
            },
            "serviceCode": "AmazonFSx",
            "terms": {
                "OnDemand": {
                    "NXJD8KBTG7YXFF7F.JRTCKXETXF": {
                        "priceDimensions": {
                            "NXJD8KBTG7YXFF7F.JRTCKXETXF.6YS6EN2CT7": {
                                "unit": "GB-Mo",
                                "pricePerUnit": {
                                    "USD": "0.2500000000"
                                }
                            }
                        },
                        ...
                    }
                }
            },
            "version": "20230905212148",
            "publicationDate": "2023-09-05T21:21:48Z"
        }]
     */

    const [serializedResponse]: Product[] = (response?.PriceList || []).map(k =>
        (k as LazyJsonString).deserializeJSON()
    );

    const { OnDemand }: Terms = serializedResponse?.terms || {};

    const [{ priceDimensions }] = Object.values(OnDemand);

    const [
        {
            unit,
            pricePerUnit: { USD: rate }
        }
    ]: PriceObject[] = Object.values(priceDimensions);

    logger.debug({ rate, unit });

    return Number(rate);
}

function calculateEc2Cost(instanceRate: number, storageRate: number, deploymentMode: string): number {
    logger.debug('Calculating compute cost');

    const instanceCount = deploymentMode === FCI ? 2 : 1;
    return (
        getPriceUtil(instanceRate, HOURS_IN_MONTH, instanceCount) +
        getPriceUtil(storageRate, DEFAULT_EBS_STORAGE, instanceCount)
    );
}

function calculateFsxStorageCost(instanceRate: number, diskSize: number): number {
    logger.debug('Calculating fsx storage cost', { instanceRate, diskSize });

    return getPriceUtil(instanceRate, diskSize);
}

function calculateFsxThroughputCost(
    fsxThroughputRate: number,
    fsxIopsRate: number,
    fsxReadRequestsRate: number,
    fsxWriteRequestsRate: number,
    storageThroughput: number,
    storageIops: number,
    storageReadRequest: number = MAX_READ_REQUEST_FSXN,
    storageWriteRequest: number = MAX_WRITE_REQUEST_FSXN
): number {
    logger.debug('Calculating fsx storage cost', {
        fsxThroughputRate,
        fsxIopsRate,
        fsxReadRequestsRate,
        fsxWriteRequestsRate,
        storageThroughput,
        storageIops,
        storageReadRequest,
        storageWriteRequest
    });

    return (
        getPriceUtil(fsxThroughputRate, storageThroughput) +
        getPriceUtil(fsxIopsRate, storageIops) +
        getPriceUtil(fsxReadRequestsRate, storageReadRequest) +
        getPriceUtil(fsxWriteRequestsRate, storageWriteRequest)
    );
}

function getInputs(
    compute: PricingServiceRequestType['compute'],
    storage: PricingServiceRequestType['storage'],
    vpc: PricingServiceRequestType['vpc']
): GetProductsCommandInput[] {
    logger.info('Getting product inputs', {
        compute,
        storage,
        vpc
    });

    return [
        getEc2InstaceInput(compute),
        getEc2StorageInput(compute),
        getFSxNStorageInput(storage),
        getFSxNThroughputInput(storage),
        getFSxNIopsInput(storage),
        getFSxNReadRequestsInput(storage),
        getFSxNWriteRequestsInput(storage),
        ...((vpc && [getVpcInput(vpc)]) || [])
    ];
}

async function calculatePrice(
    credentialsId: string,
    compute: PricingServiceRequestType['compute'],
    storage: PricingServiceRequestType['storage'],
    vpc: PricingServiceRequestType['vpc']
): Promise<PricingServiceResponseType> {
    logger.info('Calculating price for AWS resources', {
        compute,
        storage,
        vpc
    });

    // If the input size is database size, we need to calculate the total FSX storage capacity
    // In cases where the input is total FSx Storage capacity, we don't this calculation.
    if (storage && storage.diskSize) {
        const fsxDiskSizes = calculateFsxStorageCapacity(storage.diskSize);
        storage.diskSize = fsxDiskSizes.FSxStorageCapacity;
    }

    const inputList: GetProductsCommandInput[] = getInputs(compute, storage, vpc);

    const productsResponse = await Promise.all(
        inputList.map(
            async (input: GetProductsCommandInput): Promise<GetProductsCommandOutput> =>
                getProducts(credentialsId, input)
        )
    );

    const [
        ec2InstanceRate,
        ec2StorageRate,
        fsxStorageRate,
        fsxThroughputRate,
        fsxIopsRate,
        fsxReadRequestsRate,
        fsxWriteRequestsRate,
        vpcRate
    ] = (productsResponse || []).map(parseResponse);

    const ec2Cost = calculateEc2Cost(ec2InstanceRate, ec2StorageRate, compute?.sqlDeploymentMode);
    const vpcCost = vpcRate ? getPriceUtil(vpcRate, HOURS_IN_MONTH, 1) : 0;

    logger.debug(fsxStorageRate, fsxThroughputRate, fsxIopsRate, fsxReadRequestsRate, fsxWriteRequestsRate);

    const fsxDisksize = storage?.diskSize || MIN_DISKSIZE;
    const fsxThroughput = storage?.throughput || MIN_THROUGHPUT;
    const fsxIops = storage?.iops || 3 * fsxDisksize;

    const fsxStorageCost = calculateFsxStorageCost(fsxStorageRate, fsxDisksize);

    const fsxThroughputCost = calculateFsxThroughputCost(
        fsxThroughputRate,
        fsxIopsRate,
        fsxReadRequestsRate,
        fsxWriteRequestsRate,
        fsxThroughput,
        fsxIops
    );

    return {
        storage: {
            capacity: fsxStorageCost,
            throughput: fsxThroughputCost
        },
        compute: ec2Cost,
        ...(vpc && { vpc: vpcCost }),
        total: ec2Cost + vpcCost + fsxStorageCost + fsxThroughputCost
    };
}

export default calculatePrice;
