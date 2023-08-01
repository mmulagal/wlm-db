import { listStacks } from '../../lib/aws/cloud-formation';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function currentCfStacksCount(credentialsId: string, region: string) {
    logger.info('Fetching cloudformation stacks in region ', region);
    const currentStacksCount = (await listStacks(credentialsId, region)).StackSummaries?.length;
    logger.debug('Completed stacks count ', currentStacksCount);
    return { currentStacksCount: currentStacksCount };
}

async function createTemplate(credentialsId: string, region: string) {
    logger.info('List Kms keys in a region', { credentialsId, region });

    try {
        // const kmsKeysList = (await listKeys(credentialsId, region)) || [];
        // const keyData = await getKmsKeyDetails(credentialsId, region, kmsKeysList);
        // const totalRecords = keyData?.length;
        // return { keys: keyData, totalRecords };
    } catch (error: any) {
        const errMsg = `Failed to get the kms keys list. ${error.message}`;
        logger.error(errMsg);
        throw createError(error.statusCode || 500, errMsg);
    }
}

export { currentCfStacksCount, createTemplate };
