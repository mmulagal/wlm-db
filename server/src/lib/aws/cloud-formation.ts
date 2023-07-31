import { CloudFormationClient, ListStacksCommand, StackStatus } from '@aws-sdk/client-cloudformation';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getCloudformationClient(region: string) {
    logger.debug('Getting cloudFormation client:', region);
    return new CloudFormationClient({ region: region });
}

async function getStacks(cloudformationClient: CloudFormationClient, stackStatusFilter?: (StackStatus | string)[]) {
    logger.info('Get cloudformation stacks ');
    const resp = await cloudformationClient.send(new ListStacksCommand({ StackStatusFilter: stackStatusFilter }));
    logger.debug('Stacks response', resp);
    return resp;
}

export { getCloudformationClient, getStacks };
