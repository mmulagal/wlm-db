import config from 'config';
import ms, { StringValue } from 'ms';
import createError from 'http-errors';
import throat from 'throat';
import {
    CommandInvocationStatus,
    ConnectionStatus,
    GetCommandInvocationCommandInput,
    GetCommandInvocationCommandOutput,
    InvocationDoesNotExist,
    Parameter,
    PutParameterCommandInput,
    SendCommandCommandInput
} from '@aws-sdk/client-ssm';
import { DescribeRegionsCommandInput, DescribeRegionsResult } from '@aws-sdk/client-ec2';
import { isEmpty } from 'lodash-es';
import {
    sendSSMCommand,
    getCommandInvocation,
    getParametersByPath,
    getConnectionStatus,
    putParameter,
    getParameter,
    describeInstanceInformation
} from '../../lib/aws/ssm';
import { decompressSSMResponse, generateHash, sleep } from '../../utils/utils';
import {
    AWS_REGION_KEYS,
    AWS_REGIONS,
    RESTRICTED_FSX_REGIONS,
    SSM_COMMAND_CACHE_TYPE,
    CLOUDWATCH_LOG_GROUP_FOR_SSM_RESPONSE,
    SSM_COMMAND_RUNTIMES
} from '../../utils/consts';
import getLogger from '../../utils/logger';
import { FSxAvailableRegionType } from '../../routes/types/aws.types';
import { SSMParameterObject, MultipleCommandSsmResponse, AWSSDKCacheParams } from '../../utils/common-types';
import { describeRegions } from '../../lib/aws/ec2';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC, SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION } from '../workloads/mssql/const';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { getCloudWatchLogs, setLogGroupRetentionPolicy } from './cloud-watch-logs-operations';
import { getLogsAnalyzerBedrockRegionsList } from './bedrock-operations';

const logger = getLogger();

async function pollCommandStatusForAllInstances(
    credentialsId: string,
    region: string,
    commandId: string,
    instanceIds: string[],
    pollInterval: number = ms(config.get<StringValue>('ssm.poll-interval')),
    throttleSize: number = 5,
    accountId?: string
) {
    logger.info('Polling SSM command execution for all instances', { commandId, instanceIds, pollInterval, accountId });
    const pollStatuses: MultipleCommandSsmResponse[] = [];

    await Promise.all(
        instanceIds.map(
            throat(throttleSize, async instanceId => {
                const pollParams = {
                    CommandId: commandId,
                    InstanceId: instanceId
                };
                try {
                    const response = await pollCommandStatus(
                        credentialsId,
                        region,
                        pollParams,
                        pollInterval,
                        accountId
                    );
                    logger.debug('SSM command Response:', response);
                    pollStatuses.push({
                        commandId,
                        instanceId,
                        response
                    });
                } catch (error) {
                    const errorMessage = `Error executing SSM command on instance ${instanceId}, accountId ${accountId}, commandId ${commandId} :  ${error}`;
                    logger.error(errorMessage);
                    pollStatuses.push({
                        commandId,
                        instanceId,
                        error: errorMessage
                    }); // continue polling for other instances even if one fails as this is a generic function; caller function should decide to proceed or fail based on the response
                }
            })
        )
    );

    return pollStatuses;
}

async function pollCommandStatus(
    credentialsId: string,
    region: string,
    pollParams: GetCommandInvocationCommandInput,
    pollInterval: number = ms(config.get<StringValue>('ssm.poll-interval')),
    accountId?: string
): Promise<GetCommandInvocationCommandOutput> {
    logger.debug('Polling SSM command execution', { pollParams, pollInterval });

    try {
        const response = await getCommandInvocation(credentialsId, region, pollParams, accountId);

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
        return await pollCommandStatus(credentialsId, region, pollParams, pollInterval, accountId);
    } catch (error: any) {
        if (error instanceof InvocationDoesNotExist) {
            logger.info('Command invocation does not exist yet, waiting...');
            await sleep(pollInterval);
            return pollCommandStatus(credentialsId, region, pollParams, pollInterval, accountId);
        }
        throw error;
    }
}

async function executeSSMDocumentMultipleInstances(
    credentialsId: string,
    region: string,
    params: SendCommandCommandInput,
    accountId?: string,
    pollDuration?: number,
    throttleSize: number = 5,
    createCache: boolean = true
) {
    logger.info('Execute SSM document on multiple instances', {
        credentialsId,
        region,
        params,
        accountId,
        pollDuration,
        throttleSize,
        createCache
    });
    const { InstanceIds: instanceIds } = params;
    if (instanceIds && !isEmpty(instanceIds)) {
        const cacheHashKey = generateHash(instanceIds.join('') + JSON.stringify(params));
        if (createCache && !process.env.TEST && hasCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey)) {
            logger.info('Reading from cache', instanceIds.join(), cacheHashKey);
            return readFromCacheByKey(SSM_COMMAND_CACHE_TYPE, cacheHashKey) as MultipleCommandSsmResponse[];
        }

        const commandId = await sendSSMCommand(credentialsId, region, params, accountId);
        await sleep(1000);
        try {
            if (commandId) {
                const response = await pollCommandStatusForAllInstances(
                    credentialsId,
                    region,
                    commandId,
                    instanceIds,
                    pollDuration,
                    throttleSize,
                    accountId
                );
                logger.debug('SSM command Response:', response);
                if (createCache) {
                    logger.info('Writing to cache', instanceIds.join(), cacheHashKey);
                    writeToCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey, response);
                }
                return response;
            }
            throw new Error('SSM command Id not found');
        } catch (error) {
            const errorMessage = `Error executing SSM command on instance ${instanceIds}, accountId ${accountId}, commandId ${commandId} :  ${error}`;
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
    logger.info('Execute SSM document', { credentialsId, region, params: params?.Comment, accountId, pollDuration });

    const commandId = await sendSSMCommand(credentialsId, region, params, accountId);
    const [instanceIds] = params?.InstanceIds ?? [];
    const pollParams = {
        CommandId: commandId,
        InstanceId: instanceIds
    };

    // Sleep for 1 second to avoid immediate polling
    await sleep(1000);
    try {
        const response = await pollCommandStatus(credentialsId, region, pollParams, pollDuration, accountId);
        logger.debug('SSM command commandId, Response:', commandId, response);
        return {
            commandId,
            response,
            instanceId: instanceIds
        };
    } catch (error) {
        const errorMessage = `Error executing SSM command on instance ${instanceIds},  accountId ${accountId}, commandId ${commandId} :  ${error}`;
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
    executionTimeout?: string,
    shouldReadFromCloudWatchLogs: boolean = false,
    documentName: string = SSM_RUN_POWERSHELL_SCRIPT_DOC,
    documentVersion: string = SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION
) {
    logger.info(
        'Calling SSM command execution',
        credentialsId,
        region,
        commands,
        activeNodeInstanceId,
        comment,
        accountId,
        cacheData,
        executionTimeout,
        shouldReadFromCloudWatchLogs,
        documentName,
        documentVersion
    );
    const cacheHashKey = generateHash(activeNodeInstanceId + commands);

    if (cacheData && !process.env.TEST && hasCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey)) {
        logger.info('Reading from cache', activeNodeInstanceId, cacheHashKey);
        return readFromCacheByKey(SSM_COMMAND_CACHE_TYPE, cacheHashKey) as string;
    }

    const defaultParams = {
        DocumentName: documentName,
        Documentversion: documentVersion,
        Parameters: {
            // DBS-1449 - Adding execution timeout in sec
            executionTimeout: [executionTimeout || config.get<string>('ssm.execution-timeout')],
            commands
        }
    };
    const params = {
        ...defaultParams,
        InstanceIds: [activeNodeInstanceId],
        ...(comment && { Comment: comment?.substring(0, 100) }),
        ...(shouldReadFromCloudWatchLogs && {
            CloudWatchOutputConfig: {
                CloudWatchLogGroupName: CLOUDWATCH_LOG_GROUP_FOR_SSM_RESPONSE,
                CloudWatchOutputEnabled: true
            }
        })
    };
    try {
        logger.debug('SSM command execution.', credentialsId, region, activeNodeInstanceId);
        const response = await executeSSMDocument(credentialsId, region, params, accountId);

        // Set the retention period for the log group to 1 day
        // We don't want to await for this to complete, as it is not critical to the SSM command execution
        if (shouldReadFromCloudWatchLogs) {
            setLogGroupRetentionPolicy(credentialsId, region).catch((error: any) => {
                logger.error('Error setting log group retention policy', error);
            });
        }
        const runtime =
            documentName === SSM_RUN_POWERSHELL_SCRIPT_DOC
                ? SSM_COMMAND_RUNTIMES.POWERSHELL
                : SSM_COMMAND_RUNTIMES.SHELL;
        const { error, output = '' } = await extractSsmResponse(credentialsId, region, runtime, response, accountId);
        if (error) {
            throw createError(error);
        }

        if (cacheData) {
            logger.info('Writing to cache', activeNodeInstanceId, cacheHashKey);
            writeToCache(SSM_COMMAND_CACHE_TYPE, cacheHashKey, output, '600s');
        }
        return output;
    } catch (error: any) {
        throw createError(error);
    }
}

async function getSsmResponseFromCloudWatch(
    credentialId: string,
    region: string,
    runtime: SSM_COMMAND_RUNTIMES,
    commandId: string,
    instanceId: string,
    accountId?: string
) {
    logger.info('Getting SSM response from CloudWatch', { credentialId, region, commandId, instanceId, accountId });
    const logGroupName = CLOUDWATCH_LOG_GROUP_FOR_SSM_RESPONSE;
    const logStreamSuffix = `aws-run${runtime}Script/stdout`;
    const logStreamName = `${commandId}/${instanceId}/${logStreamSuffix}`;

    try {
        const logs = await getCloudWatchLogs(credentialId, region, logGroupName, logStreamName, accountId);
        return logs;
    } catch (error) {
        logger.error('Error getting logs from CloudWatch', error);
        throw createError('Error getting logs from CloudWatch');
    }
}

async function getGenericFSxOntapRegionsList(
    includeBedrockStatus?: boolean
): Promise<{ regions: FSxAvailableRegionType[] }> {
    logger.info('List generic regions supporting Amazon FSx for NetApp ONTAP', { includeBedrockStatus });

    const fsxRegionsList: Array<FSxAvailableRegionType> = [];

    try {
        let fsxRegionResponse = await getParametersByPath();

        let bedrockRegions: string[] = [];
        if (includeBedrockStatus) {
            [fsxRegionResponse, bedrockRegions] = await Promise.all([
                getParametersByPath(),
                getLogsAnalyzerBedrockRegionsList()
            ]);
        } else {
            fsxRegionResponse = await getParametersByPath();
        }
        fsxRegionResponse.forEach(({ Value: regionCode }) => {
            if (regionCode && !RESTRICTED_FSX_REGIONS.includes(regionCode)) {
                fsxRegionsList.push({
                    regionCode,
                    regionName: AWS_REGIONS.has(regionCode) ? AWS_REGIONS.get(regionCode)! : '',
                    bedrockAvailable:
                        bedrockRegions.length > 0
                            ? bedrockRegions.some(bedrockRegionCode => bedrockRegionCode === regionCode)
                            : undefined
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

async function getFSxOntapRegionsList(
    credentialsId: string,
    includeBedrockStatus?: boolean,
    cacheParams?: AWSSDKCacheParams
): Promise<{ regions: FSxAvailableRegionType[] }> {
    logger.info('List regions supporting Amazon FSx for NetApp ONTAP', {
        credentialsId,
        includeBedrockStatus,
        cacheParams
    });

    const fsxRegionsList: Array<FSxAvailableRegionType> = [];

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

        let fsxRegionResponse: Parameter[] = [];
        let ec2RegionResponse: DescribeRegionsResult = { Regions: [] };
        let bedrockRegions: string[] = [];
        try {
            if (includeBedrockStatus) {
                [fsxRegionResponse, ec2RegionResponse, bedrockRegions] = await Promise.all([
                    getParametersByPath(),
                    describeRegions(input, credentialsId, cacheParams),
                    getLogsAnalyzerBedrockRegionsList()
                ]);
            } else {
                [fsxRegionResponse, ec2RegionResponse] = await Promise.all([
                    getParametersByPath(),
                    describeRegions(input, credentialsId, cacheParams)
                ]);
            }
        } catch (error: any) {
            if (error?.message?.includes('with an explicit deny in a service control policy')) {
                logger.warn('Region us-east-1 is blocked by SCP', error);
                // Returning a static list of regions as the default AWS region is blocked by SCP
                ec2RegionResponse = { Regions: AWS_REGION_KEYS.map(region => ({ RegionName: region })) };
            } else {
                throw error;
            }
        }

        const { Regions: enabledRegionsInAccount } = ec2RegionResponse;
        fsxRegionResponse.forEach(({ Value: regionCode }) => {
            if (regionCode && !RESTRICTED_FSX_REGIONS.includes(regionCode)) {
                if (enabledRegionsInAccount?.some(enabledRegion => enabledRegion?.RegionName === regionCode)) {
                    fsxRegionsList.push({
                        regionCode,
                        regionName: AWS_REGIONS.has(regionCode) ? AWS_REGIONS.get(regionCode)! : '',
                        bedrockAvailable:
                            bedrockRegions.length > 0
                                ? bedrockRegions.some(bedrockRegionCode => bedrockRegionCode === regionCode)
                                : undefined
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

async function pollSSMConnectionStatus(
    accountId: string,
    credentialId: string,
    region: string,
    instanceId: string,
    retryCount: number = 1,
    pollInterval: number = ms(config.get<StringValue>('ssm.connection-poll-interval'))
) {
    logger.info('Polling SSM connection status', {
        accountId,
        credentialId,
        region,
        instanceId,
        pollInterval,
        retryCount
    });
    if (retryCount > 15) {
        throw new Error(`SSM connection failure for instance: ${instanceId}`);
    }

    try {
        const response = await getSSMConnectionStatus(credentialId, region, instanceId, accountId);
        if (response?.Status === ConnectionStatus.CONNECTED) {
            return response;
        }
        await sleep(pollInterval);
    } catch (error) {
        // not throwing error here as we want to retry
        logger.error('Error polling SSM connection status', instanceId, error);
    }
    return pollSSMConnectionStatus(accountId, credentialId, region, instanceId, retryCount + 1, pollInterval);
}

async function ssmPutParameters(credentialsId: string, region: string, credentials: SSMParameterObject[]) {
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
            const { sql = [], domain = [], oracle = [], asm = [] } = JSON.parse(response);
            return { sql, domain, oracle, asm };
        }
    } catch (error) {
        logger.error(`Failed to get SQL Server SSM parameter for instance ${ec2InstanceId}. Reason: ${error}`);
    }

    return { sql: [], domain: [], oracle: [] };
}

async function getSSMConnectionStatusByInstanceIds(credentialsId: string, region: string, instanceIds: string[]) {
    logger.info('Get SSM connection status by instance ids', { credentialsId, region, instanceIds });

    if (isEmpty(instanceIds)) {
        return new Map();
    }

    const params = {
        Filters: [
            {
                Key: 'InstanceIds',
                Values: instanceIds
            }
        ]
    };

    const results = await describeInstanceInformation(credentialsId, region, params);

    return new Map(
        results.map(({ InstanceId, PingStatus }) => [
            InstanceId,
            PingStatus === 'Online' ? 'connected' : 'notconnected'
        ])
    );
}

async function extractSsmResponse(
    credentialsId: string,
    region: string,
    runtime: SSM_COMMAND_RUNTIMES,
    ssmResponse: {
        commandId?: string;
        instanceId?: string;
        response?: GetCommandInvocationCommandOutput;
        error?: string;
    },
    accountId?: string
) {
    const { commandId, instanceId, response, error } = ssmResponse;
    logger.info(`Extract SSM response from instance ${instanceId} for command with id: ${commandId}`, { response });

    if (error) {
        return { error };
    }

    if (response?.StandardErrorContent) {
        const errorMessage = `SSM command ${commandId}  execution  failed on node ${instanceId}  Error: ${response?.StandardErrorContent}`;
        logger.error(errorMessage);
        return { error: response?.StandardErrorContent };
    }

    if (
        response?.Status === CommandInvocationStatus.TIMED_OUT ||
        response?.Status === CommandInvocationStatus.CANCELLED
    ) {
        const errorMessage = `SSM command ${commandId} execution  timed out on node ${instanceId}`;
        logger.error(errorMessage);
        return { error: errorMessage };
    }

    if (instanceId && (response?.StandardOutputContent ?? '').endsWith('--output truncated--')) {
        if (!response?.CommandId) {
            throw createError('Command Id not found');
        }
        const responses = await getSsmResponseFromCloudWatch(
            credentialsId,
            region,
            runtime,
            response?.CommandId,
            instanceId,
            accountId
        );
        return {
            output: responses.join('')
        };
    }
    const output = await decompressSSMResponse(response?.StandardOutputContent ?? '');
    return { output };
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
    getSSMConnectionStatusByInstanceIds,
    extractSsmResponse,
    pollSSMConnectionStatus
};
