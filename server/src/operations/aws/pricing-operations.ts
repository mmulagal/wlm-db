import createError from 'http-errors';
import { Filter, FilterType, GetProductsCommandInput, GetProductsCommandOutput } from '@aws-sdk/client-pricing';
import { LazyJsonString } from '@smithy/smithy-client';
import { compact, isEmpty } from 'lodash-es';
import { PricingServiceRequestType, PricingServiceResponseType } from '../../routes/types/pricing.types';
import getLogger from '../../utils/logger';
import { calculateFsxStorageCapacity, sizeInGigaBytes } from '../../utils/utils';
import {
    DEFAULT_AWS_REGION,
    FCI,
    INVALID_PARAMETER_VALUE,
    MAX_READ_REQUEST_FSXN,
    MAX_WRITE_REQUEST_FSXN,
    MIN_DISKSIZE,
    MIN_THROUGHPUT,
    SINGLE_AZ,
    SQL_SOFTWARE_TYPES
} from '../../utils/consts';
import getProducts from '../../lib/aws/pricing';
import { describeRegions, describeInstanceTypeOfferings } from '../../lib/aws/ec2';

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

interface ProductInput {
    name: string;
    input: GetProductsCommandInput;
}

interface ProductOutput {
    name: string;
    output: GetProductsCommandOutput;
}

const HOURS_IN_MONTH = 730;
const DEFAULT_EBS_STORAGE = 100; // 100GB

const AWS_PRICING_FORMAT_VERSION = {
    FormatVersion: 'aws_v1'
};

const fsxService = {
    ServiceCode: 'AmazonFSx'
};

const ec2Service = {
    ServiceCode: 'AmazonEC2'
};

const storageProductFamily: Filter = {
    Type: FilterType.TERM_MATCH,
    Field: 'productFamily',
    Value: 'Storage'
};

const readWriteRequestProductFamily: Filter = {
    Type: FilterType.TERM_MATCH,
    Field: 'productFamily',
    Value: 'Request'
};

function getPriceUtil(rate: number, quantity: number, resourceCount = 1): number {
    logger.debug('Calculate price util', { rate, quantity, resourceCount });

    return quantity * rate * resourceCount;
}

function getRegionCodeFilter(region?: string): Filter {
    logger.debug('Getting region code', { region });

    return {
        Type: FilterType.TERM_MATCH,
        Field: 'regionCode',
        Value: region || DEFAULT_AWS_REGION
    };
}

function getDeploymentOption(deploymentOption?: string): Filter {
    logger.debug('Getting deployment option', { deploymentOption });

    const deploymentString: string = deploymentOption === SINGLE_AZ ? 'Single-AZ_2N' : 'Multi-AZ';

    return {
        Type: FilterType.TERM_MATCH,
        Field: 'deploymentOption',
        Value: deploymentString
    };
}

function getSqlSoftwareEdition(sqlSoftwareType: string): Filter {
    logger.debug('Get sql software edition for filter', { sqlSoftwareType });

    const edition = SQL_SOFTWARE_TYPES.get(sqlSoftwareType?.toLocaleLowerCase()) || SQL_SOFTWARE_TYPES.get('standard');

    return {
        Type: FilterType.TERM_MATCH,
        Field: 'preInstalledSw',
        Value: edition!
    };
}

function getEc2InstaceInput(compute: PricingServiceRequestType['compute']): ProductInput {
    logger.info('Get ec2 instance input', { compute });

    return {
        name: 'ec2Instance',
        input: {
            Filters: [
                getRegionCodeFilter(compute.regionCode),
                getSqlSoftwareEdition(compute.sqlSoftwareType),
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'productFamily',
                    Value: 'Compute Instance'
                },
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'instanceType',
                    Value: compute.instanceType
                },
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'operatingSystem',
                    Value: 'windows'
                },
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'tenancy',
                    Value: 'Shared' // default Shared for now
                },
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'CapacityStatus',
                    Value: 'Used' // On-demand
                }
            ],
            ...ec2Service,
            ...AWS_PRICING_FORMAT_VERSION
        }
    };
}

function getEc2StorageInput(compute: PricingServiceRequestType['compute']): ProductInput {
    logger.info('Getting ec2 storage (EBS) input');

    return {
        name: 'ec2Storage',
        input: {
            Filters: [
                getRegionCodeFilter(compute.regionCode),
                storageProductFamily,
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'volumeType',
                    Value: 'General Purpose'
                },
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'volumeApiName',
                    Value: 'gp2'
                }
            ],
            ...ec2Service,
            ...AWS_PRICING_FORMAT_VERSION
        }
    };
}

function getFSxNStorageInput(storage: PricingServiceRequestType['storage']): ProductInput {
    logger.info('Geting FSxN Storage Input', { storage });

    return {
        name: 'fsxStorage',
        input: {
            Filters: [
                getRegionCodeFilter(storage?.regionCode),
                getDeploymentOption(storage?.deploymentOption),
                storageProductFamily,
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
            ...fsxService,
            ...AWS_PRICING_FORMAT_VERSION
        }
    };
}

function getFSxNThroughputInput(storage: PricingServiceRequestType['storage']): ProductInput {
    logger.info('Geting FSxN Throughput Input', { storage });

    return {
        name: 'fsxThroughput',
        input: {
            Filters: [
                getRegionCodeFilter(storage?.regionCode),
                getDeploymentOption(storage?.deploymentOption),
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'productFamily',
                    Value: 'Provisioned Throughput'
                },
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'fileSystemType',
                    Value: 'ONTAP'
                }
            ],
            ...fsxService,
            ...AWS_PRICING_FORMAT_VERSION
        }
    };
}

function getFSxNIopsInput(storage: PricingServiceRequestType['storage']): ProductInput {
    logger.info('Geting FSxN Iops Input', { storage });

    return {
        name: 'fsxIops',
        input: {
            Filters: [
                getRegionCodeFilter(storage?.regionCode),
                getDeploymentOption(storage?.deploymentOption),
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'productFamily',
                    Value: 'Provisioned IOPS'
                },
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'fileSystemType',
                    Value: 'ONTAP'
                }
            ],
            ...fsxService,
            ...AWS_PRICING_FORMAT_VERSION
        }
    };
}

function getFSxNReadRequestsInput(storage: PricingServiceRequestType['storage']): ProductInput {
    logger.info('Geting FSxN read requests Input', { storage });

    return {
        name: 'fsxReadRequests',
        input: {
            Filters: [
                getRegionCodeFilter(storage?.regionCode),
                getDeploymentOption(storage?.deploymentOption),
                readWriteRequestProductFamily,
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'fileSystemType',
                    Value: 'ONTAP'
                },
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'requestType',
                    Value: 'Read'
                }
            ],
            ...fsxService,
            ...AWS_PRICING_FORMAT_VERSION
        }
    };
}

function getFSxNWriteRequestsInput(storage: PricingServiceRequestType['storage']): ProductInput {
    logger.info('Geting FSxN write requests Input', { storage });

    return {
        name: 'fsxWriteRequests',
        input: {
            Filters: [
                getRegionCodeFilter(storage?.regionCode),
                getDeploymentOption(storage?.deploymentOption),
                readWriteRequestProductFamily,
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'fileSystemType',
                    Value: 'ONTAP'
                },
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'requestType',
                    Value: 'Write'
                }
            ],
            ...fsxService,
            ...AWS_PRICING_FORMAT_VERSION
        }
    };
}

function getVpcInput(vpcInfo: PricingServiceRequestType['vpc']): ProductInput {
    logger.info('Get VPC input', vpcInfo);

    return {
        name: 'vpc',
        input: {
            ...AWS_PRICING_FORMAT_VERSION,
            ServiceCode: 'AmazonVPC',
            Filters: [
                getRegionCodeFilter(vpcInfo?.regionCode),
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
            ]
        }
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

    if (isEmpty(response?.PriceList)) {
        logger.error('Invalid AWS SDK response:', { data: response?.PriceList });
        return 0;
    }

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
): ProductInput[] {
    logger.info('Getting product inputs', {
        compute,
        storage,
        vpc
    });

    return [
        getEc2InstaceInput(compute),
        getEc2StorageInput(compute),
        ...((storage && [
            getFSxNStorageInput(storage),
            getFSxNThroughputInput(storage),
            getFSxNIopsInput(storage),
            getFSxNReadRequestsInput(storage),
            getFSxNWriteRequestsInput(storage)
        ]) ||
            []),
        ...((vpc && [getVpcInput(vpc)]) || [])
    ];
}

async function validatePricingParameters(
    credentialsId: string,
    compute: PricingServiceRequestType['compute'],
    storage: PricingServiceRequestType['storage'],
    vpc: PricingServiceRequestType['vpc']
) {
    logger.debug('Validating pricing parameters:', { compute, storage, vpc });

    // AWS regions MUST be validated before describeInstanceTypeOfferings(),
    // without that invalid regions can get passed to latter.
    await validatePricingRegionParameters(credentialsId, compute, storage, vpc);
    await describeInstanceTypeOfferings(credentialsId, compute.regionCode, compute.instanceType);
}

async function validatePricingRegionParameters(
    credentialsId: string,
    compute: PricingServiceRequestType['compute'],
    storage: PricingServiceRequestType['storage'],
    vpc: PricingServiceRequestType['vpc']
) {
    logger.debug('Validating pricing parameters:', { compute, storage, vpc });

    try {
        const regions = compact([...new Set([compute.regionCode, storage?.regionCode, vpc?.regionCode])]);
        const regionsInput = {
            DryRun: false,
            AllRegions: true,
            RegionNames: regions
        };
        await describeRegions(regionsInput, credentialsId);
    } catch (error) {
        logger.error('Failed to describe regions:', JSON.stringify(error));

        if (error?.hasOwnProperty('$metadata')) {
            const { Code, message, $metadata } = error as { Code: string; message: string; $metadata: unknown };
            const { httpStatusCode } = $metadata as { httpStatusCode: number };

            if (Code === INVALID_PARAMETER_VALUE) {
                throw createError(httpStatusCode, message);
            }
        }
        throw error;
    }
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

    await validatePricingParameters(credentialsId, compute, storage, vpc);

    const inputList: ProductInput[] = compact(getInputs(compute, storage, vpc));

    const productsResponse = await Promise.all(
        inputList.map(
            async ({ name, input }): Promise<ProductOutput> => ({
                name,
                output: await getProducts(input)
            })
        )
    );

    const parsedResponse = productsResponse.reduce(
        (acc, product) => ({
            ...acc,
            [product.name]: parseResponse(product.output)
        }),
        {} as { [key: string]: number }
    );

    const {
        ec2Instance: ec2InstanceRate,
        ec2Storage: ec2StorageRate,
        fsxStorage: fsxStorageRate,
        fsxThroughput: fsxThroughputRate,
        fsxIops: fsxIopsRate,
        fsxReadRequests: fsxReadRequestsRate,
        fsxWriteRequests: fsxWriteRequestsRate,
        vpc: vpcRate
    } = parsedResponse;

    const ec2Cost = calculateEc2Cost(ec2InstanceRate, ec2StorageRate, compute?.sqlDeploymentMode);
    const vpcCost = vpcRate ? getPriceUtil(vpcRate, HOURS_IN_MONTH, 1) : 0;

    let fsxStorageCost = 0;
    let fsxThroughputCost = 0;
    let fsxDiskSizes;
    let fsxDisksize;
    if (storage) {
        // If the input size is database size, we need to calculate the total FSX storage capacity
        // In cases where the input is total FSx Storage capacity, we don't this calculation.
        if (storage.diskSize) {
            fsxDiskSizes = calculateFsxStorageCapacity(storage.diskSize);
            fsxDisksize = fsxDiskSizes.FSxStorageCapacity;
        } else {
            fsxDisksize = storage?.storageCapacity;
        }

        fsxDisksize = fsxDisksize || MIN_DISKSIZE;
        const fsxThroughput = storage?.throughput || MIN_THROUGHPUT;
        let fsxIops = storage?.iops || 3 * fsxDisksize;

        fsxStorageCost = calculateFsxStorageCost(fsxStorageRate, fsxDisksize);
        if (fsxIops > 3 * fsxDisksize) {
            fsxIops -= 3 * fsxDisksize; // Iops cost is only charged when its greater than 3 * diskSize and charging is only on the difference
        } else {
            fsxIops = 0; // Iops cost is 0 if it is less than or equal to  3 * diskSize
        }

        fsxThroughputCost = calculateFsxThroughputCost(
            fsxThroughputRate,
            fsxIopsRate,
            fsxReadRequestsRate,
            fsxWriteRequestsRate,
            fsxThroughput,
            fsxIops
        );
        logger.info('FSx  throughput cost value for demo', fsxThroughputCost);
    }

    return {
        compute: ec2Cost,
        ...(storage && {
            storage: {
                capacity: fsxStorageCost,
                throughput: fsxThroughputCost,
                // This is optional and only needed to display in UI
                ...(fsxDiskSizes && {
                    size: {
                        data: sizeInGigaBytes(fsxDiskSizes?.FSxDataVolumeSize),
                        log: sizeInGigaBytes(fsxDiskSizes?.FSxLogVolumeSize),
                        tempdb: sizeInGigaBytes(fsxDiskSizes?.FSxTempDbVolumeSize),
                        total: fsxDiskSizes?.FSxStorageCapacity,
                        ...(fsxDiskSizes?.FSxQuorumVolumeSize && {
                            quorum: sizeInGigaBytes(fsxDiskSizes?.FSxQuorumVolumeSize)
                        })
                    }
                })
            }
        }),
        ...(vpc && { vpc: vpcCost }),
        total: ec2Cost + vpcCost + fsxStorageCost + fsxThroughputCost
    };
}

export default calculatePrice;
