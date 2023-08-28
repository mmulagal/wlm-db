import {
    SSMClient,
    GetCommandInvocationCommandInput,
    GetCommandInvocationCommandOutput,
    InvocationDoesNotExist,
    SendCommandCommandInput
} from '@aws-sdk/client-ssm';
import { getSSMClient, sendSSMCommand, getCommandInvocation } from '../../lib/aws/ssm';
import { SSM_QUERY_EXECUTION_STATUS } from '../../utils/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function pollCommandStatus(
    ssmClient: SSMClient,
    pollParams: GetCommandInvocationCommandInput
): Promise<GetCommandInvocationCommandOutput> {
    logger.info('Polling SSM command execution', pollParams);

    try {
        const response = await getCommandInvocation(ssmClient, pollParams);

        logger.debug('Polling SSM command execution response', response);

        const status = response.Status;

        if (status === SSM_QUERY_EXECUTION_STATUS.SUCCESS || status == SSM_QUERY_EXECUTION_STATUS.FAILED) {
            return response;
        } else {
            await new Promise(resolve => setTimeout(resolve, 100));
            return await pollCommandStatus(ssmClient, pollParams);
        }
    } catch (error) {
        if (error instanceof InvocationDoesNotExist) {
            logger.info('Command invocation does not exist yet, waiting...');
            await new Promise(resolve => setTimeout(resolve, 100));
            return await pollCommandStatus(ssmClient, pollParams);
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
