import {
    SSMClient,
    SendCommandCommand,
    SendCommandCommandInput,
    GetCommandInvocationCommandInput,
    GetCommandInvocationCommandOutput,
    GetCommandInvocationCommand
} from '@aws-sdk/client-ssm';

import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getSSMClient(credentialsId: string, region: string) {
    logger.debug('Getting SSM client:', credentialsId, region);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new SSMClient({ credentials, region });
}

async function sendSSMCommand(credentialsId: string, region: string, params: SendCommandCommandInput) {
    logger.info('Send SSM Command', params);

    const ssmClient = await getSSMClient(credentialsId, region);
    const sendCommand = new SendCommandCommand(params);
    const response = await ssmClient.send(sendCommand);

    logger.info('SSM Command response', response);
    return response.Command?.CommandId;
}

async function getCommandInvocation(credentialsId: string, region: string, params: GetCommandInvocationCommandInput) {
    logger.info('Getting command invocation details for command', params);

    const ssmClient = await getSSMClient(credentialsId, region);
    const response: GetCommandInvocationCommandOutput = await ssmClient.send(new GetCommandInvocationCommand(params));
    logger.info('SSM Command response', response);
    return response;
}

export { getSSMClient, sendSSMCommand, getCommandInvocation };
