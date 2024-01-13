import {
    KMSClient,
    DescribeKeyCommand,
    DescribeKeyRequest,
    ListKeysCommand,
    KeyListEntry,
    ListAliasesCommand,
    ListAliasesRequest,
    AliasListEntry,
    EncryptCommand,
    DecryptCommand,
    EncryptCommandInput,
    DecryptCommandInput
} from '@aws-sdk/client-kms';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';
import { DEFAULT_AWS_REGION } from '../../utils/consts';

const logger = getLogger();
async function getKMS(region: string, credentialsId?: string) {
    logger.debug('Getting KMS client:', region, credentialsId);
    if (!credentialsId) {
        return new KMSClient({ region });
    }
    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new KMSClient({ credentials, region });
}

async function describeKey(credentialsId: string, region: string, params: DescribeKeyRequest) {
    logger.debug('Describe Key', { credentialsId, region, params });

    const kms = await getKMS(region, credentialsId);

    const { KeyMetadata: keyMetaData } = await kms.send(new DescribeKeyCommand(params));
    logger.debug('describeKey response:', keyMetaData);

    return keyMetaData;
}

async function listAliases(
    credentialsId: string,
    region: string,
    params: ListAliasesRequest = {},
    data: Array<AliasListEntry> = [],
    markerId?: string,
    kmsClient?: any
): Promise<Array<AliasListEntry>> {
    logger.debug('List aliases for a key', { credentialsId, region, params, markerId });

    const kms = kmsClient || (await getKMS(region, credentialsId));

    if (markerId) {
        params.Marker = markerId;
    }

    const {
        Aliases: aliases,
        Truncated: truncated,
        NextMarker: nextMarker
    } = await kms.send(new ListAliasesCommand(params));
    if (aliases?.length) {
        for (const item of aliases) {
            data.push(item as AliasListEntry);
        }
    }

    if (truncated) {
        return listAliases(credentialsId, region, params, data, nextMarker, kms);
    }
    logger.debug('list aliases response', data);

    return data;
}

async function listKeys(
    credentialsId: string,
    region: string,
    data: Array<KeyListEntry> = [],
    markerId?: string,
    kmsClient?: KMSClient
): Promise<Array<KeyListEntry>> {
    logger.info('List Kms Keys', {
        credentialsId,
        region,
        data,
        markerId
    });

    const kms = kmsClient || (await getKMS(region, credentialsId));

    const {
        Keys: keys,
        Truncated: truncated,
        NextMarker: nextMarker
    } = markerId ? await kms.send(new ListKeysCommand({ Marker: markerId })) : await kms.send(new ListKeysCommand({}));
    if (keys?.length) {
        for (const item of keys) {
            data.push(item);
        }
    }

    if (truncated) {
        return listKeys(credentialsId, region, data, nextMarker, kms);
    }
    logger.debug('list keys response', data);

    return data;
}

async function encrypt(params: EncryptCommandInput) {
    const kms = await getKMS(DEFAULT_AWS_REGION);
    return kms.send(new EncryptCommand(params));
}

async function decrypt(params: DecryptCommandInput) {
    const kms = await getKMS(DEFAULT_AWS_REGION);
    return kms.send(new DecryptCommand(params));

}

export { describeKey, listKeys, listAliases, encrypt, decrypt };
