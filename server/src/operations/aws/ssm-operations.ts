import config from 'config';
import ms from 'ms';
import {
    CommandInvocationStatus,
    GetCommandInvocationCommandInput,
    GetCommandInvocationCommandOutput,
    InvocationDoesNotExist,
    PutParameterCommandInput,
    SendCommandCommandInput
} from '@aws-sdk/client-ssm';
import {
    sendSSMCommand,
    getCommandInvocation,
    describeFSxOntapRegions,
    getConnectionStatus,
    putParameter
} from '../../lib/aws/ssm';
import { sleep } from '../../utils/utils';
import { AWS_REGIONS } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { FSxAvailableRegionType } from '../../routes/types/aws.types';
import { SSMParamterObject } from '../../utils/common-types';

const logger = getLogger();

async function pollCommandStatus(
    credentialsId: string,
    region: string,
    pollParams: GetCommandInvocationCommandInput
): Promise<GetCommandInvocationCommandOutput> {
    logger.info('Polling SSM command execution', pollParams);

    try {
        const response = await getCommandInvocation(credentialsId, region, pollParams);

        logger.debug('Polling SSM command execution response', response);

        const status = response?.Status;

        switch (status) {
            case CommandInvocationStatus.SUCCESS:
                return response;
            case CommandInvocationStatus.FAILED:
            case CommandInvocationStatus.TIMED_OUT:
            case CommandInvocationStatus.CANCELLED:
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
    } catch (error) {
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

    await sleep(1000);
    const response = await pollCommandStatus(credentialsId, region, pollParams);

    logger.debug('SSM command Response:', response);

    return response;
}

async function getFSxOntapRegionsList(credentialsId: string): Promise<{ regions: FSxAvailableRegionType[] }> {
    logger.info('List regions supporting Amazon FSx for NetApp ONTAP', { credentialsId });

    const response = await describeFSxOntapRegions(credentialsId);
    const fsxRegionsList: Array<FSxAvailableRegionType> = [];
    const restrictedRegions: Array<string> = ['us-gov-east-1', 'us-gov-west-1', 'cn-north-1', 'cn-northwest-1'];

    response.forEach(({ Value: regionCode }) => {
        if (regionCode && !restrictedRegions.includes(regionCode)) {
            fsxRegionsList.push({
                regionCode,
                regionName: AWS_REGIONS.has(regionCode) ? AWS_REGIONS.get(regionCode)! : ''
            });
        }
    });

    return { regions: fsxRegionsList };
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

export { executeSSMDocument, getFSxOntapRegionsList, getSSMConnectionStatus, ssmPutParameters, pollCommandStatus };
