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
import { isEmpty } from 'lodash-es';
import {
    sendSSMCommand,
    getCommandInvocation,
    getParametersByPath,
    getConnectionStatus,
    putParameter,
    getParameter
} from '../../lib/aws/ssm';
import { decompressSSMResponse, generateHash, sleep } from '../../utils/utils';
import { AWS_REGIONS, SSM_COMMAND_CACHE_TYPE } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { FSxAvailableRegionType } from '../../routes/types/aws.types';
import { SSMParamterObject } from '../../utils/common-types';
import { describeRegions } from '../../lib/aws/ec2';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC, SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION } from '../workloads/mssql/const';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { SSM_RUN_SHELL_SCRIPT_DOC } from '../workloads/pgsql/const';

const logger = getLogger();

async function pollCommandStatusForAllInstances(
    credentialsId: string,
    region: string,
    commandId: string,
    instanceIds: string[],
    pollInterval: number = ms(config.get<string>('ssm.poll-interval'))
) {
    logger.info('Polling SSM command execution for all instances', { commandId, instanceIds, pollInterval });
    const pollStatuses: {
        commandId: string;
        instanceId: string;
        response?: GetCommandInvocationCommandOutput;
        error?: string;
    }[] = [];

    await Promise.all(
        instanceIds.map(async instanceId => {
            const pollParams = {
                CommandId: commandId,
                InstanceId: instanceId
            };
            try {
                const response = await pollCommandStatus(credentialsId, region, pollParams, pollInterval);
                logger.debug('SSM command Response:', response);
                pollStatuses.push({
                    commandId,
                    instanceId,
                    response
                });
            } catch (error) {
                const errorMessage = `Error executing SSM command on instance ${instanceId}, commandId ${commandId} :  ${error}`;
                logger.error(errorMessage);
                pollStatuses.push({
                    commandId,
                    instanceId,
                    error: errorMessage
                }); // continue polling for other instances even if one fails as this is a generic function; caller function should decide to proceed or fail based on the response
            }
        })
    );

    return pollStatuses;
}

async function pollCommandStatus(
    credentialsId: string,
    region: string,
    pollParams: GetCommandInvocationCommandInput,
    pollInterval: number = ms(config.get<string>('ssm.poll-interval'))
): Promise<GetCommandInvocationCommandOutput> {
    logger.debug('Polling SSM command execution', { pollParams, pollInterval });

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
                throw errorMessage;
            }
        }

        await sleep(pollInterval);
        return await pollCommandStatus(credentialsId, region, pollParams, pollInterval);
    } catch (error: any) {
        if (error instanceof InvocationDoesNotExist) {
            logger.info('Command invocation does not exist yet, waiting...');
            await sleep(pollInterval);
            return pollCommandStatus(credentialsId, region, pollParams, pollInterval);
        }
        throw error;
    }
}

async function executeSSMDocumentMultipleInstances(
    credentialsId: string,
    region: string,
    params: SendCommandCommandInput,
    accountId?: string,
    pollDuration?: number
) {
    logger.info('Execute SSM document on multiple instances', {
        credentialsId,
        region,
        params,
        accountId,
        pollDuration
    });
    const { InstanceIds: instanceIds } = params;
    if (instanceIds && !isEmpty(instanceIds)) {
        const commandId = await sendSSMCommand(credentialsId, region, params, accountId);
        await sleep(1000);
        try {
            if (commandId) {
                const response = await pollCommandStatusForAllInstances(
                    credentialsId,
                    region,
                    commandId,
                    instanceIds,
                    pollDuration
                );
                logger.debug('SSM command Response:', response);
                return response;
            }
            throw new Error('SSM command Id not found');
        } catch (error) {
            const errorMessage = `Error executing SSM command on instance ${instanceIds}, commandId ${commandId} :  ${error}`;
            logger.error(errorMessage);
            throw createError(errorMessage);
        }
    }
    throw createError('Failed to execute SSM document for multiple instances. InstanceIds not found');
}

async function executeSSMDocument(
    credentialsId: string,
    region: string,
    params: SendCommandCommandInput,
    accountId?: string,
    pollDuration?: number
) {
    logger.info('Execute SSM document', { credentialsId, region, params, accountId, pollDuration });

    const commandId = await sendSSMCommand(credentialsId, region, params, accountId);
    const [instanceIds] = params?.InstanceIds ?? [];
    const pollParams = {
        CommandId: commandId,
        InstanceId: instanceIds
    };

    // Sleep for 1 second to avoid immediate polling
    await sleep(1000);
    try {
        const response = await pollCommandStatus(credentialsId, region, pollParams, pollDuration);
        logger.debug('SSM command Response:', response);
        return response;
    } catch (error) {
        const errorMessage = `Error executing SSM command on instance ${instanceIds}, commandId ${commandId} :  ${error}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function callSsmExecution(
    credentialsId: string,
    region: string,
    commands: Array<string>,
    activeNodeInstanceId: string,
    comment?: string,
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
        InstanceIds: [activeNodeInstanceId],
        ...(comment && { Comment: comment?.substring(0, 100) })
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

        const output = await decompressSSMResponse(response?.StandardOutputContent || '');
        if (cacheData) {
            logger.info('Writing to cache', activeNodeInstanceId, cacheHashKey);
            writeToCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey, output, '600s');
        }
        return output;
    } catch (error: any) {
        throw createError(error);
    }
}

async function executeBashSsmCommand(
    credentialsId: string,
    region: string,
    commands: Array<string>,
    activeNodeInstanceId: string,
    accountId?: string,
    comment?: string,
    cacheData: boolean = true,
    executionTimeout?: string
) {
    logger.info('Calling SSM bash command execution', credentialsId, region, commands, activeNodeInstanceId);
    const cacheHashKey = generateHash(activeNodeInstanceId + commands);

    if (cacheData && !process.env.TEST && hasCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey)) {
        logger.info('Reading from cache', activeNodeInstanceId, cacheHashKey);
        return readFromCacheByKey(SSM_COMMAND_CACHE_TYPE, cacheHashKey) as string;
    }

    const defaultParams = {
        DocumentName: SSM_RUN_SHELL_SCRIPT_DOC,
        Documentversion: SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION,
        Parameters: {
            // DBS-1449 - Adding execution timeout in sec
            executionTimeout: [executionTimeout || config.get<string>('ssm.execution-timeout')],
            commands
        }
    };
    const params = {
        ...defaultParams,
        InstanceIds: [activeNodeInstanceId],
        ...(comment && { Comment: comment })
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

        logger.info('SSM RESP>>', response, typeof response);
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

async function getGenericFSxOntapRegionsList(): Promise<{ regions: FSxAvailableRegionType[] }> {
    logger.info('List generic regions supporting Amazon FSx for NetApp ONTAP');

    try {
        const fsxRegionResponse = await getParametersByPath();

        const fsxRegionsList: Array<FSxAvailableRegionType> = [];
        const restrictedRegions: Array<string> = ['us-gov-east-1', 'us-gov-west-1', 'cn-north-1', 'cn-northwest-1'];

        fsxRegionResponse.forEach(({ Value: regionCode }) => {
            if (regionCode && !restrictedRegions.includes(regionCode)) {
                fsxRegionsList.push({
                    regionCode,
                    regionName: AWS_REGIONS.has(regionCode) ? AWS_REGIONS.get(regionCode)! : ''
                });
            }
        });

        return { regions: fsxRegionsList };
    } catch (error: any) {
        logger.error('Get generic FSX ONTAP Region list has failed with error:', error);
        if (error?.$metadata?.httpStatusCode && error.message) {
            throw createError(error?.$metadata?.httpStatusCode, `Error fetching generic fsx region ${error.message}`);
        }
        throw new Error(`Error fetching generic fsx region: ${error}`);
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
            getParametersByPath(credentialsId),
            describeRegions(input, credentialsId)
        ]);

        const fsxRegionsList: Array<FSxAvailableRegionType> = [];
        const restrictedRegions: Array<string> = ['us-gov-east-1', 'us-gov-west-1', 'cn-north-1', 'cn-northwest-1'];

        const { Regions: enabledRegionsInAccount } = ec2RegionResponse;
        fsxRegionResponse.forEach(({ Value: regionCode }) => {
            if (regionCode && !restrictedRegions.includes(regionCode)) {
                if (enabledRegionsInAccount?.some(enabledRegion => enabledRegion?.RegionName === regionCode)) {
                    fsxRegionsList.push({
                        regionCode,
                        regionName: AWS_REGIONS.has(regionCode) ? AWS_REGIONS.get(regionCode)! : ''
                    });
                }
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

async function getSSMConnectionStatus(credentialId: string, region: string, instanceId: string, accountId?: string) {
    logger.info('Check for successful SSM connection', { credentialId, region, instanceId, accountId });
    return getConnectionStatus(
        credentialId,
        region,
        {
            Target: instanceId
        },
        accountId
    );
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
    getGenericFSxOntapRegionsList,
    getFSxOntapRegionsList,
    getSSMConnectionStatus,
    ssmPutParameters,
    pollCommandStatus,
    pollCommandStatusForAllInstances,
    callSsmExecution,
    getEc2SqlParameters,
    executeSSMDocumentMultipleInstances,
    executeBashSsmCommand
};
