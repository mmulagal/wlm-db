import { KeyListEntry } from '@aws-sdk/client-kms';
import createError from 'http-errors';
import { listKeys, describeKey, listAliases } from '../../lib/aws/kms';
import getLogger from '../../utils/logger';

const logger = getLogger();

interface KMS {
    id?: string;
    name?: string;
    origin?: string;
}

async function getKmsKeysList(credentialsId: string, region: string): Promise<{ keys: KMS[] }> {
    logger.info('List Kms keys in a region', { credentialsId, region });

    try {
        const kmsKeysList = (await listKeys(credentialsId, region)) || [];
        const keyData = await getKmsKeyDetails(credentialsId, region, kmsKeysList);
        return { keys: keyData };
    } catch (error: any) {
        const errMsg = `Failed to get the kms keys list. ${error.message}`;
        logger.error(errMsg);
        throw createError(error.statusCode || 500, errMsg);
    }
}

async function getKmsKeyDetails(credentialsId: string, region: string, kmsKeysList: KeyListEntry[]): Promise<KMS[]> {
    const keyData: Array<KMS> = [];
    if (kmsKeysList?.length) {
        await Promise.all(
            kmsKeysList.map(async key => {
                try {
                    const { KeyId: id, KeyArn: arn } = key;
                    const { Origin: origin } = (await describeKey(credentialsId, region, { KeyId: arn })) || {};
                    const [{ AliasName: name } = { AliasName: '-' }] =
                        (await listAliases(credentialsId, region, {
                            KeyId: id
                        })) || [];
                    keyData.push({ id, name, origin });
                } catch (err: any) {
                    logger.error('Failed to get the kms key details', { key, err });
                }
            })
        );
    }
    return keyData;
}

export { getKmsKeysList };
