import {
    SSMClient,
    SendCommandCommand,
    GetCommandInvocationCommand,
    InvocationDoesNotExist,
    SendCommandCommandInput,
    GetCommandInvocationCommandInput,
    GetCommandInvocationCommandOutput
} from '@aws-sdk/client-ssm';

import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();
async function getSSMClient(region: string, credentialsId: string) {
    logger.debug('Getting SSM client:', region, credentialsId);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new SSMClient({ credentials, region });
}

async function sendSSMCommand(ssmClient: SSMClient, params: SendCommandCommandInput) {
    logger.info('Send SSM Command', params);

    const sendCommand = new SendCommandCommand(params);
    const response = await ssmClient.send(sendCommand);

    logger.debug('SSM Command response', response);
    return response.Command?.CommandId;
}

async function pollCommandStatus(
    ssmClient: SSMClient,
    pollParams: GetCommandInvocationCommandInput
): Promise<GetCommandInvocationCommandOutput> {
    // logger.info('Polling SSM command execution', JSON.stringify(GetCommandInvocationCommandInput));

    try {
        const response: GetCommandInvocationCommandOutput = await ssmClient.send(
            new GetCommandInvocationCommand(pollParams)
        );

        logger.debug('Polling SSM command execution response', response);

        const status = response.Status;

        if (status === 'Success') {
            return response;
        } else {
            await new Promise(resolve => setTimeout(resolve, 100));
            return pollCommandStatus(ssmClient, pollParams);
        }
    } catch (error) {
        if (error instanceof InvocationDoesNotExist) {
            logger.info('Command invocation does not exist yet, waiting...');
            await new Promise(resolve => setTimeout(resolve, 100));
            return pollCommandStatus(ssmClient, pollParams);
        } else {
            logger.error('Error fetching command status:', error);
            throw new Error('Error fetching command status:');
        }
    }
}

async function executeSsmDocument(credentialsId: string, region: string, params: SendCommandCommandInput) {
    logger.info('Execute SSM document', { credentialsId, region, params });

    const ssmClient = await getSSMClient(region, credentialsId);
    const commandId = await sendSSMCommand(ssmClient, params);
    const [instanceIds] = params?.InstanceIds ?? [];
    const pollParams = {
        CommandId: commandId,
        InstanceId: instanceIds
    };
    const response = await pollCommandStatus(ssmClient, pollParams);

    logger.debug('SSM command Response:', response);

    return response;
}
export { executeSsmDocument };
