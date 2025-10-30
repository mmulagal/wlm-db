import createError from 'http-errors';
import { Filter, FilterType, GetProductsCommandInput, GetProductsCommandOutput } from '@aws-sdk/client-pricing';
import { LazyJsonString } from '@smithy/smithy-client';
import { compact, isEmpty, mergeWith } from 'lodash-es';
import numeral from 'numeral';
import {
    FsxnCostBreakdownType,
    FsxwCostBreakdownType,
    PricingServiceRequestType,
    PricingServiceResponseType
} from '../../routes/types/pricing.types';
import getLogger from '../../utils/logger';
import { calculateFsxnStorageCapacity, IS_DEMO_FLOW } from '../../utils/utils';
import {
    DEFAULT_AWS_REGION,
    FCI,
    MAX_FSX_STORAGE_IN_GIB,
    MAX_READ_REQUEST_FSXN,
    MAX_WRITE_REQUEST_FSXN,
    MIN_DISKSIZE,
    MIN_THROUGHPUT,
    SINGLE_AZ,
    SQL_SOFTWARE_TYPES,
    SQL_STD,
    HOURS_IN_MONTH,
    EBS_ROOT_VOLUME,
    PRICING_LICENSE_KEYS,
    DatabaseTypes,
    HA
} from '../../utils/consts';
import { DEMO_PRODUCT_RATE } from '../../utils/demo-utils/demoMockdata';
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

const ROOT_EBS_STORAGE_SIZE = 100; // 100GB
const ROOT_EBS_VOL_TYPE = 'gp3';

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

// const BYOL = 'Bring your own license';

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

function getEc2InstanceInput(
    compute: PricingServiceRequestType['compute'],
    osType?: PricingServiceRequestType['osType']
): ProductInput {
    logger.info('Get ec2 instance input', { compute, osType });

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
                    Value: osType || 'windows'
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
                },
                ...(osType === 'linux'
                    ? []
                    : [
                          {
                              // No license required for windows
                              Type: FilterType.TERM_MATCH,
                              Field: 'licenseModel',
                              Value: 'No License required'
                          }
                      ])
            ],
            ...ec2Service,
            ...AWS_PRICING_FORMAT_VERSION
        }
    };
    // add this filter based on whether its windows sql based ami or not
    if (compute.sqlSoftwareType) {
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

function calculateEc2Cost(instanceRate: number, deploymentMode: string): number {
    logger.debug('Calculating compute cost');

    const instanceCount = deploymentMode === FCI ? 2 : 1;
    return getPriceUtil(instanceRate, HOURS_IN_MONTH, instanceCount);
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
    fsxwStorage: PricingServiceRequestType['fsxwStorage'],
    osType?: PricingServiceRequestType['osType']
): ProductInput[] {
    logger.info('Getting product inputs', {
        compute,
        fsxnStorage,
        vpc,
        ebsStorage,
        fsxwStorage,
        osType
    });

    let inputList: ProductInput[] = [
        getEc2InstanceInput(compute, osType),
        getEc2StorageInput(compute),
        ...((vpc && [getVpcInput(vpc)]) || [])
    ];

    if (ebsStorage && ebsStorage.ebsResourceInfo.length > 0) {
        const ebsStorageProductInputList = ebsStorage.ebsResourceInfo.map(ebsResource =>
            getEbsStorageInput(ebsStorage.regionCode, ebsResource.volumeType)
        );
        inputList = inputList.concat(ebsStorageProductInputList);
    }

    if (fsxnStorage && fsxnStorage.fsxnResourceInfo.length > 0) {
        const fsxStorageProductInputList = fsxnStorage.fsxnResourceInfo.map(fsxResource =>
            getProductsInputForFSxN(fsxnStorage.regionCode, fsxResource.deploymentOption!)
        );
        inputList = inputList.concat(fsxStorageProductInputList);
    }

    if (fsxwStorage && fsxwStorage.fsxwResourceInfo.length > 0) {
        const fswStorageProductInputList = fsxwStorage.fsxwResourceInfo.map(fsxResource =>
            getProductsInputForFSxWindows(fsxwStorage.regionCode, fsxResource.deploymentOption!)
        );
        inputList = inputList.concat(fswStorageProductInputList);
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
    if (response.PriceList && !isEmpty(response.PriceList)) {
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
    fsxwStorage?: PricingServiceRequestType['fsxwStorage'],
    osType?: PricingServiceRequestType['osType'],
    databaseType?: string
): Promise<PricingServiceResponseType> {
    logger.info('Calculating price for AWS resources', {
        compute,
        fsxnStorage,
        vpc,
        ebsStorage,
        fsxwStorage,
        osType,
        databaseType
    });

    const ebsRootVolumes = new Array(compute.sqlDeploymentMode === FCI ? 2 : 1).fill(null).map((_, index) => ({
        id: `${EBS_ROOT_VOLUME}${index + 1}`,
        volumeType: ROOT_EBS_VOL_TYPE,
        size: ROOT_EBS_STORAGE_SIZE
    }));

    if (isEmpty(ebsStorage)) {
        ebsStorage = {
            regionCode: compute.regionCode,
            ebsResourceInfo: ebsRootVolumes
        };
    } else {
        // If ebsStorage is not empty, add the root volumes to the existing ebsResourceInfo
        const hasRootVolume = ebsStorage.ebsResourceInfo?.some(({ id }) => id.includes(EBS_ROOT_VOLUME));
        if (!hasRootVolume) {
            ebsStorage.ebsResourceInfo = [...ebsStorage.ebsResourceInfo, ...ebsRootVolumes];
        }
    }

    const inputList: ProductInput[] = compact(getInputs(compute, fsxnStorage, ebsStorage, vpc, fsxwStorage, osType));
    let productRates = await getProductRates(inputList);

    if (IS_DEMO_FLOW) {
        productRates = mergeWith(productRates, DEMO_PRODUCT_RATE, (objValue, srcValue) => {
            if (isEmpty(objValue)) {
                return srcValue;
            }
            return objValue;
        });
    }
    const {
        ec2Instance: { compute: { pricePerUnit: ec2InstanceRate = 0 } = {} },
        vpc: { vpc: { pricePerUnit: vpcRate = undefined } = {} } = {}
    } = productRates;

    const ec2Cost = ec2InstanceRate ? calculateEc2Cost(ec2InstanceRate, compute?.sqlDeploymentMode) : 0;
    const vpcCost = vpcRate ? getPriceUtil(vpcRate, HOURS_IN_MONTH, 1) : 0;

    let totalFsxnCost = 0;
    const fsxnCostBreakdownById: FsxnCostBreakdownType[] = [];
    if (fsxnStorage && !isEmpty(productRates.fsxnStorage)) {
        await Promise.all(
            fsxnStorage.fsxnResourceInfo.map(async fsxResource => {
                let fsxnStorageCost = 0;
                let fsxnOperationalCost = 0;
                let fsxnDiskSizes;

                // This applies to pre-deployment pricing. Today we support single FSxN as storage.
                // It is okay to throw an error.
                // For post-deployment, diskSize(dataDisk size) is not relevant since storageCapacity is considered.
                if (fsxResource && fsxResource.diskSize! > 133120) {
                    throw createError(412, 'Supported FSx for ONTAP data disk size should be between 120GiB to 130TiB');
                }

                ({ fsxnStorageCost, fsxnOperationalCost, fsxnDiskSizes } = calculateFsxnCost(
                    fsxResource,
                    productRates.fsxnStorage,
                    compute?.sqlDeploymentMode,
                    databaseType
                ));
                totalFsxnCost = totalFsxnCost + fsxnStorageCost + fsxnOperationalCost;
                const isPgsqlHADeployment =
                    (compute?.sqlDeploymentMode === FCI || compute?.sqlDeploymentMode === HA) &&
                    databaseType === DatabaseTypes.PG_SQL;
                const sizeData = fsxnDiskSizes
                    ? {
                          data: numeral(`${fsxnDiskSizes?.FSxDataVolumeSize}MiB`).value() || 0,
                          ...(isPgsqlHADeployment && {
                              dataReplica: numeral(`${fsxnDiskSizes?.FSxDataVolumeSize}MiB`).value() || 0
                          }),
                          log: numeral(`${fsxnDiskSizes?.FSxLogVolumeSize}MiB`).value() || 0,
                          ...(isPgsqlHADeployment && {
                              logReplica: numeral(`${fsxnDiskSizes?.FSxLogVolumeSize}MiB`).value() || 0
                          }),
                          ...(fsxnDiskSizes?.FSxTempDbVolumeSize && {
                              tempdb: numeral(`${fsxnDiskSizes?.FSxTempDbVolumeSize}MiB`).value() || 0
                          }),
                          buffer: numeral(`${fsxnDiskSizes?.FSxBufferVolumeSize}MiB`).value() || 0,
                          total: numeral(`${fsxnDiskSizes?.FSxStorageCapacity}GiB`).value() || 0,
                          ...(fsxnDiskSizes?.FSxQuorumVolumeSize && {
                              quorum: numeral(`${fsxnDiskSizes?.FSxQuorumVolumeSize}MB`).value() || 0
                          })
                      }
                    : {
                          total: numeral(`${fsxResource.storageCapacity}GiB`).value() || 0
                      };
                fsxnCostBreakdownById.push({
                    id: fsxResource.id!,
                    capacityCost: fsxnStorageCost,
                    operationalCost: fsxnOperationalCost,
                    size: sizeData
                });
            })
        );
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
    if (
        !isEmpty(ebsStorage) &&
        !ebsStorage?.ebsResourceInfo?.some(e => isEmpty(productRates[`ebsStorage-${e.volumeType}`]))
    ) {
        ebsStorage.ebsResourceInfo.forEach(ebsResource => {
            const rate = productRates[`ebsStorage-${ebsResource.volumeType}`];
            const size =
                ebsResource.id.includes(EBS_ROOT_VOLUME) && ebsResource.size <= 100
                    ? ROOT_EBS_STORAGE_SIZE
                    : ebsResource.size;
            const cost = calculateEbsCost(ebsResource.volumeType, size, ebsResource.iops, ebsResource.throughput, rate);
            totalEbsStorageCost += cost;
            ebsBreakdownByVolumeType.push({
                id: ebsResource.id,
                volumeType: ebsResource.volumeType,
                cost,
                size,
                iops: ebsResource?.iops,
                throughput: ebsResource?.throughput
            });
        });
    }

    let totalFsxwCost = 0;
    const fsxwCostBreakdownById: FsxwCostBreakdownType[] = [];
    if (fsxwStorage && !isEmpty(productRates.fsxwStorage)) {
        await Promise.all(
            fsxwStorage.fsxwResourceInfo.map(async fsxResource => {
                let fsxwStorageCost = 0;
                let fsxwOperationalCost = 0;

                ({ fsxwStorageCost, fsxwOperationalCost } = calculateFsxwCost(fsxResource, productRates.fsxwStorage));
                totalFsxwCost = totalFsxwCost + fsxwStorageCost + fsxwOperationalCost;
                fsxwCostBreakdownById.push({
                    id: fsxResource.id!,
                    capacityCost: fsxwStorageCost,
                    operationalCost: fsxwOperationalCost,
                    size: numeral(`${fsxResource.storageCapacity}GiB`).value() || 0
                });
            })
        );
    }

    if (isEmpty(compact([ec2Cost, vpcCost, totalFsxnCost, totalEbsStorageCost, totalFsxwCost]))) {
        throw createError(404, 'Pricing details not found for the given input');
    }

    return {
        compute: ec2Cost,
        ...(fsxnStorage && {
            fsxnStorage: {
                fsxStorageCost: totalFsxnCost,
                fsxnCostBreakdownById
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
                fsxwStorageCost: totalFsxwCost,
                fsxwCostBreakdownById
            }
        }),
        total: ec2Cost + vpcCost + totalFsxnCost + totalEbsStorageCost + totalFsxwCost
    };
}

function calculateFsxnCost(fsxnStorage: any, fsxnStorageRates: any, sqlDeploymentMode: string, databaseType?: string) {
    logger.info('Calculating cost for FSx Netapp storage', {
        fsxnStorage,
        fsxnStorageRates,
        sqlDeploymentMode,
        databaseType
    });

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
        fsxnDiskSizes = calculateFsxnStorageCapacity(fsxnStorage.diskSize, sqlDeploymentMode, databaseType);
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

function calculateFsxwCost(fsxwStorage: any, fsxwStorageRates: any) {
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
    const capacityPrice = storageType?.toLowerCase() === 'ssd' ? ssdStorageRate * capacity : hddStorageRate * capacity;
    const iopsPrice = iopsRate * Math.max(iops - 3 * capacity, 0);
    const throughputPrice = throughputRate * provisionedThroughput;

    return (capacityPrice + iopsPrice + throughputPrice) * duration;
}
async function getSqlInstancePricingDetails(
    region: string,
    instanceType?: string,
    operatingSystem?: string,
    usageOperation?: string,
    licenseType?: string
) {
    logger.info('Get SQL instance pricing details', {
        region,
        instanceType,
        operatingSystem,
        usageOperation,
        licenseType
    });

    const params: GetProductsCommandInput = {
        Filters: [
            {
                Type: 'TERM_MATCH',
                Field: 'regionCode',
                Value: region
            },
            {
                Type: 'TERM_MATCH',
                Field: 'productFamily',
                Value: 'Compute Instance'
            },
            {
                Type: 'TERM_MATCH',
                Field: 'tenancy',
                Value: 'Shared'
            },
            {
                Type: 'TERM_MATCH',
                Field: 'capacitystatus',
                Value: 'Used'
            }
        ],
        ...ec2Service,
        ...AWS_PRICING_FORMAT_VERSION
    };

    if (instanceType) {
        params?.Filters?.push({
            Type: 'TERM_MATCH',
            Field: 'instanceType',
            Value: instanceType
        });
    }
    if (usageOperation) {
        params?.Filters?.push({
            Type: 'TERM_MATCH',
            Field: 'operation',
            Value: usageOperation
        });
    }

    if (operatingSystem) {
        params?.Filters?.push({
            Type: 'TERM_MATCH',
            Field: 'operatingSystem',
            Value: operatingSystem
        });
    }

    const pricingResult = await getProducts(params);
    const pricingDetails: {
        [instanceType: string]: { [preInstalledSw: string]: { pricePerUnit: number; unit: string } };
    } = {};
    if (pricingResult?.PriceList) {
        pricingResult.PriceList.forEach(priceItem => {
            const item = (priceItem as LazyJsonString).deserializeJSON();
            const { terms, product } = item;

            if (terms && product) {
                const { OnDemand: onDemandPrice } = terms;
                const { priceDimensions } = onDemandPrice[Object.keys(onDemandPrice)[0]];
                const { unit, pricePerUnit } = priceDimensions[Object.keys(priceDimensions)[0]];
                const { preInstalledSw, instanceType: ec2InstType, licenseModel } = product.attributes;
                if (licenseModel === 'No License required') {
                    // Filter for instances with license included (licenseModel: 'No License required').
                    // Operation codes: SQL Web (RunInstances:0202), SQL Std (RunInstances:0006), SQL Ent (RunInstances:0102), Windows only (RunInstances:0002)
                    if (!pricingDetails[ec2InstType]) {
                        pricingDetails[ec2InstType] = {};
                    }
                    pricingDetails[ec2InstType][preInstalledSw] = {
                        pricePerUnit: Number(pricePerUnit.USD),
                        unit
                    };
                }
            }
        });
    }

    if (instanceType) {
        return pricingDetails; // returns in format { instanceType: { preInstalledSw: { pricePerUnit, unit } } }
    }
    /**
     * If no instanceType is provided, this function gets the pricing details for all instance types.
     * It sorts and filters the pricing details based on the specified license type.
     * - Filters out entries that do not have the specified license type (if provided) or are not available in NA.
     * - Sorts the remaining entries by the price per unit in ascending order.
     */
    const sortedPricingDetails =
        Object.entries(pricingDetails).length > 1
            ? Object.fromEntries(
                  Object.entries(pricingDetails)
                      .filter(([, licenses]) =>
                          licenseType
                              ? licenses[licenseType] && licenses[PRICING_LICENSE_KEYS.SQL_STD] && licenses.NA
                              : licenses[PRICING_LICENSE_KEYS.SQL_STD] && licenses.NA
                      )
                      .sort(([, licensesA], [, licensesB]) => {
                          const priceA = licensesA.NA ? licensesA.NA.pricePerUnit : Infinity;
                          const priceB = licensesB.NA ? licensesB.NA.pricePerUnit : Infinity;
                          return priceA - priceB;
                      })
              )
            : Object.fromEntries(Object.entries(pricingDetails)); // returns in format { instanceType: { preInstalledSw: { pricePerUnit, unit } } } or { instanceType1: { preInstalledSw: { pricePerUnit, unit } },instanceType2: { preInstalledSw: { pricePerUnit, unit } }, instanceType3: { preInstalledSw: { pricePerUnit, unit } } }

    return sortedPricingDetails;
}

function getPricingByLicenseType(
    licenseType: string,
    existingInstanceTypesPricingDetails: Map<
        string,
        { count: number; pricingDetails: { [preInstalledSw: string]: { pricePerUnit: number; unit: string } } }
    >
): number | undefined {
    logger.info('Getting pricing by license type', {
        licenseType
    });
    let instanceHourlyPrice: number | undefined;
    for (const [, { count, pricingDetails }] of existingInstanceTypesPricingDetails) {
        if (pricingDetails && pricingDetails[licenseType]?.pricePerUnit) {
            instanceHourlyPrice = Number(instanceHourlyPrice || 0) + pricingDetails[licenseType].pricePerUnit * count;
        }
    }

    return instanceHourlyPrice;
}

async function deriveInstanceCountPricingDetails(nodeInstanceTypes: string[], region: string) {
    logger.info('Deriving instance count pricing details', { nodeInstanceTypes, region });

    const instanceTypeCount: { [key: string]: number } = nodeInstanceTypes.reduce((acc, instanceType) => {
        acc[instanceType] = (acc[instanceType] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number });

    const existingInstanceTypePricingsDetails = new Map<
        string,
        {
            count: number;
            pricingDetails: {
                [preInstalledSw: string]: {
                    pricePerUnit: number;
                    unit: string;
                };
            };
        }
    >();
    await Promise.all(
        Object.entries(instanceTypeCount).map(async ([instanceType, count]) => {
            const { [instanceType]: pricingDetails } = await getSqlInstancePricingDetails(
                region,
                instanceType,
                'windows'
            );
            existingInstanceTypePricingsDetails.set(instanceType, { count, pricingDetails });
        })
    );

    return existingInstanceTypePricingsDetails;
}
export {
    getProductRates,
    calculateFsxWindowsCapacityPrice,
    getSqlInstancePricingDetails,
    calculatePrice,
    getPricingByLicenseType,
    deriveInstanceCountPricingDetails
};
