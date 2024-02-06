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

const logger = getLogger();
async function calculateBilling(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    activeInstanceId: string,
    standbyNodeInstanceId?: string
): Promise<UsageCostResponseType> {
    logger.info('Calculating billing for AWS resources', {
        credentialsId,
        region,
        fileSystemId,
        activeInstanceId,
        standbyNodeInstanceId
    });

    const [startTimeFormat, currenTimeFormat] = getCostExplorerTimeRange();
    const tagValue = [activeInstanceId];

    if (standbyNodeInstanceId) {
        tagValue.push(standbyNodeInstanceId);
    }

    const ec2Input = ec2InputForCostExplorer(region, startTimeFormat, currenTimeFormat, tagValue);

    const fsxInput = fsxInputForCostExplorer(region, startTimeFormat, currenTimeFormat, fileSystemId);

    try {
        const [ec2CostExplorerResponse, fsxCostExplorerResponse] = await Promise.all([
            getCostAndUsage(region, ec2Input, credentialsId),
            getCostAndUsage(region, fsxInput, credentialsId)
        ]);
        // Extract the cost from the response
        const ec2Cost = calculateCostfromCostExplorerResponse(ec2CostExplorerResponse);
        const fsxCost = calculateCostfromCostExplorerResponse(fsxCostExplorerResponse);

        return {
            compute: ec2Cost!,
            storage: fsxCost!,
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

    const { region, metadata } = resourceDetail;
    const { credentialsId } = metadata as {
        credentialsId: string;
    };
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
