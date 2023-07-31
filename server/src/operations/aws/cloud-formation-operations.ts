// import { KeyListEntry } from '@aws-sdk/client-kms';
import createError from 'http-errors';
// import { listKeys } from '../../lib/aws/kms';
import getLogger from '../../utils/logger';

const logger = getLogger();

// interface KMS {
//     id?: string;
//     name?: string;
//     origin?: string;
//     state?: string;
//     expirationDate?: any;
// }

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

export { createTemplate };
