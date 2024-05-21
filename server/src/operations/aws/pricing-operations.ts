import createError from 'http-errors';
import { Filter, FilterType, GetProductsCommandInput, GetProductsCommandOutput } from '@aws-sdk/client-pricing';
import { LazyJsonString } from '@smithy/smithy-client';
import { compact, isEmpty } from 'lodash-es';
import numeral from 'numeral';
import { PricingServiceRequestType, PricingServiceResponseType } from '../../routes/types/pricing.types';
import getLogger from '../../utils/logger';
import { calculateFsxnStorageCapacity, sizeInGigaBytes } from '../../utils/utils';
import {
    DEFAULT_AWS_REGION,
    FCI,
    MAX_FSX_STORAGE_IN_GIB,
    MAX_READ_REQUEST_FSXN,
    MAX_WRITE_REQUEST_FSXN,
    MIN_DISKSIZE,
    MIN_THROUGHPUT,
    CUSTOM,
    SINGLE_AZ,
    SQL_SOFTWARE_TYPES,
    SQL_STD
} from '../../utils/consts';
import getProducts from '../../lib/aws/pricing';

const logger = getLogger();

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

    const edition = SQL_SOFTWARE_TYPES.get(sqlSoftwareType) || SQL_SOFTWARE_TYPES.get(SQL_STD);

    return {
        Type: FilterType.TERM_MATCH,
        Field: 'preInstalledSw',
        Value: edition!
    };
}

function getEc2InstaceInput(compute: PricingServiceRequestType['compute']): ProductInput {
    logger.info('Get ec2 instance input', { compute });

    const filters = {
        name: 'ec2Instance',
        input: {
            Filters: [
                getRegionCodeFilter(compute.regionCode),
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
    // add this filter based on whether its windows sql based ami or not
    if (compute.sqlSoftwareType && compute.sqlSoftwareType !== CUSTOM) {
        const sqlFilter = getSqlSoftwareEdition(compute.sqlSoftwareType);
        filters.input.Filters.push(sqlFilter);
    }
    return filters;
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
                    Value: 'gp3'
                }
            ],
            ...ec2Service,
            ...AWS_PRICING_FORMAT_VERSION
        }
    };
}

function getEbsStorageInput(region: string, volumeType: string): ProductInput {
    logger.info('Getting ec2 storage (EBS) input');

    return {
        name: `ebsStorage-${volumeType}`,
        input: {
            Filters: [
                getRegionCodeFilter(region),
                storageProductFamily,
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'volumeApiName',
                    Value: volumeType
                }
            ],
            ...ec2Service,
            ...AWS_PRICING_FORMAT_VERSION
        }
    };
}

function getProductsInputForFSxN(region: string, deploymentOption: string): ProductInput {
    logger.info('Geting FSxN pricing metrics', { region, deploymentOption });

    return {
        name: 'fsxnStorage',
        input: {
            Filters: [
                getRegionCodeFilter(region),
                getDeploymentOption(deploymentOption),
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

function calculateEc2Cost(instanceRate: number, storageRate: number, deploymentMode: string): number {
    logger.debug('Calculating compute cost');

    const instanceCount = deploymentMode === FCI ? 2 : 1;
    return (
        getPriceUtil(instanceRate, HOURS_IN_MONTH, instanceCount) +
        getPriceUtil(storageRate, DEFAULT_EBS_STORAGE, instanceCount)
    );
}

function calculateFsxnStorageCost(instanceRate: number, diskSize: number): number {
    logger.debug('Calculating fsx netapp storage cost', { instanceRate, diskSize });

    return getPriceUtil(instanceRate, diskSize);
}

function calculateFsxOperationalCost(
    fsxThroughputRate: number,
    fsxIopsRate: number,
    fsxReadRequestsRate: number,
    fsxWriteRequestsRate: number,
    storageThroughput: number,
    storageIops: number,
    storageReadRequest: number = MAX_READ_REQUEST_FSXN,
    storageWriteRequest: number = MAX_WRITE_REQUEST_FSXN
): number {
    logger.debug('Calculating fsx operational cost', {
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
    fsxnStorage: PricingServiceRequestType['fsxnStorage'],
    ebsStorage: PricingServiceRequestType['ebsStorage'],
    vpc: PricingServiceRequestType['vpc'],
    fsxwStorage: PricingServiceRequestType['fsxwStorage']
): ProductInput[] {
    logger.info('Getting product inputs', {
        compute,
        fsxnStorage,
        vpc,
        ebsStorage,
        fsxwStorage
    });

    let inputList: ProductInput[] = [
        getEc2InstaceInput(compute),
        getEc2StorageInput(compute),
        ...((fsxnStorage && [getProductsInputForFSxN(fsxnStorage.regionCode, fsxnStorage.deploymentOption!)]) || []),
        ...((fsxwStorage && [getProductsInputForFSxWindows(fsxwStorage.regionCode, fsxwStorage.deploymentOption!)]) ||
            []),
        ...((vpc && [getVpcInput(vpc)]) || [])
    ];

    if (ebsStorage && ebsStorage.ebsResourceInfo.length > 0) {
        const ebsStorageProductInputList = ebsStorage.ebsResourceInfo.map(ebsResource =>
            getEbsStorageInput(ebsStorage.regionCode, ebsResource.volumeType)
        );
        inputList = inputList.concat(ebsStorageProductInputList);
    }

    return inputList;
}

function getMetricFromProductFamily(productFamily: string): string {
    logger.debug('Getting metric from product family', { productFamily });

    switch (productFamily) {
        case 'Compute Instance':
            return 'compute';
        case 'Storage':
            return 'storage';
        case 'Provisioned Throughput':
            return 'throughput';
        case 'System Operation':
            return 'iops';
        case 'Provisioned IOPS':
            return 'iops';
        case 'Read Request':
            return 'readRequest';
        case 'Write Request':
            return 'writeRequest';
        case 'SSDStorage':
            return 'storageSsd';
        case 'HDDStorage':
            return 'storageHdd';
        default:
            return 'unknown';
    }
}

function getProductsInputForFSxWindows(region: string, deploymentOption: string): ProductInput {
    logger.debug('Getting products input for FSx Windows', { region, deploymentOption });

    return {
        name: 'fsxwStorage',
        input: {
            Filters: [
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'fileSystemType',
                    Value: 'Windows'
                },
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'deploymentOption',
                    Value: deploymentOption === SINGLE_AZ ? 'Single-AZ' : 'Multi-AZ'
                },
                {
                    Type: FilterType.TERM_MATCH,
                    Field: 'regionCode',
                    Value: region
                }
            ],
            ...fsxService,
            ...AWS_PRICING_FORMAT_VERSION
        }
    };
}

function parseProductsResponse(response: GetProductsCommandOutput): {
    [metric: string]: { pricePerUnit: number; unit: string };
} {
    logger.debug('Parsing products response', response);

    const pricingDetails: { [metric: string]: { pricePerUnit: number; unit: string } } = {};
    if (response.PriceList) {
        response.PriceList.forEach(priceItem => {
            const item = (priceItem as LazyJsonString).deserializeJSON();
            const { terms, product } = item;

            if (terms && product) {
                const term = terms[Object.keys(terms)[0]];
                const termDetails = term[Object.keys(term)[0]];
                const { priceDimensions } = termDetails;
                const priceDimension = priceDimensions[Object.keys(priceDimensions)[0]];
                const { pricePerUnit } = priceDimension;
                const { requestType, storageType } = product.attributes;
                if (storageType === 'SSD') {
                    product.productFamily = 'SSDStorage';
                } else if (storageType === 'HDD') {
                    product.productFamily = 'HDDStorage';
                } else if (storageType && !['SSD', 'HDD'].includes(storageType)) {
                    // FSx for ONTAP has capacity pool as another storage type
                    product.productFamily = 'OtherStorage';
                }
                const metric = ['Write', 'Read'].includes(requestType)
                    ? getMetricFromProductFamily(`${requestType} Request`)
                    : getMetricFromProductFamily(product.productFamily);
                pricingDetails[metric as keyof typeof pricingDetails] = {
                    pricePerUnit: Number(pricePerUnit.USD),
                    unit: priceDimension.unit
                };
            }
        });
    }

    return pricingDetails;
}

async function getProductRates(
    inputList: ProductInput[]
): Promise<{ [productType: string]: { [metric: string]: { pricePerUnit: number; unit: string } } }> {
    logger.debug('Getting product rates', inputList);

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
            [product.name]: parseProductsResponse(product.output)
        }),
        {} as { [productType: string]: { [metric: string]: { pricePerUnit: number; unit: string } } }
    );

    return parsedResponse;
}

async function calculatePrice(
    compute: PricingServiceRequestType['compute'],
    fsxnStorage: PricingServiceRequestType['fsxnStorage'],
    vpc: PricingServiceRequestType['vpc'],
    ebsStorage?: PricingServiceRequestType['ebsStorage'],
    fsxwStorage?: PricingServiceRequestType['fsxwStorage']
): Promise<PricingServiceResponseType> {
    logger.info('Calculating price for AWS resources', {
        compute,
        fsxnStorage,
        vpc,
        ebsStorage,
        fsxwStorage
    });

    if (fsxnStorage && fsxnStorage?.diskSize > 133120) {
        throw createError(412, 'Supported FSx for ONTAP data disk size should be between 120GiB to 130TiB');
    }

    const inputList: ProductInput[] = compact(getInputs(compute, fsxnStorage, ebsStorage, vpc, fsxwStorage));
    const productRates = await getProductRates(inputList);

    const {
        ec2Instance: { compute: { pricePerUnit: ec2InstanceRate = 0 } = {} },
        ec2Storage: { storage: { pricePerUnit: ec2StorageRate = 0 } = {} },
        vpc: { vpc: { pricePerUnit: vpcRate = undefined } = {} } = {}
    } = productRates;

    const ec2Cost = calculateEc2Cost(ec2InstanceRate, ec2StorageRate, compute?.sqlDeploymentMode);
    const vpcCost = vpcRate ? getPriceUtil(vpcRate, HOURS_IN_MONTH, 1) : 0;

    let fsxnStorageCost = 0;
    let fsxnOperationalCost = 0;
    let fsxnDiskSizes;
    if (fsxnStorage) {
        ({ fsxnStorageCost, fsxnOperationalCost, fsxnDiskSizes } = calculateFsxnCost(
            fsxnStorage,
            productRates.fsxnStorage
        ));
    }

    const ebsBreakdownByVolumeType: {
        id: string;
        volumeType: string;
        cost: number;
        size: number;
        iops: number | undefined;
        throughput: number | undefined;
    }[] = [];
    let totalEbsStorageCost = 0;
    if (!isEmpty(ebsStorage)) {
        await Promise.all(
            ebsStorage.ebsResourceInfo.map(async ebsResource => {
                const rate = productRates[`ebsStorage-${ebsResource.volumeType}`];
                const cost = calculateEbsCost(
                    ebsResource.volumeType,
                    ebsResource.size,
                    ebsResource.iops,
                    ebsResource.throughput,
                    rate
                );
                totalEbsStorageCost += cost;
                ebsBreakdownByVolumeType.push({
                    id: ebsResource.id,
                    volumeType: ebsResource.volumeType,
                    cost,
                    size: ebsResource.size,
                    iops: ebsResource?.iops,
                    throughput: ebsResource?.throughput
                });
            })
        );
    }

    let fsxwStorageCost = 0;
    let fsxwOperationalCost = 0;
    if (fsxwStorage) {
        ({ fsxwStorageCost, fsxwOperationalCost } = calculateFsxwCost(fsxwStorage, productRates.fsxwStorage));
    }

    return {
        compute: ec2Cost,
        ...(fsxnStorage && {
            fsxnStorage: {
                capacityCost: fsxnStorageCost,
                operationalCost: fsxnOperationalCost,
                // This is optional and only needed to display in UI
                ...(fsxnDiskSizes && {
                    size: {
                        data: sizeInGigaBytes(fsxnDiskSizes?.FSxDataVolumeSize),
                        log: sizeInGigaBytes(fsxnDiskSizes?.FSxLogVolumeSize),
                        tempdb: sizeInGigaBytes(fsxnDiskSizes?.FSxTempDbVolumeSize),
                        buffer: sizeInGigaBytes(fsxnDiskSizes?.FSxBufferVolumeSize),
                        total: fsxnDiskSizes?.FSxStorageCapacity,
                        ...(fsxnDiskSizes?.FSxQuorumVolumeSize && {
                            quorum: sizeInGigaBytes(fsxnDiskSizes?.FSxQuorumVolumeSize)
                        })
                    }
                })
            }
        }),
        ...(vpc && { vpc: vpcCost }),
        ...(ebsStorage && {
            ebsStorage: {
                ebsStorageCost: totalEbsStorageCost,
                ebsBreakdownByVolumeType: ebsBreakdownByVolumeType.map(
                    ({ id, size, volumeType, cost, iops, throughput }) => ({
                        id,
                        volumeType,
                        cost,
                        size: numeral(`${size}GiB`).value() || 0,
                        iops,
                        throughput
                    })
                )
            }
        }),
        ...(fsxwStorage && {
            fsxwStorage: {
                capacityCost: fsxwStorageCost,
                operationalCost: fsxwOperationalCost,
                size: sizeInGigaBytes(fsxwStorage.storageCapacity) || 0
            }
        }),
        total: ec2Cost + vpcCost + fsxnStorageCost + fsxnOperationalCost + totalEbsStorageCost + fsxwStorageCost
    };
}

function calculateFsxnCost(fsxnStorage: PricingServiceRequestType['fsxnStorage'], fsxnStorageRates: any) {
    logger.info('Calculating cost for FSx Netapp storage', { fsxnStorage, fsxnStorageRates });

    if (!isEmpty(fsxnStorage) && !fsxnStorage.diskSize && !fsxnStorage.storageCapacity) {
        throw new Error('FSx Netapp storage is not available');
    }
    // If the input size is database size, we need to calculate the total FSX storage capacity
    // In cases where the input is total FSx Storage capacity, we don't this calculation.
    let fsxnStorageCost = 0;
    let fsxnOperationalCost = 0;
    let fsxnDiskSizes;
    let fsxnDisksize;
    if (fsxnStorage?.diskSize) {
        fsxnDiskSizes = calculateFsxnStorageCapacity(fsxnStorage.diskSize);
        fsxnDisksize = fsxnDiskSizes.FSxStorageCapacity;
    } else {
        fsxnDisksize = fsxnStorage?.storageCapacity;
    }

    const {
        storageSsd: { pricePerUnit: fsxnStorageRate = 0 } = {},
        throughput: { pricePerUnit: fsxnThroughputRate = 0 } = {},
        iops: { pricePerUnit: fsxnIopsRate = 0 } = {},
        readRequest: { pricePerUnit: fsxnReadRequestsRate = 0 } = {},
        writeRequest: { pricePerUnit: fsxnWriteRequestsRate = 0 } = {}
    } = fsxnStorageRates;

    fsxnDisksize = fsxnDisksize || MIN_DISKSIZE;
    const fsxnThroughput = fsxnStorage?.throughput || MIN_THROUGHPUT;
    let fsxnIops = fsxnStorage?.iops || 3 * fsxnDisksize;

    fsxnStorageCost = calculateFsxnStorageCost(fsxnStorageRate, fsxnDisksize);
    if (fsxnIops > 3 * fsxnDisksize) {
        fsxnIops -= 3 * fsxnDisksize; // Iops cost is only charged when its greater than 3 * diskSize and charging is only on the difference
    } else {
        fsxnIops = 0; // Iops cost is 0 if it is less than or equal to  3 * diskSize
    }

    fsxnOperationalCost = calculateFsxOperationalCost(
        fsxnThroughputRate,
        fsxnIopsRate,
        fsxnReadRequestsRate,
        fsxnWriteRequestsRate,
        fsxnThroughput,
        fsxnIops
    );
    logger.info('FSx Netapp operational cost value for demo', fsxnOperationalCost);

    // If the FSX total storage crosses 192Tib Means keeping it to 192TiB (196608GiB).
    if (fsxnDiskSizes) {
        fsxnDiskSizes.FSxStorageCapacity = Math.min(fsxnDiskSizes?.FSxStorageCapacity || 0, MAX_FSX_STORAGE_IN_GIB);
    }
    return { fsxnStorageCost, fsxnOperationalCost, fsxnDiskSizes };
}

function calculateEbsCost(
    volumeType: string,
    volumeSizeGB: number,
    provisionedIOPS?: number,
    provisionedThroughputMBps?: number,
    ebsStorageRates?: any
): number {
    logger.info('Calculating cost for EBS volumes', {
        volumeType,
        volumeSizeGB,
        provisionedIOPS,
        provisionedThroughputMBps
    });

    const {
        storage: { pricePerUnit: storageRate = 0 } = {},
        iops: { pricePerUnit: iopsRate = 0 } = {},
        throughput: { pricePerUnit: throughputRate = 0 } = {}
    } = ebsStorageRates;

    const monthlyStorageCost = volumeSizeGB * storageRate;

    let monthlyIopsCost = 0;
    let monthlyThroughputCost = 0;

    if (volumeType === 'gp3' && provisionedIOPS && provisionedThroughputMBps) {
        if (provisionedThroughputMBps > 3000) {
            if (volumeSizeGB < 1000) {
                // For gp3 volumes, you get a baseline performance of 3,000 IOPS for volumes up to 1,000 GiB in size at no additional cost. If you provision more than 3,000 IOPS for a volume of this size, you are charged an additional cost.
                monthlyIopsCost = (provisionedIOPS - 3000) * storageRate;
            } else if (volumeSizeGB >= 1000) {
                /*
                    If your volume size is 1,000 GiB or larger, you get an additional baseline performance of 3 IOPS per GiB of volume size at no additional cost. If you provision more IOPS than this baseline, you are charged an additional cost.
                    Eg: the volume size is 2000 GiB and the provisioned IOPS is 7000.
                    So, for a 2000 GiB volume, the baseline IOPS you get for free would be 2000 * 3 = 6000 IOPS.

                    Now, if you provision more IOPS than this baseline, you are charged an additional cost. In this case, you have provisioned 7000 IOPS, which is 1000 IOPS more than the baseline of 6000 IOPS.

                */
                const baselineIops = volumeSizeGB * 3;
                monthlyIopsCost = (provisionedIOPS - baselineIops) * storageRate;
            }
        }
        if (volumeSizeGB < 1000 && provisionedThroughputMBps > 125) {
            // For gp3 volumes, you get a baseline performance of 125 MB/s of throughput for volumes up to 1,000 GiB in size at no additional cost. If you provision more than 125 MB/s of throughput for a volume of this size, you are charged an additional cost.
            monthlyThroughputCost = (provisionedThroughputMBps - 125) * throughputRate;
        } else if (volumeSizeGB >= 1000 && provisionedThroughputMBps > volumeSizeGB * 0.25) {
            /* If your volume size is 1,000 GiB or larger, you get an additional baseline performance of 0.25 MB/s of throughput per GiB of volume size at no additional cost. If you provision more throughput than this baseline, you are charged an additional cost. The 0.25 MB/s of throughput per GiB is equivalent to dividing the volume size by 4. For example, for a 1,000 GiB gp3 volume, you get 125 MB/s of throughput for free (1,000 GiB / 4 = 250 MB/s), and for a 2,000 GiB gp3 volume, you get 500 MB/s of throughput for free (2,000 GiB / 4 = 500 MB/s), and so on.
            Eg: the volume size is 2000 GiB and the provisioned throughput is 600 MB/s.
            For a 2000 GiB volume, the baseline throughput you get for free would be 2000 * 0.25 = 500 MB/s.
            Now, if you provision more throughput than this baseline, you are charged an additional cost. In this case, you have provisioned 600 MB/s, which is 100 MB/s more than the baseline of 500 MB/s.
            */
            const baselineThroughput = volumeSizeGB * 0.25;
            monthlyThroughputCost = (provisionedThroughputMBps - baselineThroughput) * throughputRate;
        }
    }

    if ((volumeType === 'io1' || volumeType === 'io2') && provisionedIOPS) {
        monthlyIopsCost = provisionedIOPS * iopsRate;
    }
    const totalMonthlyCost = monthlyStorageCost + monthlyIopsCost + monthlyThroughputCost;
    return totalMonthlyCost;
}

function calculateFsxwCost(fsxwStorage: PricingServiceRequestType['fsxwStorage'], fsxwStorageRates: any) {
    logger.info('Calculating cost for FSx Windows storage', { fsxwStorage, fsxwStorageRates });

    let fsxwStorageCost = 0;
    let fsxwOperationalCost = 0;

    const {
        throughput: { pricePerUnit: fsxwThroughputRate = 0 } = {},
        iops: { pricePerUnit: fsxwIopsRate = 0 } = {},
        readRequest: { pricePerUnit: fsxwReadRequestsRate = 0 } = {},
        writeRequest: { pricePerUnit: fsxwWriteRequestsRate = 0 } = {}
    } = fsxwStorageRates;

    if (!isEmpty(fsxwStorage)) {
        fsxwStorageCost = calculateFsxWindowsCapacityPrice(
            fsxwStorage.storageCapacity,
            fsxwStorage.storageType,
            fsxwStorage.iops,
            fsxwStorage.throughput,
            1,
            fsxwStorageRates
        );
        fsxwOperationalCost = calculateFsxOperationalCost(
            fsxwThroughputRate,
            fsxwIopsRate,
            fsxwReadRequestsRate,
            fsxwWriteRequestsRate,
            fsxwStorage.throughput,
            fsxwStorage.iops
        );
    }

    return { fsxwStorageCost, fsxwOperationalCost };
}

/**
 * Calculates the price for FSx Windows capacity.
 * @param region - The AWS region.
 * @param capacity - The capacity of FSx Windows storage in GB.
 * @param storageType - The type of storage. 'ssd' or 'hdd'.
 * @param iops - The input/output operations per second.
 * @param throughput - The throughput in MBps.
 * @param deploymentMode - The deployment mode of FSx Windows. 'Single-AZ' or 'Multi-AZ' (default is 'Single-AZ').
 * @param duration - The duration of the calculation in months (default is 1).
 * @returns The calculated price for FSx Windows capacity.
 */
function calculateFsxWindowsCapacityPrice(
    capacity: number,
    storageType: string,
    iops: number,
    throughput: number,
    duration = 1,
    fsxsStorageRates?: any
) {
    logger.info('Calculating FSx Windows capacity price', {
        capacity,
        storageType,
        iops,
        throughput,
        duration,
        fsxsStorageRates
    });

    const {
        iops: { pricePerUnit: iopsRate },
        throughput: { pricePerUnit: throughputRate },
        storageSsd: { pricePerUnit: ssdStorageRate },
        storageHdd: { pricePerUnit: hddStorageRate }
    } = fsxsStorageRates;

    // throughput calculation
    const minimumNoOfFsxFileSystemsForStorageCapacity = capacity / (64 * 1024);
    const minimumNoOfFsxFileSystemsForThroughputCapacity = throughput / (2 * 1024);
    const requiredNoOfFileSystems = Math.max(
        minimumNoOfFsxFileSystemsForStorageCapacity,
        minimumNoOfFsxFileSystemsForThroughputCapacity
    );
    const roundedValue = Math.ceil(requiredNoOfFileSystems);
    const minimumRequiredThroughput = roundedValue * 8;
    const provisionedThroughput = Math.max(throughput, minimumRequiredThroughput);
    const capacityPrice =
        storageType?.toLocaleLowerCase() === 'ssd' ? ssdStorageRate * capacity : hddStorageRate * capacity;
    const iopsPrice = iopsRate * Math.max(iops - 3 * capacity, 0);
    const throughputPrice = throughputRate * provisionedThroughput;

    return (capacityPrice + iopsPrice + throughputPrice) * duration;
}

export { getProductRates, calculatePrice, calculateFsxWindowsCapacityPrice };
