import moment from 'moment';
import { KeyListEntry } from '@aws-sdk/client-kms';
import { listKeys, describeKey, listAliases, encrypt, decrypt } from '../../lib/aws/kms';
import { AWS_FSX, CloudProviders, KMS_KEY_ALIAS } from '../../utils/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

interface KMS {
    id?: string;
    name?: string;
    origin?: string;
    state?: string;
    expirationDate?: any;
    isDefault?: boolean;
    formattedDate?: string;
}

async function getFsxKmsKeysList(credentialsId: string, region: string): Promise<{ keys: KMS[] }> {
    logger.info('List FSX Kms keys in a region', { credentialsId, region });

    const kmsKeysList = (await listKeys(credentialsId, region)) || [];
    const keyData = await getKmsKeyDetails(credentialsId, region, kmsKeysList, AWS_FSX);

    return { keys: keyData };
}

async function getKmsKeyDetails(
    credentialsId: string,
    region: string,
    kmsKeysList: KeyListEntry[],
    serviceType: string
): Promise<KMS[]> {
    logger.debug('Get Kms key details', { credentialsId, region, kmsKeysList, serviceType });

    const keyData: Array<KMS> = [];
    if (kmsKeysList?.length) {
        await Promise.all(
            kmsKeysList.map(async key => {
                try {
                    const { KeyId: id } = key;
                    const {
                        Origin: origin,
                        KeyState: state,
                        DeletionDate: expirationDate,
                        KeyManager: keyManager
                    } = (await describeKey(credentialsId, region, { KeyId: id })) || {};
                    const [{ AliasName: name } = { AliasName: '-' }] =
                        (await listAliases(credentialsId, region, {
                            KeyId: id
                        })) || [];
                    const aliasName = name?.replace('alias/', '');
                    // kms key state can be in enabled | disabled | pending deletion. If its in pending deletion means keys are set to expire in aws console. By using that state we can say its gonna expire soon. To know what is the date its going to expire,
                    // we have the expirationDate in date format & formatted date in human readable format to understand.
                    // We dont have to do any calculation to find out the keys are expiring or not since any days between 7 to 30 can be set as deletion date in aws console noted as the state of pending deletion.
                    if (
                        (keyManager === CloudProviders.AWS && aliasName?.includes(serviceType)) ||
                        keyManager !== CloudProviders.AWS
                    ) {
                        keyData.push({
                            id,
                            name: aliasName,
                            origin,
                            expirationDate,
                            state,
                            isDefault: aliasName === serviceType,
                            ...(expirationDate && { formattedDate: moment(expirationDate).format('MMMM DD,YYYY') })
                        });
                    }
                } catch (err: any) {
                    logger.error('Failed to get the kms key details', { key, err });
                }
            })
        );
    }

    return keyData;
}

async function encryptString(textToEncrypt: string) {
    logger.info('Encrypt a string');
    logger.debug({ textToEncrypt });

    const plaintext = Buffer.from(textToEncrypt);
    const encryptParams = { KeyId: KMS_KEY_ALIAS, Plaintext: plaintext };
    const { CiphertextBlob: cipherText } = await encrypt(encryptParams);
    if (cipherText) {
        return Buffer.from(cipherText).toString('base64');
    }
}

async function decryptString(encryptedText: string) {
    logger.info('Decrypt a string', { encryptedText });

    const cipherText = Buffer.from(encryptedText, 'base64');
    const decryptParams = { KeyId: KMS_KEY_ALIAS, CiphertextBlob: cipherText };

    const { Plaintext: plaintext } = await decrypt(decryptParams);
    if (plaintext) {
        return String.fromCharCode.apply(null, Array.from(new Uint8Array(plaintext)));
    }
}

export { getFsxKmsKeysList, encryptString, decryptString };
