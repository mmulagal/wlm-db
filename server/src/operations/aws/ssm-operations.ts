import config from 'config';
import ms from 'ms';
import createError from 'http-errors';
import {
    CommandInvocationStatus,
    GetCommandInvocationCommandInput,
    GetCommandInvocationCommandOutput,
    InvocationDoesNotExist,
    PutParameterCommandInput,
    SendCommandCommandInput
} from '@aws-sdk/client-ssm';
import { DescribeRegionsCommandInput } from '@aws-sdk/client-ec2';
import {
    sendSSMCommand,
    getCommandInvocation,
    describeFSxOntapRegions,
    getConnectionStatus,
    putParameter,
    getParameter
} from '../../lib/aws/ssm';
import { generateHash, sleep } from '../../utils/utils';
import { AWS_REGIONS, SSM_COMMAND_CACHE_TYPE } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { FSxAvailableRegionType } from '../../routes/types/aws.types';
import { SSMParamterObject } from '../../utils/common-types';
import { describeRegions } from '../../lib/aws/ec2';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC } from '../workloads/mssql/const';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';

const logger = getLogger();

async function pollCommandStatus(
    credentialsId: string,
    region: string,
    pollParams: GetCommandInvocationCommandInput
): Promise<GetCommandInvocationCommandOutput> {
    logger.debug('Polling SSM command execution', pollParams);

    try {
        const response = await getCommandInvocation(credentialsId, region, pollParams);

        logger.debug('Polling SSM command execution response', response);

        const status = response?.Status;

        switch (status) {
            case CommandInvocationStatus.TIMED_OUT:
            case CommandInvocationStatus.CANCELLED:
            case CommandInvocationStatus.SUCCESS:
                return response;
            case CommandInvocationStatus.FAILED:
                logger.error(
                    `SSM execution ${status} for command ${pollParams.CommandId} on instance ${pollParams.InstanceId}`
                );
                return response;
            case CommandInvocationStatus.CANCELLING:
            case CommandInvocationStatus.DELAYED:
            case CommandInvocationStatus.IN_PROGRESS:
            case CommandInvocationStatus.PENDING:
                logger.debug(`SSM command execution is in ${status} status. Polling again.`);
                break;
            default: {
                const errorMessage = `SSM command execution returned an unexpected status: ${status} for command ${pollParams.CommandId} on instance ${pollParams.InstanceId}`;
                logger.error(errorMessage);
                throw new Error(errorMessage);
            }
        }

        await sleep(ms(config.get<string>('ssm.poll-interval')));
        return await pollCommandStatus(credentialsId, region, pollParams);
    } catch (error: any) {
        if (error instanceof InvocationDoesNotExist) {
            logger.info('Command invocation does not exist yet, waiting...');
            await sleep(ms(config.get<string>('ssm.poll-interval')));
            return pollCommandStatus(credentialsId, region, pollParams);
        }
        logger.error('Error fetching command status:', error);
        throw new Error(`Error fetching command status:${error}`);
    }
}

async function executeSSMDocument(
    credentialsId: string,
    region: string,
    params: SendCommandCommandInput,
    accountId?: string
) {
    logger.info('Execute SSM document', { credentialsId, region, params, accountId });

    const commandId = await sendSSMCommand(credentialsId, region, params, accountId);
    const [instanceIds] = params?.InstanceIds ?? [];
    const pollParams = {
        CommandId: commandId,
        InstanceId: instanceIds
    };

    // Sleep for 1 second to avoid immediate polling
    await sleep(1000);
    const response = await pollCommandStatus(credentialsId, region, pollParams);

    logger.debug('SSM command Response:', response);

    return response;
}

async function callSsmExecution(
    credentialsId: string,
    region: string,
    commands: Array<string>,
    activeNodeInstanceId: string,
    accountId?: string,
    cacheData: boolean = true,
    executionTimeout?: string
) {
    logger.info('Calling SSM command execution', credentialsId, region, commands, activeNodeInstanceId);
    const cacheHashKey = generateHash(activeNodeInstanceId + commands);

    if (cacheData && !process.env.TEST && hasCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey)) {
        logger.info('Reading from cache', activeNodeInstanceId, cacheHashKey);
        return readFromCacheByKey(SSM_COMMAND_CACHE_TYPE, cacheHashKey) as string;
    }

    const defaultParams = {
        DocumentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
        Documentversion: '1',
        Parameters: {
            // DBS-1449 - Adding execution timeout in sec
            executionTimeout: [executionTimeout || config.get<string>('ssm.execution-timeout')],
            commands
        }
    };
    const params = {
        ...defaultParams,
        InstanceIds: [activeNodeInstanceId]
    };
    try {
        logger.debug('SSM command execution.', credentialsId, region, activeNodeInstanceId);
        const response = await executeSSMDocument(credentialsId, region, params, accountId);
        if (response?.StandardErrorContent) {
            const errorMessage = `SSM command ${response.CommandId}  execution  failed on node ${activeNodeInstanceId}  Error: ${response?.StandardErrorContent}`;
            logger.error(errorMessage);
            throw createError(errorMessage);
        }
        if (
            response.Status === CommandInvocationStatus.TIMED_OUT ||
            response.Status === CommandInvocationStatus.CANCELLED
        ) {
            const errorMessage = `SSM command ${response.CommandId} execution  timed out on node ${activeNodeInstanceId}`;
            logger.error(errorMessage);
            throw createError(errorMessage);
        }

        const output = response?.StandardOutputContent;
        if (cacheData) {
            logger.info('Writing to cache', activeNodeInstanceId, cacheHashKey);
            writeToCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey, output, '600s');
        }
        return output;
    } catch (error: any) {
        throw createError(error);
    }
}

async function getFSxOntapRegionsList(credentialsId: string): Promise<{ regions: FSxAvailableRegionType[] }> {
    logger.info('List regions supporting Amazon FSx for NetApp ONTAP', { credentialsId });

    try {
        const input: DescribeRegionsCommandInput = {
            AllRegions: true,
            Filters: [
                {
                    Name: 'opt-in-status',
                    Values: ['opted-in', 'opt-in-not-required']
                }
            ]
        };
        const [fsxRegionResponse, ec2RegionResponse] = await Promise.all([
            describeFSxOntapRegions(credentialsId),
            describeRegions(input, credentialsId)
        ]);

        const fsxRegionsList: Array<FSxAvailableRegionType> = [];
        const restrictedRegions: Array<string> = ['us-gov-east-1', 'us-gov-west-1', 'cn-north-1', 'cn-northwest-1'];

        const { Regions: enabledRegionsInAccount } = ec2RegionResponse;
        fsxRegionResponse.forEach(({ Value: regionCode }) => {
            if (regionCode && !restrictedRegions.includes(regionCode)) {
                enabledRegionsInAccount?.some(enabledRegion => enabledRegion?.RegionName === regionCode);
                fsxRegionsList.push({
                    regionCode,
                    regionName: AWS_REGIONS.has(regionCode) ? AWS_REGIONS.get(regionCode)! : ''
                });
            }
        });

        return { regions: fsxRegionsList };
    } catch (error: any) {
        logger.error('Get FSX ONTAP Region list has failed with error:', error);
        if (error?.$metadata?.httpStatusCode && error.message) {
            throw createError(error?.$metadata?.httpStatusCode, `Error fetching fsx region ${error.message}`);
        }
        throw new Error(`Error fetching fsx region: ${error}`);
    }
}

async function getSSMConnectionStatus(credentialId: string, region: string, instanceId: string) {
    logger.info('Check for successful SSM connection', { credentialId, region, instanceId });
    return getConnectionStatus(credentialId, region, {
        Target: instanceId
    });
}

async function ssmPutParameters(credentialsId: string, region: string, credentials: SSMParamterObject[]) {
    logger.info('Put SSM parameters', { credentialsId, region });

    const inputList = credentials.map(({ path, value }) => ({
        Name: path,
        Value: JSON.stringify(value),
        Overwrite: true,
        Type: 'SecureString',
        Tier: 'Standard'
    }));

    logger.debug('Put SSM parameters', inputList);

    await Promise.all(
        inputList.map(async input => putParameter(credentialsId, region, input as PutParameterCommandInput))
    );
}

async function getEc2SqlParameters(credentialsId: string, region: string, ec2InstanceId: string) {
    logger.info('Get SSM parameter for SQL Server instance:', {
        credentialsId,
        region,
        ec2InstanceId
    });

    try {
        const response = await getParameter(credentialsId, region, `/netapp/wlmdb/${ec2InstanceId}`);
        if (response) {
            const { sql } = JSON.parse(response);
            return sql;
        }
    } catch (error) {
        logger.error(`Failed to get SQL Server SSM parameter for instance ${ec2InstanceId}. Reason: ${error}`);
    }

    return [];
}

export {
    executeSSMDocument,
    getFSxOntapRegionsList,
    getSSMConnectionStatus,
    ssmPutParameters,
    pollCommandStatus,
    callSsmExecution,
    getEc2SqlParameters
};
