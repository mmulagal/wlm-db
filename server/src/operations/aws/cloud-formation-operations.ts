import { listStacks } from '../../lib/aws/cloud-formation';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function currentCfStacksCount(credentialsId: string, region: string) {
    logger.info('Fetching cloudformation stacks in region ', region);
    const currentStacksCount = (await listStacks(credentialsId, region)).StackSummaries?.length;
    logger.debug('Completed stacks count ', currentStacksCount);
    return { currentStacksCount: currentStacksCount };
}

export { currentCfStacksCount };
