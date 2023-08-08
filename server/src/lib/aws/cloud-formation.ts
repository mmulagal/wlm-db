import {
    CloudFormationClient,
    ListStacksCommand,
    StackStatus,
    CreateStackCommand,
    CreateStackInput,
    Parameter
} from '@aws-sdk/client-cloudformation';
import { getCredentialDetails } from '../cloud-manager/credentials';
import { CAPABILITY_IAM, MASTER_STACK_TIMEOUT_MINUTES } from '../../utils/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getCloudformationClient(credentialsId: string, region: string) {
    logger.debug('Getting cloudFormation client:', { credentialsId, region });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);

    return new CloudFormationClient({ region: region, credentials: { accessKeyId, secretAccessKey, sessionToken } });
}

async function listStacks(credentialsId: string, region: string, stackStatusFilter?: (StackStatus | string)[]) {
    logger.info(`List cloudformation stacks in region ${region} with credentials ${credentialsId}.`);

    const cloudformationClient = await getCloudformationClient(credentialsId, region);
    const resp = await cloudformationClient.send(new ListStacksCommand({ StackStatusFilter: stackStatusFilter }));
    logger.debug('Stacks response', resp);

    return resp;
}

async function createStack(
    credentialsId: string,
    region: string,
    stackName: string,
    templateUrl: string,
    templateParams: Parameter[],
    disableRollback: boolean = true,
    timeoutInMinutes: number = MASTER_STACK_TIMEOUT_MINUTES,
    topicArn: string = ''
) {
    logger.info(
        `Create cloudformation stack ${stackName} for template ${templateUrl} with ${timeoutInMinutes} timeoutInMinutes.`
    );

    const createStackInput: CreateStackInput = {
        StackName: stackName,
        TemplateURL: templateUrl,
        Parameters: templateParams,
        DisableRollback: disableRollback,
        Capabilities: [CAPABILITY_IAM],
        TimeoutInMinutes: timeoutInMinutes,
        NotificationARNs: topicArn ? [topicArn] : []
    };
    const cloudformationClient = await getCloudformationClient(credentialsId, region);
    const resp = await cloudformationClient.send(new CreateStackCommand(createStackInput));
    logger.debug('Create stack response ', resp);

    return resp;
}

export { getCloudformationClient, listStacks, createStack };
