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
    PutParameterCommand,
    PutParameterCommandInput,
    GetParameterCommand,
    GetParameterCommandInput,
    GetParameterCommandOutput,
    DeleteParametersCommand
} from '@aws-sdk/client-ssm';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import { DEFAULT_AWS_REGION } from '../../utils/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getSSMClient(region: string, credentialsId?: string, accountId?: string) {
    logger.debug('Getting SSM client:', region, credentialsId, accountId);

    if (!credentialsId) {
        return new SSMClient({ region });
    }
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

    const ssmClient = await getSSMClient(region, credentialsId, accountId);
    const sendCommand = new SendCommandCommand(params);
    const response = await ssmClient.send(sendCommand);

    logger.debug('SSM Command response', response);
    return response.Command?.CommandId;
}

async function getCommandInvocation(credentialsId: string, region: string, params: GetCommandInvocationCommandInput) {
    logger.info('Getting command invocation details for command', params);

    const ssmClient = await getSSMClient(region, credentialsId);
    const response: GetCommandInvocationCommandOutput = await ssmClient.send(new GetCommandInvocationCommand(params));
    logger.debug('SSM Command response', response);
    return response;
}

async function describeFSxOntapRegions(credentialsId?: string) {
    logger.info('Describe AWS FSX Ontap regions:', { credentialsId });

    const ssmClient = await getSSMClient(DEFAULT_AWS_REGION, credentialsId);

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

    const ssmClient = await getSSMClient(region, credentialsId);
    const response: GetConnectionStatusCommandOutput = await ssmClient.send(new GetConnectionStatusCommand(params));
    logger.info('SSM Command response', response);
    return response;
}

async function putParameter(credentialsId: string, region: string, params: PutParameterCommandInput) {
    logger.info('Put SSM Parameter');

    const ssmClient = await getSSMClient(region, credentialsId);
    const response = await ssmClient.send(new PutParameterCommand(params));

    logger.debug('SSM PutParameter response', response);
    return response;
}

async function getParameter(credentialsId: string, region: string, ssmParameterName: string) {
    logger.info('Get SSM paramter', { credentialsId, region, ssmParameterName });

    const input: GetParameterCommandInput = {
        Name: ssmParameterName,
        WithDecryption: true
    };

    try {
        const ssmClient = await getSSMClient(region, credentialsId);
        const response: GetParameterCommandOutput = await ssmClient.send(new GetParameterCommand(input));
        return response?.Parameter?.Value;
    } catch (error: any) {
        if (error?.name === 'ParameterNotFound') {
            logger.debug('SSM parameter not found');
        } else {
            logger.error('Failed to get SSM parameter', error);
        }
    }
}

async function deleteParameters(credentialsId: string, region: string, ssmParameterNames: string[]) {
    logger.info('Delete SSM paramters', { credentialsId, region, ssmParameterNames });

    const ssmClient = await getSSMClient(region, credentialsId);
    return ssmClient.send(new DeleteParametersCommand({ Names: ssmParameterNames }));
}

async function getAmazonLinuxAMI(region: string, credentialsId: string) {
    logger.info('Getting Amazon Linux AMI', { region, credentialsId });

    try {
        const ssmClient = await getSSMClient(region, credentialsId);
        const parametersInput: GetParametersByPathCommandInput = {
            Path: '/aws/service/ami-amazon-linux-latest',
            Recursive: false,
            WithDecryption: true
        };

        const paginator = paginateGetParametersByPath({ client: ssmClient }, parametersInput);
        const amazonLinuxAmis = [];
        for await (const page of paginator) {
            if (page.Parameters?.length) {
                amazonLinuxAmis.push(...page.Parameters);
            }
        }
        logger.info('Describe AWS FSx regions response:', amazonLinuxAmis);
        return amazonLinuxAmis;
    } catch (error) {
        logger.error('Failed to get Amazon Linux AMIs', error);
    }
}

export {
    getSSMClient,
    sendSSMCommand,
    getCommandInvocation,
    describeFSxOntapRegions,
    getConnectionStatus,
    putParameter,
    getParameter,
    deleteParameters,
    getAmazonLinuxAMI
};
