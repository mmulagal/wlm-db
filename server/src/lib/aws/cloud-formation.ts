import {
    CloudFormationClient,
    ListStacksCommand,
    StackStatus,
    CreateStackCommand,
    CreateStackInput,
    Parameter
} from '@aws-sdk/client-cloudformation';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getCloudformationClient(credentialsId: string, region: string) {
    logger.debug('Getting cloudFormation client:', { credentialsId, region });
    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    return new CloudFormationClient({ region: region, credentials: { accessKeyId, secretAccessKey, sessionToken } });
}

async function listStacks(cloudformationClient: CloudFormationClient, stackStatusFilter?: (StackStatus | string)[]) {
    logger.info('List cloudformation stacks ');
    const resp = await cloudformationClient.send(new ListStacksCommand({ StackStatusFilter: stackStatusFilter }));
    logger.debug('Stacks response', resp);
    return resp;
}

async function createStack(
    cloudformationClient: CloudFormationClient,
    stackName: string,
    templateUrl: string,
    disableRollback: boolean,
    timeoutInMinutes: number,
    templateParams: Parameter[]
) {
    logger.info(
        `Create cloudformation stack ${stackName} for template ${templateUrl} with ${timeoutInMinutes} timeoutInMinutes.`
    );
    const createStackInput: CreateStackInput = {
        StackName: stackName,
        TemplateURL: templateUrl,
        Parameters: templateParams,
        DisableRollback: disableRollback,
        TimeoutInMinutes: timeoutInMinutes
    };
    const resp = await cloudformationClient.send(new CreateStackCommand(createStackInput));
    logger.debug('Create stack response ', resp);
    return resp;
}

export { getCloudformationClient, listStacks, createStack };
