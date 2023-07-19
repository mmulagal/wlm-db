import {
    ACCOUNT_ID,
    CREDENTIALS_ENDPOINT,
    CredentialsType,
    HEADERS,
    USER_TOKEN
} from '../../utils/consts';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';

const logger = getLogger();

interface Credentials {
    credentialsId: string;
    credentialsType: string;
    isSimulated: boolean;
}


interface AwsCredentials extends Credentials {
    extra: {
        name: string;
        externalId?: string;
        arn: string;
    };
}

/**
 * Takes accountId as parameter and retuns an array of aws assume role
 * credentials added to that account by calling SaS credentials API
 * @param accountId 
 * @returns Array of credentials added to BlueXP
 */
export async function getAllAwsCredentials(accountId:string) {
    logger.info("Getting all AWS credentials ", CredentialsType.AWS)
    return gotInstanceForInternalRequest
        .get(`credentials/accounts/${accountId}/credentials`, {
            prefixUrl: CREDENTIALS_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN)
            },
            searchParams: {
                credentialsType: CredentialsType.AWS
            }
        })
        .json<AwsCredentials[]>();      
}

/**
 * Takes credentials as parameter and returns credntial keys by calling 
 * SaS credentials API
 * @param credentialsId 
 * @returns credentials: 
 * { accessKey: string; 
 *  secretKey: string; 
 *  sessionId: string;
 *  expiration: Date } 
 */
export async function getCredentialDetails(credentialsId: string) {
    logger.info("Getting credential details for ", credentialsId)
    const accountId = getAsyncLocalStorageResource(ACCOUNT_ID);
    return gotInstanceForInternalRequest
        .get(`credentials/accounts/${accountId}/credentials/${credentialsId}`, {
            prefixUrl: CREDENTIALS_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN)
            },
            searchParams: {
                getDecrypted: true
            }
        })
        .json<{ credentials: { accessKey: string; secretKey: string; sessionId: string; expiration: Date } }>();
}
