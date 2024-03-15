import { Filter, FilterType, GetProductsCommandInput, GetProductsCommandOutput } from '@aws-sdk/client-pricing';
import { LazyJsonString } from '@smithy/smithy-client';
import { compact, isEmpty } from 'lodash-es';
import { PricingServiceRequestType, PricingServiceResponseType } from '../../routes/types/pricing.types';
import getLogger from '../../utils/logger';
import { calculateFsxStorageCapacity, sizeInGigaBytes } from '../../utils/utils';
import {
    DEFAULT_AWS_REGION,
    FCI,
    MAX_READ_REQUEST_FSXN,
    MAX_WRITE_REQUEST_FSXN,
    MIN_DISKSIZE,
    MIN_THROUGHPUT,
    SINGLE_AZ,
    SQL_SOFTWARE_TYPES
} from '../../utils/consts';
import getProducts from '../../lib/aws/pricing';

const logger = getLogger();

// interface PriceObject {
//     unit: string;
//     pricePerUnit: {
//         USD: string;
//     };
// }

// interface Terms {
//     OnDemand: {
//         [key: string]: {
//             priceDimensions: {
//                 [key: string]: PriceObject;
//             };
//         };
//     };
// }

// interface Product {
//     product: {
//         productFamily: string;
//         attributes: {
//             [key: string]: string;
//         };
//         sku: string;
//     };
//     serviceCode: string;
//     terms: Terms;
// }

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

// const readWriteRequestProductFamily: Filter = {
//     Type: FilterType.TERM_MATCH,
//     Field: 'productFamily',
//     Value: 'Request'
// };

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
        name: 'ebsStorage',
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

function getFSxNOperationalMetrics(storage: PricingServiceRequestType['storage']): ProductInput {
    logger.info('Geting FSxN operational metrics', { storage });

    return {
        name: 'fsxOperationals',
        input: {
            Filters: [
                getRegionCodeFilter(storage?.regionCode),
                getDeploymentOption(storage?.deploymentOption),
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

// function getFSxNThroughputInput(storage: PricingServiceRequestType['storage']): ProductInput {
//     logger.info('Geting FSxN Throughput Input', { storage });

//     return {
//         name: 'fsxThroughput',
//         input: {
//             Filters: [
//                 getRegionCodeFilter(storage?.regionCode),
//                 getDeploymentOption(storage?.deploymentOption),
//                 {
//                     Type: FilterType.TERM_MATCH,
//                     Field: 'productFamily',
//                     Value: 'Provisioned Throughput'
//                 },
//                 {
//                     Type: FilterType.TERM_MATCH,
//                     Field: 'fileSystemType',
//                     Value: 'ONTAP'
//                 }
//             ],
//             ...fsxService,
//             ...AWS_PRICING_FORMAT_VERSION
//         }
//     };
// }

// function getFSxNIopsInput(storage: PricingServiceRequestType['storage']): ProductInput {
//     logger.info('Geting FSxN Iops Input', { storage });

//     return {
//         name: 'fsxIops',
//         input: {
//             Filters: [
//                 getRegionCodeFilter(storage?.regionCode),
//                 getDeploymentOption(storage?.deploymentOption),
//                 {
//                     Type: FilterType.TERM_MATCH,
//                     Field: 'productFamily',
//                     Value: 'Provisioned IOPS'
//                 },
//                 {
//                     Type: FilterType.TERM_MATCH,
//                     Field: 'fileSystemType',
//                     Value: 'ONTAP'
//                 }
//             ],
//             ...fsxService,
//             ...AWS_PRICING_FORMAT_VERSION
//         }
//     };
// }

// function getFSxNReadRequestsInput(storage: PricingServiceRequestType['storage']): ProductInput {
//     logger.info('Geting FSxN read requests Input', { storage });

//     return {
//         name: 'fsxReadRequests',
//         input: {
//             Filters: [
//                 getRegionCodeFilter(storage?.regionCode),
//                 getDeploymentOption(storage?.deploymentOption),
//                 readWriteRequestProductFamily,
//                 {
//                     Type: FilterType.TERM_MATCH,
//                     Field: 'fileSystemType',
//                     Value: 'ONTAP'
//                 },
//                 {
//                     Type: FilterType.TERM_MATCH,
//                     Field: 'requestType',
//                     Value: 'Read'
//                 }
//             ],
//             ...fsxService,
//             ...AWS_PRICING_FORMAT_VERSION
//         }
//     };
// }

// function getFSxNWriteRequestsInput(storage: PricingServiceRequestType['storage']): ProductInput {
//     logger.info('Geting FSxN write requests Input', { storage });

//     return {
//         name: 'fsxWriteRequests',
//         input: {
//             Filters: [
//                 getRegionCodeFilter(storage?.regionCode),
//                 getDeploymentOption(storage?.deploymentOption),
//                 readWriteRequestProductFamily,
//                 {
//                     Type: FilterType.TERM_MATCH,
//                     Field: 'fileSystemType',
//                     Value: 'ONTAP'
//                 },
//                 {
//                     Type: FilterType.TERM_MATCH,
//                     Field: 'requestType',
//                     Value: 'Write'
//                 }
//             ],
//             ...fsxService,
//             ...AWS_PRICING_FORMAT_VERSION
//         }
//     };
// }

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

// function parseResponse(response: GetProductsCommandOutput): number {
//     logger.info('Parse Pricing Response', { response });

//     /**
//      * Sample response:
//      * [{
//             "product": {
//                 "productFamily": "Storage",
//                 "attributes": {
//                     ...
//                 },
//                 "sku": "NXJD8KBTG7YXFF7F"
//             },
//             "serviceCode": "AmazonFSx",
//             "terms": {
//                 "OnDemand": {
//                     "NXJD8KBTG7YXFF7F.JRTCKXETXF": {
//                         "priceDimensions": {
//                             "NXJD8KBTG7YXFF7F.JRTCKXETXF.6YS6EN2CT7": {
//                                 "unit": "GB-Mo",
//                                 "pricePerUnit": {
//                                     "USD": "0.2500000000"
//                                 }
//                             }
//                         },
//                         ...
//                     }
//                 }
//             },
//             "version": "20230905212148",
//             "publicationDate": "2023-09-05T21:21:48Z"
//         }]
//      */

//     if (isEmpty(response?.PriceList)) {
//         logger.error('Invalid AWS SDK response:', { data: response?.PriceList });
//         return 0;
//     }

//     const [serializedResponse]: Product[] = (response?.PriceList || []).map(k =>
//         (k as LazyJsonString).deserializeJSON()
//     );

//     const { OnDemand }: Terms = serializedResponse?.terms || {};

//     const [{ priceDimensions }] = Object.values(OnDemand);

//     const [
//         {
//             unit,
//             pricePerUnit: { USD: rate }
//         }
//     ]: PriceObject[] = Object.values(priceDimensions);

//     logger.debug({ rate, unit });

//     return Number(rate);
// }

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
    storage: PricingServiceRequestType['storage'],
    ebsStorage: PricingServiceRequestType['ebsStorage'],
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
        ...((storage && [getFSxNStorageInput(storage), getFSxNOperationalMetrics(storage)]) || []),
        ...((ebsStorage && [getEbsStorageInput(ebsStorage.regionCode, ebsStorage.volumeType)]) || []),
        ...((vpc && [getVpcInput(vpc)]) || [])
    ];
}

function getMetricFromProductFamily(productFamily: string): string {
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
        default:
            return 'unknown';
    }
}

function parseProductsResponse(response: GetProductsCommandOutput): {
    [metric: string]: { pricePerUnit: number; unit: string };
} {
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
                const { requestType } = product.attributes;
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

async function calculatePrice(
    compute: PricingServiceRequestType['compute'],
    storage: PricingServiceRequestType['storage'],
    vpc: PricingServiceRequestType['vpc'],
    ebsStorage?: PricingServiceRequestType['ebsStorage']
): Promise<PricingServiceResponseType> {
    logger.info('Calculating price for AWS resources', {
        compute,
        storage,
        ebsStorage,
        vpc
    });

    const inputList: ProductInput[] = compact(getInputs(compute, storage, ebsStorage, vpc));

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

    const {
        ec2Instance: {
            compute: { pricePerUnit: ec2InstanceRate }
        },
        ec2Storage: {
            storage: { pricePerUnit: ec2StorageRate }
        },
        fsxStorage: { storage: { pricePerUnit: fsxStorageRate = 0 } = {} } = {}, // Default to 0 if FSx storage is not available
        fsxOperationals: {
            throughput: { pricePerUnit: fsxThroughputRate = 0 } = {},
            iops: { pricePerUnit: fsxIopsRate = 0 } = {},
            readRequest: { pricePerUnit: fsxReadRequestsRate = 0 } = {},
            writeRequest: { pricePerUnit: fsxWriteRequestsRate = 0 } = {}
        } = {},
        vpc: {
            unknown: { pricePerUnit: vpcRate }
        },
        ebsStorage: ebsStorageRates = undefined
    } = parsedResponse;

    const ec2Cost = calculateEc2Cost(ec2InstanceRate, ec2StorageRate, compute?.sqlDeploymentMode);
    const vpcCost = vpcRate ? getPriceUtil(vpcRate, HOURS_IN_MONTH, 1) : 0;

    let fsxStorageCost = 0;
    let fsxOperationalCost = 0;
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

        fsxOperationalCost = calculateFsxOperationalCost(
            fsxThroughputRate,
            fsxIopsRate,
            fsxReadRequestsRate,
            fsxWriteRequestsRate,
            fsxThroughput,
            fsxIops
        );
        logger.info('FSx operational cost value for demo', fsxOperationalCost);
    }

    let ebsStorageCost = 0;
    if (!isEmpty(ebsStorage)) {
        ebsStorageCost = calculateEbsCost(
            ebsStorage?.volumeType,
            ebsStorage?.size,
            ebsStorage?.iops,
            ebsStorage?.throughput,
            ebsStorageRates
        );
    }

    return {
        compute: ec2Cost,
        ...(storage && {
            storage: {
                capacityCost: fsxStorageCost,
                operationalCost: fsxOperationalCost,
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
        ...(ebsStorage && {
            ebsStorage: {
                ebsStorageCost,
                size: sizeInGigaBytes(ebsStorage.size) || 0
            }
        }),
        total: ec2Cost + vpcCost + fsxStorageCost + fsxOperationalCost + ebsStorageCost
    };
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
        storage: { pricePerUnit: storageRate },
        iops: { pricePerUnit: iopsRate },
        throughput: { pricePerUnit: throughputRate }
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

export default calculatePrice;
