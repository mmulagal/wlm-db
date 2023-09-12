import { GetProductsCommandInput, GetProductsCommandOutput } from '@aws-sdk/client-pricing';
import { LazyJsonString } from '@smithy/smithy-client';
import { PricingServiceRequestType, PricingServiceResponseType } from '../../routes/types/pricing.types';
import getLogger from '../../utils/logger';
import { DEFAULT_AWS_REGION } from '../../utils/consts';
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

const formatVersion = {
    FormatVersion: 'aws_v1'
};

const fsxService = {
    ServiceCode: 'AmazonFSx'
};

const ec2Service = {
    ServiceCode: 'AmazonEC2'
};

const storageProductFamily: Filter = {
    Type: 'TERM_MATCH',
    Field: 'productFamily',
    Value: 'Storage'
};

const readWriteRequestProductFamily: Filter = {
    Type: 'TERM_MATCH',
    Field: 'productFamily',
    Value: 'Request'
};

function getPriceUtil(rate: string, quantity: number, instanceCount = 1): number {
    logger.info('Calculating price');

    return Number(quantity) * Number(rate) * instanceCount;
}

function getRegion(region: string): Filter {
    logger.debug('Getting region', { region });

    return {
        Type: 'TERM_MATCH',
        Field: 'regionCode',
        Value: region || DEFAULT_AWS_REGION
    };
}

function getDeploymentOption(deploymentOption?: string): Filter {
    logger.debug('Getting deployment option', { deploymentOption });

    const deploymentString: string = deploymentOption === 'singleAZ' ? 'Single-AZ_2N' : 'Multi-AZ';

    return {
        Type: 'TERM_MATCH',
        Field: 'deploymentOption',
        Value: deploymentString
    };
}

function getSqlSoftwareEdition(sqlSoftwareType: string): Filter {
    logger.debug('Get sql software edition for filter', { sqlSoftwareType });

    const edition = sqlSoftwareTypes.get(sqlSoftwareType?.toLocaleLowerCase()) || sqlSoftwareTypes.get('standard');

    return {
        Type: 'TERM_MATCH',
        Field: 'preInstalledSw',
        Value: edition!
    };
}

function getEc2InstaceInput(compute: PricingServiceRequestType['compute']): GetProductsCommandInput {
    logger.info('Get ec2 instance input', { compute });

    return {
        Filters: [
            getRegion(compute.regionCode),
            getSqlSoftwareEdition(compute.sqlSoftwareType),
            {
                Type: 'TERM_MATCH',
                Field: 'productFamily',
                Value: 'Compute Instance'
            },
            {
                Type: 'TERM_MATCH',
                Field: 'instanceType',
                Value: compute.instanceType
            },
            {
                Type: 'TERM_MATCH',
                Field: 'operatingSystem',
                Value: 'windows'
            },
            {
                Type: 'TERM_MATCH',
                Field: 'tenancy',
                Value: 'Shared' // default Shared for now
            },
            {
                Type: 'TERM_MATCH',
                Field: 'CapacityStatus',
                Value: 'Used' // On-demand
            }
        ],
        ...ec2Service,
        ...formatVersion
    };
}

function getEc2StorageInput(compute: PricingServiceRequestType['compute']): GetProductsCommandInput {
    logger.info('Getting ec2 storage (EBS) input');

    return {
        Filters: [
            getRegion(compute.regionCode),
            storageProductFamily,
            {
                Type: 'TERM_MATCH',
                Field: 'volumeType',
                Value: 'General Purpose'
            },
            {
                Type: 'TERM_MATCH',
                Field: 'volumeApiName',
                Value: 'gp2'
            }
        ],
        ...ec2Service,
        ...formatVersion
    };
}

function getFSxNStorageInput(storage: PricingServiceRequestType['storage']): GetProductsCommandInput {
    logger.info('Geting FSxN Storage Input', { storage });

    return {
        Filters: [
            getRegion(storage.regionCode),
            getDeploymentOption(storage?.deploymentOption),
            storageProductFamily,
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
        ...fsxService,
        ...formatVersion
    };
}

function getFSxNThroughputInput(storage: PricingServiceRequestType['storage']): GetProductsCommandInput {
    logger.info('Geting FSxN Throughput Input', { storage });

    return {
        Filters: [
            getRegion(storage.regionCode),
            getDeploymentOption(storage?.deploymentOption),
            {
                Type: 'TERM_MATCH',
                Field: 'productFamily',
                Value: 'Provisioned Throughput'
            },
            {
                Type: 'TERM_MATCH',
                Field: 'fileSystemType',
                Value: 'ONTAP'
            }
        ],
        ...fsxService,
        ...formatVersion
    };
}

function getFSxNIopsInput(storage: PricingServiceRequestType['storage']): GetProductsCommandInput {
    logger.info('Geting FSxN Iops Input', { storage });

    return {
        Filters: [
            getRegion(storage.regionCode),
            getDeploymentOption(storage?.deploymentOption),
            {
                Type: 'TERM_MATCH',
                Field: 'productFamily',
                Value: 'Provisioned IOPS'
            },
            {
                Type: 'TERM_MATCH',
                Field: 'fileSystemType',
                Value: 'ONTAP'
            }
        ],
        ...fsxService,
        ...formatVersion
    };
}

function getFSxNReadRequestsInput(storage: PricingServiceRequestType['storage']): GetProductsCommandInput {
    logger.info('Geting FSxN read requests Input', { storage });

    return {
        Filters: [
            getRegion(storage.regionCode),
            getDeploymentOption(storage?.deploymentOption),
            readWriteRequestProductFamily,
            {
                Type: 'TERM_MATCH',
                Field: 'fileSystemType',
                Value: 'ONTAP'
            },
            {
                Type: 'TERM_MATCH',
                Field: 'requestType',
                Value: 'Read'
            }
        ],
        ...fsxService,
        ...formatVersion
    };
}

function getFSxNWriteRequestsInput(storage: PricingServiceRequestType['storage']): GetProductsCommandInput {
    logger.info('Geting FSxN write requests Input', { storage });

    return {
        Filters: [
            getRegion(storage.regionCode),
            getDeploymentOption(storage?.deploymentOption),
            readWriteRequestProductFamily,
            {
                Type: 'TERM_MATCH',
                Field: 'fileSystemType',
                Value: 'ONTAP'
            },
            {
                Type: 'TERM_MATCH',
                Field: 'requestType',
                Value: 'Write'
            }
        ],
        ...fsxService,
        ...formatVersion
    };
}

function getVpcInput(): GetProductsCommandInput {
    logger.info('Get Vpc Input');

    return {
        ServiceCode: 'AmazonVPC',
        Filters: [
            getRegion(DEFAULT_AWS_REGION),
            {
                Type: 'TERM_MATCH',
                Field: 'group',
                Value: 'AWSClientVPN'
            }
            // TODO: add more filters here
        ],
        ...formatVersion
    };
}

function parseResponse(response: GetProductsCommandOutput): string {
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

    return rate;
}

function calculateEc2Cost(instanceRate: string, storageRate: string): number {
    logger.debug('Calculating compute cost');

    return getPriceUtil(instanceRate, HOURS_IN_MONTH, 2) + getPriceUtil(storageRate, DEFAULT_EBS_STORAGE, 2);
}

function getInputs(
    compute: PricingServiceRequestType['compute'],
    storage: PricingServiceRequestType['storage'],
    connectivity: PricingServiceRequestType['connectivity']
): GetProductsCommandInput[] {
    logger.info('Getting product inputs', {
        compute,
        storage,
        connectivity
    });

    return [
        getEc2InstaceInput(compute),
        getEc2StorageInput(compute),
        getFSxNStorageInput(storage),
        getFSxNThroughputInput(storage),
        getFSxNIopsInput(storage),
        getFSxNReadRequestsInput(storage),
        getFSxNWriteRequestsInput(storage),
        ...((connectivity?.createNewVpc && [getVpcInput()]) || [])
    ];
}

async function calculatePrice(
    compute: PricingServiceRequestType['compute'],
    storage: PricingServiceRequestType['storage'],
    connectivity: PricingServiceRequestType['connectivity']
): Promise<PricingServiceResponseType> {
    logger.info('calculating price', {
        compute,
        storage,
        connectivity
    });

    const inputList: GetProductsCommandInput[] = getInputs(compute, storage, connectivity);

    const productsResponse = await Promise.all(
        inputList.map(async (input: GetProductsCommandInput): Promise<GetProductsCommandOutput> => getProducts(input))
    );

    const [
        ec2InstanceRate,
        ec2StorageRate
        // fsxStorageRate,
        // fsxThroughputRate,
        // fsxIopsRate,
        // fsxReadRequestsRate,
        // fsxWriteRequestsRate
    ] = (productsResponse || []).map(parseResponse);

    const ec2Cost = calculateEc2Cost(ec2InstanceRate, ec2StorageRate);

    // const fsxStorageCost = calculateFsxStorageCost(
    //     fsxStorageRate,
    //     storage.diskSize
    // );

    // const fsxThroughputCost = calculateFsxThroughputCost(
    //     fsxThroughputRate,
    //     fsxIopsRate,
    //     fsxReadRequestsRate,
    //     fsxWriteRequestsRate,
    //     storage?.throughput,
    //     storage?.iops
    // );

    return {
        storage: {
            storageCapacity: 128,
            throughput: 184.32
        },
        compute: ec2Cost,
        total: 1573.06
    };
}

export default calculatePrice;
