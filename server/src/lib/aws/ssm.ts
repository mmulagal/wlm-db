import {
    SSMClient,
    SendCommandCommand,
    SendCommandCommandInput,
    GetCommandInvocationCommandInput,
    GetCommandInvocationCommandOutput,
    GetCommandInvocationCommand,
    paginateGetParametersByPath,
    GetParametersByPathCommandInput,
    GetConnectionStatusCommandInput,
    GetConnectionStatusCommand,
    GetConnectionStatusCommandOutput,
    GetParameterCommandInput,
    GetParameterCommandOutput,
    GetParameterCommand
} from '@aws-sdk/client-ssm';

import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import { DEFAULT_AWS_REGION } from '../../utils/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getSSMClient(credentialsId: string, region: string, accountId?: string) {
    logger.debug('Getting SSM client:', credentialsId, region, accountId);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId, accountId);
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

async function describeFSxOntapRegions(credentialsId: string) {
    logger.info('Describe AWS regions:', { credentialsId });

    const ssmClient = await getSSMClient(credentialsId, DEFAULT_AWS_REGION);

    const parametersInput: GetParametersByPathCommandInput = {
        Path: '/aws/service/global-infrastructure/services/fsx-ontap/regions',
        Recursive: false,
        WithDecryption: true
    };

    const paginator = paginateGetParametersByPath({ client: ssmClient }, parametersInput);
    const fsxRegionParameters = [];
    for await (const page of paginator) {
        if (page.Parameters?.length) {
            fsxRegionParameters.push(...page.Parameters);
        }
    }
    logger.debug('Describe AWS FSx regions response:', fsxRegionParameters);

    return fsxRegionParameters;
}

async function getConnectionStatus(credentialsId: string, region: string, params: GetConnectionStatusCommandInput) {
    logger.info('Getting command invocation details for command', params);

    const ssmClient = await getSSMClient(credentialsId, region);
    const response: GetConnectionStatusCommandOutput = await ssmClient.send(new GetConnectionStatusCommand(params));
    logger.info('SSM Command response', response);
    return response;
}

async function getparamater(credentialsId: string, region: string, params: GetParameterCommandInput) {
    logger.info('Getting command invocation details for command', params);

    const ssmClient = await getSSMClient(credentialsId, region);
    const response: GetParameterCommandOutput = await ssmClient.send(new GetParameterCommand(params));
    logger.info('SSM Command response', response);
    return response;
}

export { getSSMClient, sendSSMCommand, getCommandInvocation, describeFSxOntapRegions, getConnectionStatus, getparamater };
