import {
    CloudFormationClient,
    ListStacksCommand,
    StackStatus,
    CreateStackCommand,
    CreateStackInput,
    Parameter,
    ListStacksCommandInput
} from '@aws-sdk/client-cloudformation';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import { CAPABILITY_IAM, CAPABILITY_NAMED_IAM, MASTER_STACK_TIMEOUT_MINUTES } from '../../utils/consts';
import getLogger from '../../utils/logger';
import { gotInstanceForExternalRequest } from '../../utils/got';

const logger = getLogger();

async function getCloudformationClient(credentialsId: string, region: string) {
    logger.debug('Getting cloudFormation client:', { credentialsId, region });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId);

    return new CloudFormationClient({ region, credentials: { accessKeyId, secretAccessKey, sessionToken } });
}

async function listStacks(credentialsId: string, region: string, stackStatusFilter?: StackStatus[]) {
    logger.info(`List cloudformation stacks in region ${region} with credentials ${credentialsId}.`);
    const input: ListStacksCommandInput = { StackStatusFilter: stackStatusFilter };
    const cloudformationClient = await getCloudformationClient(credentialsId, region);
    const resp = await cloudformationClient.send(new ListStacksCommand(input));
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
        Capabilities: [CAPABILITY_IAM, CAPABILITY_NAMED_IAM],
        TimeoutInMinutes: timeoutInMinutes,
        NotificationARNs: topicArn ? [topicArn] : []
    };
    const cloudformationClient = await getCloudformationClient(credentialsId, region);
    const resp = await cloudformationClient.send(new CreateStackCommand(createStackInput));
    logger.debug('Create stack response ', resp);

    return resp;
}

async function sendCfnResponse(signedUrl: string, data: object) {
    logger.info('Sending cloud formation acknowledgement ', signedUrl, data);

    return gotInstanceForExternalRequest
        .put(signedUrl, {
            json: data
        })
        .json();
}

export { getCloudformationClient, listStacks, createStack, sendCfnResponse };
