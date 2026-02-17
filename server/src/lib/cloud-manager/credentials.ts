import { isEmpty } from 'lodash-es';
import { ACCOUNT_ID, WORKLOAD_FACTORY_ENDPOINT, HEADERS, USER_TOKEN, WF_USER_CRED_TYPE } from '../../utils/consts';
import { IS_DEMO_FLOW } from '../../utils/utils';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import { gotInstanceForInternalRequest } from '../../utils/got';
import getLogger from '../../utils/logger';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache';
import { getWfServiceToken } from './auth';

const logger = getLogger();
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
 * @param includeInvalid - Optional flag to include invalid credentials (default: false for AWS_ASSUME_ROLE)
 * @returns Array of credentials added to BlueXP
 */
async function getAllWfCredentials(
    credentialsType: string,
    nextToken?: string,
    includeInvalid = false
): Promise<AllWfCredentials> {
    logger.info('Getting all workload factory credentials for credentials type ', {
        credentialsType,
        nextToken,
        includeInvalid
    });

    const accountId = getAsyncLocalStorageResource(ACCOUNT_ID);

    let authToken;
    // In Demo credential service is using the user token itself to make the api call, not the service token
    if (IS_DEMO_FLOW) {
        credentialsType = credentialsType.toUpperCase();
        authToken = getAsyncLocalStorageResource(USER_TOKEN) as string;
    } else {
        const { token } = await getWfServiceToken();
        authToken = token as string;
    }

    // Build filter string: always filter by type, and exclude invalid credentials by default for AWS_ASSUME_ROLE
    let filterString = `type eq '${credentialsType}'`;
    if (!includeInvalid) {
        filterString += ' and invalid eq false';
    }
    filterString = encodeURIComponent(filterString);

    return gotInstanceForInternalRequest
        .get(`accounts/${accountId}/credentials/v1/credentials?filter=${filterString}`, {
            prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
            headers: {
                [HEADERS.AUTHORIZATION]: authToken,
                ...(IS_DEMO_FLOW && { [HEADERS.SIMULATOR]: 'true' })
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
    logger.debug('Getting workload factory credential details for ', { credentialsId, accountId });

    if (!process.env.TEST && hasCache(WF_USER_CRED_TYPE, credentialsId)) {
        return readFromCacheByKey(WF_USER_CRED_TYPE, credentialsId);
    }

    const tenancyAccountId = getAsyncLocalStorageResource(ACCOUNT_ID) || accountId;
    if (!tenancyAccountId && !process.env.TEST) {
        throw new Error(`Account ID is required to fetch credential details for credentials id: ${credentialsId}`);
    }
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
    credentialsName: string,
    accountType: string
) {
    try {
        return await gotInstanceForInternalRequest
            .post(`accounts/${accountId}/credentials/v1/aws/assume-role`, {
                prefixUrl: WORKLOAD_FACTORY_ENDPOINT,
                headers: {
                    [HEADERS.AUTHORIZATION]: token,
                    ...(IS_DEMO_FLOW && { [HEADERS.SIMULATOR]: 'true' })
                },
                json: {
                    arn,
                    name: credentialsName,
                    externalId,
                    accountType,
                    metadata: {
                        policy: {
                            fsx: 'automate',
                            databases: 'automate',
                            vmware: false
                        }
                    }
                }
            })
            .json<{
                credentialsId: string;
            }>();
    } catch (error) {
        logger.info('error creating credential', error);
    }
}

export { wfCredentials, getAllWfCredentials, getWfCredentialDetails, associateResource, createAwsCredential };
