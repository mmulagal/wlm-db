import { ACCOUNT_ID, CREDENTIALS_ENDPOINT, CredentialsType, HEADERS, USER_TOKEN } from '../../utils/consts';
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

async function getAllAwsCredentials(credentialsType: CredentialsType.AWS) {
    logger.info('Getting all AWS credentials ', credentialsType);
    const accountId = getAsyncLocalStorageResource(ACCOUNT_ID);
    return gotInstanceForInternalRequest
        .get(`credentials/accounts/${accountId}/credentials`, {
            prefixUrl: CREDENTIALS_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN)
            },
            searchParams: {
                credentialsType
            }
        })
        .json<AwsCredentials[]>();
}

async function getCredentialDetails(credentialsId: string) {
    logger.info('Getting credential details for ', credentialsId);
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

export { getCredentialDetails, getAllAwsCredentials };
