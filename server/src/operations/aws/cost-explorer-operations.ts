import {
    GetCostAndUsageCommandInput,
    GetCostAndUsageCommandOutput,
    GetTagsCommandInput
} from '@aws-sdk/client-cost-explorer';
import moment from 'moment';
import { UsageCostResponseType } from '../../routes/types/database-hosts.types';
import { getCostAndUsage, getTagsfromCostExplorer } from '../../lib/aws/cost-explorer';
import getLogger from '../../utils/logger';
import { BILLING, WLMDB_COST_ALLOCATION_TAG } from '../../utils/consts';
import { ResourceDetails } from '../../utils/common-types';
import { getFsxStorageCapacity } from './fsx-operations';

const logger = getLogger();
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

async function getCostAllocationTags(resourceDetail: ResourceDetails) {
    logger.info(' Get cost allocation tag at account level');

    const { region, credentials_id: credentialsId } = resourceDetail;

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

export { calculateBilling, getCostExplorerTimeRange, getCostAllocationTags };
