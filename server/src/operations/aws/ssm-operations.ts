import config from 'config';
import ms from 'ms';
import {
    CommandInvocationStatus,
    ConnectionStatus,
    GetCommandInvocationCommandInput,
    GetCommandInvocationCommandOutput,
    InvocationDoesNotExist,
    SendCommandCommandInput
} from '@aws-sdk/client-ssm';
import { sendSSMCommand, getCommandInvocation, describeFSxOntapRegions, getConnectionStatus } from '../../lib/aws/ssm';
import { sleep } from '../../utils/utils';
import { AWS_REGIONS } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { FSxAvailableRegionType } from '../../routes/types/aws.types';

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
                logger.error(`SSM execution ${status} for command ${pollParams.CommandId}`);
                return response;
            case CommandInvocationStatus.CANCELLING:
            case CommandInvocationStatus.DELAYED:
            case CommandInvocationStatus.IN_PROGRESS:
            case CommandInvocationStatus.PENDING:
                logger.debug(`SSM command execution is in ${status} status. Polling again.`);
                break;
            default: {
                const errorMessage = `SSM command execution returned an unexpected status: ${status}`;
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
    logger.info('Check for successful SSM connection', credentialId, region, instanceId);
    return getConnectionStatus(credentialId, region, {
        Target: instanceId
    });
}

async function isSSMConnectionSuccessful(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId?: string,
    resourceId?: string
) {
    logger.info(
        'Check if SSM connection is a success',
        credentialsId,
        region,
        activeNodeInstanceId,
        standbyNodeInstanceId,
        resourceId
    );
    try {
        let connectionStatus = await getSSMConnectionStatus(credentialsId, region!, activeNodeInstanceId);
        const resourceError = `for resource ID ${resourceId}`;
        // Connection to activenode is successful
        if (connectionStatus.Status === ConnectionStatus.CONNECTED) {
            return true;
        }

        let errorMessage = `SSM connection to node ${activeNodeInstanceId} has failed.`;
        errorMessage = resourceId ? errorMessage.concat(resourceError) : errorMessage;
        logger.error(errorMessage);

        // Check for connection to standby node
        if (standbyNodeInstanceId) {
            connectionStatus = await getSSMConnectionStatus(credentialsId, region!, standbyNodeInstanceId);
            if (connectionStatus.Status === ConnectionStatus.CONNECTED) {
                return true;
            }

            errorMessage = `SSM connection to nodes ${activeNodeInstanceId} and ${standbyNodeInstanceId} has failed.`;
            errorMessage = resourceId ? errorMessage.concat(resourceError) : errorMessage;
            logger.error(errorMessage);
        }
    } catch (error) {
        logger.error(
            `Error while checking SSM connection ${credentialsId}, ${region}, ${activeNodeInstanceId}, ${standbyNodeInstanceId} for resource ID ${resourceId}`
        );
        return false;
    }

    return false;
}

export { executeSSMDocument, getFSxOntapRegionsList, getSSMConnectionStatus, isSSMConnectionSuccessful };
