import { getCloudformationClient, getStacks } from '../../lib/aws/cloud-formation';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function currentCfStacksCount(region: string) {
    logger.info('Fetching non-deleted cloudformation stacks  in region ', region);
    const cloudformationClient = await getCloudformationClient(region);
    const currentStacksCount = (await getStacks(cloudformationClient)).StackSummaries?.length || 0;
    logger.debug('Completed stacks count ', currentStacksCount);
    return { currentStacksCount: currentStacksCount };
}
export { currentCfStacksCount };
