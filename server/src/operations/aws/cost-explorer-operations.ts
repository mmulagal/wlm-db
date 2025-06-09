import {
    GetCostAndUsageCommandInput,
    GetCostAndUsageCommandOutput,
    GetTagsCommandInput,
    ResultByTime
} from '@aws-sdk/client-cost-explorer';
import moment from 'moment';
import { UsageCostResponseType } from '../../routes/types/database-hosts.types';
import { getCostAndUsage, getTagsfromCostExplorer } from '../../lib/aws/cost-explorer';
import getLogger from '../../utils/logger';
import { BILLING, WLMDB_COST_ALLOCATION_TAG } from '../../utils/consts';
import { describeFSxFileSystems } from '../../lib/aws/fsx';
import { getFsxStorageCapacity } from './fsx-operations';

const logger = getLogger();
const EC2_COMPUTE = 'Amazon Elastic Compute Cloud - Compute';
const FSX = 'Amazon FSx';

async function calculateBilling(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    node1InstanceId: string,
    node2InstanceId?: string
): Promise<UsageCostResponseType> {
    logger.info('Calculating billing for AWS resources', {
        credentialsId,
        region,
        fileSystemId,
        node1InstanceId,
        node2InstanceId
    });

    const [startTimeFormat, currenTimeFormat] = getCostExplorerTimeRange();
    const tagValue = [node1InstanceId];

    if (node2InstanceId) {
        tagValue.push(node2InstanceId);
    }

    const fsxnIds = Array.isArray(fileSystemId) ? fileSystemId : [fileSystemId];
    try {
        const ec2Input = ec2InputForCostExplorer(region, startTimeFormat, currenTimeFormat, tagValue);
        const ec2CostExplorerpromise = getCostAndUsage(region, ec2Input, credentialsId);

        const fsxnCostBreakdownById: { id: any; cost: number; size: number }[] = [];
        let totalFsxnCost = 0;

        const fsxnPromises = fsxnIds.map(async fsxnId => {
            const fsxInput = fsxInputForCostExplorer(region, startTimeFormat, currenTimeFormat, fsxnId);
            const fsxStorageCapacityPromise = getFsxStorageCapacity(credentialsId, region, fsxnId);
            const fsxnCostExplorerPromise = getCostAndUsage(region, fsxInput, credentialsId);

            const [fsxStorageCapacity, fsxnCostExplorerResponse] = await Promise.all([
                fsxStorageCapacityPromise,
                fsxnCostExplorerPromise
            ]);

            const fsxnCost = calculateCostfromCostExplorerResponse(fsxnCostExplorerResponse);
            fsxnCostBreakdownById.push({
                id: fsxnId,
                cost: fsxnCost!,
                size: (fsxStorageCapacity && fsxStorageCapacity.storage) || 0
            });
            totalFsxnCost += fsxnCost!;
        });

        const [ec2CostExplorerResponse] = await Promise.all([ec2CostExplorerpromise, ...fsxnPromises]);
        const ec2Cost = calculateCostfromCostExplorerResponse(ec2CostExplorerResponse);

        return {
            compute: ec2Cost!,
            storage: {
                fsxn: totalFsxnCost,
                fsxnBreakDownById: fsxnCostBreakdownById
            },
            estimationType: BILLING,
            connectivity: 0, // Since we are not creating tag on resource other than ec2 and fsx
            others: 0
        };
    } catch (error) {
        logger.error('Error retrieving billng cost and usage:', error);
        throw error;
    }
}

function fsxInputForCostExplorer(
    region: string,
    startTimeFormat: string,
    currenTimeFormat: string,
    fileSystemId: string
) {
    const fsxInput: GetCostAndUsageCommandInput = {
        TimePeriod: {
            Start: startTimeFormat,
            End: currenTimeFormat
        },
        Filter: {
            And: [
                {
                    Dimensions: {
                        Key: 'SERVICE',
                        Values: ['Amazon FSx']
                    }
                },
                {
                    Dimensions: {
                        Key: 'REGION',
                        Values: [region]
                    }
                },
                {
                    Tags: {
                        Key: WLMDB_COST_ALLOCATION_TAG,
                        Values: [fileSystemId]
                    }
                }
            ]
        },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost']
    };

    return fsxInput;
}

function ec2InputForCostExplorer(
    region: string,
    startTimeFormat: string,
    currenTimeFormat: string,
    tagValue: Array<string>
) {
    const ec2Input: GetCostAndUsageCommandInput = {
        TimePeriod: {
            Start: startTimeFormat,
            End: currenTimeFormat
        },
        Filter: {
            And: [
                {
                    Dimensions: {
                        Key: 'SERVICE',
                        Values: ['Amazon Elastic Compute Cloud - Compute']
                    }
                },
                {
                    Dimensions: {
                        Key: 'REGION',
                        Values: [region]
                    }
                },
                {
                    Tags: {
                        Key: WLMDB_COST_ALLOCATION_TAG,
                        Values: tagValue
                    }
                }
            ]
        },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost']
    };

    return ec2Input;
}

function getCostExplorerTimeRange() {
    logger.debug('Cost explorer Time range calcaultion');
    const startTime = new Date();
    const endTime = new Date();
    startTime.setDate(startTime.getDate() - 30);
    const currenTimeFormat = moment(endTime).format('YYYY-MM-DD');
    const startTimeFormat = moment(startTime).format('YYYY-MM-DD');

    return [startTimeFormat, currenTimeFormat];
}

function calculateCostfromCostExplorerResponse(costExplorerResponse: GetCostAndUsageCommandOutput) {
    logger.debug(' Calculate cost from Cost explorer Response', costExplorerResponse);
    const response = costExplorerResponse?.ResultsByTime?.reduce((acc, curr) => {
        const amount = parseFloat(curr?.Total?.UnblendedCost?.Amount || '0');
        return acc + amount;
    }, 0);
    return response;
}

async function getCostAllocationTags(credentialsId: string, region: string) {
    logger.info(' Get cost allocation tag at account level');

    try {
        const [startTimeFormat, currenTimeFormat] = getCostExplorerTimeRange();
        const input: GetTagsCommandInput = {
            TimePeriod: {
                Start: startTimeFormat,
                End: currenTimeFormat
            }
        };
        const tagsResponse = await getTagsfromCostExplorer(region!, input, credentialsId);
        logger.info('Cost allocation tag response', tagsResponse);
        return tagsResponse;
    } catch (error) {
        logger.error('Error while retrieving cost allocation tag');
        throw error;
    }
}

async function getBillByResourceIds(
    credentialsId: string,
    region: string,
    resourcesGroupedById: Map<string, string[]>
) {
    logger.info('Get billing by resource ids', { region });

    const awsResourcesList: string[] = [...resourcesGroupedById.values()].flat();

    const [startTimeFormat, currenTimeFormat] = getCostExplorerTimeRange();
    const input: GetCostAndUsageCommandInput = {
        TimePeriod: {
            Start: startTimeFormat,
            End: currenTimeFormat
        },
        Filter: {
            And: [
                {
                    Dimensions: {
                        Key: 'SERVICE',
                        Values: [EC2_COMPUTE, FSX]
                    }
                },
                {
                    Dimensions: {
                        Key: 'REGION',
                        Values: [region]
                    }
                },
                {
                    Tags: {
                        Key: WLMDB_COST_ALLOCATION_TAG,
                        Values: awsResourcesList
                    }
                }
            ]
        },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [
            {
                Type: 'TAG',
                Key: WLMDB_COST_ALLOCATION_TAG
            }
        ]
    };

    try {
        const [costExplorerResponse, fileSystems] = await Promise.all([
            getCostAndUsage(region, input, credentialsId),
            describeFSxFileSystems(credentialsId, region, { useCache: true })
        ]);

        const fileSystemStorageMap = new Map<string, number>();
        fileSystems?.forEach(({ FileSystemId, StorageCapacity }) => {
            if (FileSystemId && StorageCapacity) {
                fileSystemStorageMap.set(FileSystemId, StorageCapacity);
            }
        });

        /*
        SDK response, ResultsByTime, is an array of objects, each object contains the cost of the resources for that time period.
        We have two objects as the time period is for two months. We need to calculate the cost for each resource for the entire time period.
        [
            {
                "Estimated": true,
                "Groups": [
                    {
                        "Keys": [
                            "wlmdb-cost-resource$fs-081a791ea94f61aa2"
                        ],
                        "Metrics": {
                            "UnblendedCost": {
                                "Amount": "44.51081049",
                                "Unit": "USD"
                            }
                        }
                    },
                    {
                        "Keys": [
                            "wlmdb-cost-resource$i-023fe93bb9111004b"
                        ],
                        "Metrics": {
                            "UnblendedCost": {
                                "Amount": "66.627",
                                "Unit": "USD"
                            }
                        }
                    }
                ],
                "TimePeriod": {
                    "End": "2024-10-01",
                    "Start": "2024-09-01"
                },
                "Total": {}
            },
            {
                "Estimated": true,
                "Groups": [],
                "TimePeriod": {
                    "End": "2024-10-02",
                    "Start": "2024-10-01"
                },
                "Total": {
                    "UnblendedCost": {
                        "Amount": "0",
                        "Unit": "USD"
                    }
                }
            }
        ]
        After reducing the array, we will have an object with the resource id as the key and the cost as the value.
        {
            "fs-081a791ea94f61aa2": 44.51081049,
            "i-023fe93bb9111004b": 66.627
        }
        Now, we have to calculate the cost for each resource type, EC2 and FSx.
        {
            "compute": 66.627,
            "storage": {
                "fsxn": 44.51081049,
                "fsxnBreakDownById": [
                    {
                        "id": "fs-081a791ea94f61aa2",
                        "cost": 44.51081049,
                        "size": 1200
                    }
                ]
            },
            "estimationType": "billing",
            "connectivity": 0,
            "others": 0
        }
        The final result will be a map with the resource id as the key and the cost as the value.
        This exercise is done for every single database-host by iterating over the resourcesGroupedById map.
        */
        const bills = new Map();
        for (const [key, value] of resourcesGroupedById) {
            const bill = costExplorerResponse.ResultsByTime?.reduce(billReducer.bind(null, value), {}) as Record<
                string,
                number
            >;
            const { fsxBill, ec2Bill, fsxnBreakDownById } = getBillByResourceId(bill, fileSystemStorageMap);

            bills.set(key, {
                compute: ec2Bill,
                storage: {
                    fsxn: fsxBill,
                    fsxnBreakDownById
                },
                estimationType: BILLING,
                connectivity: 0,
                others: 0
            });
        }

        return bills;
    } catch (error) {
        logger.error('Error while retrieving billing by resource ids', error);
        throw error;
    }
}

function billReducer(resourceList: string[], resources: Record<string, number>, { Groups = [] }: ResultByTime) {
    Groups.forEach(({ Keys, Metrics }) => {
        const key = Keys?.[0]?.split('$')?.[1];
        if (key && resourceList.includes(key)) {
            resources[key] = (resources[key] || 0) + Number(Metrics?.UnblendedCost?.Amount);
        }
    });
    return resources;
}

function getBillByResourceId(resourceBill: Record<string, number>, fileSystemStorageMap: Map<string, number>) {
    return Object.keys(resourceBill || {}).reduce(
        (acc, curr) => {
            if (/^fs-\w+$/.test(curr)) {
                acc.fsxBill += Number(resourceBill?.[curr]);
                acc.fsxnBreakDownById.push({
                    id: curr,
                    cost: resourceBill?.[curr] || 0,
                    size: fileSystemStorageMap.get(curr) || 0
                });
            } else if (/^i-\w+$/.test(curr)) {
                acc.ec2Bill += Number(resourceBill?.[curr]);
            }
            return acc;
        },
        { fsxBill: 0, ec2Bill: 0, fsxnBreakDownById: [] } as {
            fsxBill: number;
            ec2Bill: number;
            fsxnBreakDownById: { [key: string]: string | number }[];
        }
    );
}

export { calculateBilling, getCostExplorerTimeRange, getCostAllocationTags, getBillByResourceIds };
