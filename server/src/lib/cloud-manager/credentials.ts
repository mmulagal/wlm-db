import { isEmpty } from 'lodash-es';
import {
    ACCOUNT_ID,
    CREDENTIALS_ENDPOINT,
    WORKLOAD_FACTORY_ENDPOINT,
    HEADERS,
    USER_TOKEN,
    WF_USER_CRED_TYPE,
    BXP_USER_CRED_TYPE
} from '../../utils/consts';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { getBxpServiceToken, getWfServiceToken } from './auth';

const logger = getLogger();

interface Credentials {
    credentialsId: string;
    credentialsType: string;
    isSimulated: boolean;
}

interface AllCredentials extends Credentials {
    extra: {
        name: string;
        externalId?: string;
        arn: string;
    };
}

interface AllWfCredentials {
    items: [
        {
            credentials: string;
            id: string;
            type: string;
            metadata: {
                name: string;
                externalId?: string;
            };
        }
    ];
    nextToken: string;
}

/**
 * Retuns an array of provided credentialsType
 * credentials added to that account by calling SaS credentials API
 * @param credentialsType
 * @returns Array of credentials added to BlueXP
 */
async function getAllBxpCredentials(credentialsType: string): Promise<Array<AllCredentials>> {
    logger.info('Getting all Blue XP credentials for credentials type ', credentialsType);

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
        .json<AllCredentials[]>();
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

interface bxpCredentials {
    credentials: { accessKey: string; secretKey: string; sessionId: string; expiration: Date };
    extra: { arn: string };
}
async function getBxpCredentialDetails(credentialsId: string, accountId?: string) {
    logger.info('Getting Blue XP credential details for ', { credentialsId, accountId });

    if (!process.env.TEST && hasCache(BXP_USER_CRED_TYPE, credentialsId)) {
        return readFromCacheByKey(BXP_USER_CRED_TYPE, credentialsId);
    }

    const tenancyAccountId = getAsyncLocalStorageResource(ACCOUNT_ID) || accountId;

    const { token } = await getBxpServiceToken();

    const response = await gotInstanceForInternalRequest
        .get(`credentials/accounts/${tenancyAccountId}/credentials/${credentialsId}`, {
            prefixUrl: CREDENTIALS_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: token
            },
            searchParams: {
                getDecrypted: true
            }
        })
        .json<bxpCredentials>();

    if (!isEmpty(response?.credentials?.accessKey)) {
        writeToCache(BXP_USER_CRED_TYPE, credentialsId, response);
    }
    return response;
}

/**
 * Retuns an array of provided credentialsType
 * credentials added to that account by calling SaS credentials API
 * @param credentialsType
 * @returns Array of credentials added to BlueXP
 */
async function getAllWfCredentials(credentialsType: string, nextToken?: string): Promise<AllWfCredentials> {
    logger.info('Getting all workload factory credentials for credentials type ', { credentialsType, nextToken });

    const accountId = getAsyncLocalStorageResource(ACCOUNT_ID);

    let authToken;
    let isDemo = false;
    // In Demo credential service is using the user token itself to make the api call, not the service token
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        isDemo = true;
        credentialsType = credentialsType.toUpperCase();
        authToken = getAsyncLocalStorageResource(USER_TOKEN) as string;
    } else {
        const { token } = await getWfServiceToken();
        authToken = token as string;
    }

    const filterString = encodeURIComponent(`type eq '${credentialsType}'`);

    return gotInstanceForInternalRequest
        .get(`accounts/${accountId}/credentials/v1/credentials?filter=${filterString}`, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: authToken,
                ...(isDemo && { [HEADERS.SIMULATOR]: 'true' })
            },
            ...(nextToken && {
                searchParams: {
                    nextToken
                }
            })
        })
        .json<AllWfCredentials>();
}

interface wfCredentials {
    id: string;
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken: string;
        expiration: string;
    };
    type: string;
    metadata: { name: string; arn: string };
}
async function getWfCredentialDetails(credentialsId: string, accountId?: string) {
    logger.info('Getting workload factory credential details for ', { credentialsId, accountId });

    if (!process.env.TEST && hasCache(WF_USER_CRED_TYPE, credentialsId)) {
        return readFromCacheByKey(WF_USER_CRED_TYPE, credentialsId);
    }

    const tenancyAccountId = getAsyncLocalStorageResource(ACCOUNT_ID) || accountId;
    const { token } = await getWfServiceToken();

    const response = await gotInstanceForInternalRequest
        .get(`accounts/${tenancyAccountId}/credentials/v1/generic/${credentialsId}`, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: token
            },
            searchParams: {
                decrypt: true
            }
        })
        .json<wfCredentials>();
    if (!isEmpty(response?.credentials?.accessKeyId)) {
        writeToCache(WF_USER_CRED_TYPE, credentialsId, response);
    }
    return response;
}

interface Resource {
    id: string;
    name: string;
    type: string;
}
async function associateResource(credentialsId: string, accountId: string, resources: Array<Resource>) {
    logger.info('Associating resource for credentials', { credentialsId, accountId, resources });

    const tenancyAccountId = getAsyncLocalStorageResource(ACCOUNT_ID) || accountId;
    const { token } = await getWfServiceToken();
    return gotInstanceForInternalRequest
        .post(`accounts/${tenancyAccountId}/credentials/v1/associations`, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: token
            },
            json: {
                credentials: credentialsId,
                resources
            }
        })
        .json<{
            credentials: string;
            resources: [Resource];
        }>();
}

async function createAwsCredential(
    accountId: string,
    token: string,
    arn: string,
    externalId: string,
    credentialsName: string
) {
    return gotInstanceForInternalRequest
        .post(`accounts/${accountId}/credentials/v1/aws/assume-role`, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: token,
                [HEADERS.SIMULATOR]: 'true'
            },
            json: {
                arn,
                name: credentialsName,
                externalId,
                accountType: 'STANDARD',
                metadata: { policy: { fsx: 'automate', databases: true } }
            }
        })
        .json<{
            credentialsId: string;
        }>();
}

export {
    wfCredentials,
    bxpCredentials,
    getBxpCredentialDetails,
    getAllBxpCredentials,
    getAllWfCredentials,
    getWfCredentialDetails,
    associateResource,
    createAwsCredential
};
