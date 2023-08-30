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

async function getCommandInvocation(ssmClient: SSMClient, params: GetCommandInvocationCommandInput) {
    logger.info('Getting command invocation details for command', params);
    const response: GetCommandInvocationCommandOutput = await ssmClient.send(new GetCommandInvocationCommand(params));
    logger.debug('SSM Command response', response);
    return response;
}

export { getSSMClient, sendSSMCommand, getCommandInvocation };
