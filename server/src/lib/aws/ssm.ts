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

async function getSSMClient(credentialsId: string, region: string, accountId?: string) {
    logger.debug('Getting SSM client:', credentialsId, region, accountId);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId, accountId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new SSMClient({ credentials, region });
}

async function sendSSMCommand(
    credentialsId: string,
    region: string,
    params: SendCommandCommandInput,
    accountId?: string
) {
    logger.info('Send SSM Command', params);

    const ssmClient = await getSSMClient(credentialsId, region, accountId);
    const sendCommand = new SendCommandCommand(params);
    const response = await ssmClient.send(sendCommand);

    logger.debug('SSM Command response', response);
    return response.Command?.CommandId;
}

async function getCommandInvocation(credentialsId: string, region: string, params: GetCommandInvocationCommandInput) {
    logger.info('Getting command invocation details for command', params);

    const ssmClient = await getSSMClient(credentialsId, region);
    const response: GetCommandInvocationCommandOutput = await ssmClient.send(new GetCommandInvocationCommand(params));
    logger.debug('SSM Command response', response);
    return response;
}

export { getSSMClient, sendSSMCommand, getCommandInvocation };
