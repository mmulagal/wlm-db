import {
    GetCommandInvocationCommandInput,
    GetCommandInvocationCommandOutput,
    InvocationDoesNotExist,
    SendCommandCommandInput
} from '@aws-sdk/client-ssm';
import { sendSSMCommand, getCommandInvocation } from '../../lib/aws/ssm';
import { waitFor } from '../../utils/utils';
import { SSM_QUERY_EXECUTION_STATUS } from '../../utils/consts';
import getLogger from '../../utils/logger';

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

        const status = response.Status;

        if (status === SSM_QUERY_EXECUTION_STATUS.SUCCESS || status == SSM_QUERY_EXECUTION_STATUS.FAILED) {
            return response;
        } else {
            await waitFor(100);
            return await pollCommandStatus(credentialsId, region, pollParams);
        }
    } catch (error) {
        if (error instanceof InvocationDoesNotExist) {
            logger.info('Command invocation does not exist yet, waiting...');
            await waitFor(100);
            return await pollCommandStatus(credentialsId, region, pollParams);
        } else {
            logger.error('Error fetching command status:', error);
            throw new Error('Error fetching command status:');
        }
    }
}

async function executeSSMDocument(credentialsId: string, region: string, params: SendCommandCommandInput) {
    logger.info('Execute SSM document', { credentialsId, region, params });

    const commandId = await sendSSMCommand(credentialsId, region, params);
    const [instanceIds] = params?.InstanceIds ?? [];
    const pollParams = {
        CommandId: commandId,
        InstanceId: instanceIds
    };
    const response = await pollCommandStatus(credentialsId, region, pollParams);

    logger.info('SSM command Response:', response);

    return response;
}

export { executeSSMDocument };
