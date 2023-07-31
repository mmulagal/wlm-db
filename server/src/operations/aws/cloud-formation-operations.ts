import { getCloudformationClient, getStacks } from '../../lib/aws/cloud-formation';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function currentCfStacksCount(credentialsId: string, region: string) {
    logger.info('Fetching cloudformation stacks in region ', region);
    const cloudformationClient = await getCloudformationClient(credentialsId, region);
    const currentStacksCount = (await getStacks(cloudformationClient)).StackSummaries?.length || 0;
    logger.debug('Completed stacks count ', currentStacksCount);
    return { currentStacksCount: currentStacksCount };
}
export { currentCfStacksCount };
