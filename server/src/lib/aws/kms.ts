import {
    KMSClient,
    DescribeKeyCommand,
    DescribeKeyRequest,
    ListKeysCommand,
    KeyListEntry,
    ListAliasesCommand,
    ListAliasesRequest,
    AliasListEntry
} from '@aws-sdk/client-kms';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();
async function getKMS(region: string, credentialsId: string) {
    logger.debug('Getting KMS client:', region, credentialsId);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new KMSClient({ credentials, region });
}

async function describeKey(credentialsId: string, region: string, params: DescribeKeyRequest) {
    logger.info('Describe Key', { credentialsId, region, params });

    const kms = await getKMS(region, credentialsId);

    const { KeyMetadata: keyMetaData } = await kms.send(new DescribeKeyCommand(params));
    logger.debug('describeKey response:', keyMetaData);

    return keyMetaData;
}

async function listAliases(
    credentialsId: string,
    region: string,
    params: ListAliasesRequest = {},
    data: AliasListEntry[] = [],
    markerId: string | undefined = undefined
) {
    logger.info('List aliases for a key', { credentialsId, region, params, markerId });

    const kms = await getKMS(region, credentialsId);

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
            data.push(item);
        }
    }

    if (truncated) {
        return listAliases(credentialsId, region, params, data, nextMarker);
    }
    logger.debug('list aliases response', data);
    return data;
}

async function listKeys(
    credentialsId: string,
    region: string,
    data: KeyListEntry[] = [],
    markerId: string | undefined = undefined
) {
    logger.info('List Kms Keys', {
        credentialsId,
        region,
        data,
        markerId
    });

    const kms = await getKMS(region, credentialsId);

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
        return listKeys(credentialsId, region, data, nextMarker);
    }
    logger.debug('list keys response', data);
    return data;
}

export { describeKey, listKeys, listAliases };
