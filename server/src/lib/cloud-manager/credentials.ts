import { ACCOUNT_ID, CREDENTIALS_ENDPOINT, WORKLOAD_FACTORY_ENDPOINT, HEADERS, USER_TOKEN } from '../../utils/consts';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { getServiceToken } from './tenancy';

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
async function getBxpCredentialDetails(credentialsId: string, accountId?: string) {
    logger.info('Getting Blue XP credential details for ', { credentialsId, accountId });

    const tenancyAccountId = getAsyncLocalStorageResource(ACCOUNT_ID) || accountId;

    const { token } = await getServiceToken();

    return gotInstanceForInternalRequest
        .get(`credentials/accounts/${tenancyAccountId}/credentials/${credentialsId}`, {
            prefixUrl: CREDENTIALS_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: token
            },
            searchParams: {
                getDecrypted: true
            }
        })
        .json<{
            credentials: { accessKey: string; secretKey: string; sessionId: string; expiration: Date };
            extra: { arn: string };
        }>();
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
    return gotInstanceForInternalRequest
        .get(`accounts/${accountId}/credentials/v1/credentials`, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource(USER_TOKEN)
            },
            ...(nextToken && {
                searchParams: {
                    nextToken
                }
            })
        })
        .json<AllWfCredentials>();
}

async function getWfCredentialDetails(credentialsId: string, accountId?: string) {
    logger.info('Getting workload factory credential details for ', { credentialsId, accountId });

    const tenancyAccountId = getAsyncLocalStorageResource(ACCOUNT_ID) || accountId;
    const { token } = await getServiceToken();
    return gotInstanceForInternalRequest
        .get(`accounts/${tenancyAccountId}/credentials/v1/generic/${credentialsId}`, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: token
            },
            searchParams: {
                decrypt: true
            }
        })
        .json<{
            id: string;
            credentials: {
                accessKeyId: string;
                secretAccessKey: string;
                sessionToken: string;
                expiration: string;
            };
            type: string;
            metadata: { name: string; arn: string };
        }>();
}

interface Resource {
    id: string;
    name: string;
    type: string;
}
async function associateResource(credentialsId: string, accountId: string, resources: Array<Resource>) {
    logger.info('Associating resource for credentials', { credentialsId, accountId, resources });

    const tenancyAccountId = getAsyncLocalStorageResource(ACCOUNT_ID) || accountId;
    const { token } = await getServiceToken();
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

export {
    getBxpCredentialDetails,
    getAllBxpCredentials,
    getAllWfCredentials,
    getWfCredentialDetails,
    associateResource
};
