import createError from 'http-errors';
import {
    getAllBxpCredentials,
    getAllWfCredentials,
    getBxpCredentialDetails,
    getWfCredentialDetails
} from '../../lib/cloud-manager/credentials';
import { CredentialsResponseType } from '../../routes/types/credentials.types';
import { getAsyncLocalStorageResource } from '../../utils/async-local-storage';
import { WF, HEADERS, BXP } from '../../utils/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

interface WorkloadFactoryCredentials {
    credentials: string;
    id: string;
    type: string;
    metadata: {
        name: string;
        externalId?: string;
    };
}
async function getAllCredentialsRecursive(
    credentialsType: string,
    credentialsList: WorkloadFactoryCredentials[] = [],
    cursor?: string
): Promise<WorkloadFactoryCredentials[]> {
    const { items, nextToken } = await getAllWfCredentials(credentialsType, cursor);
    credentialsList.push(...items);
    if (nextToken) {
        cursor = nextToken;
        return getAllCredentialsRecursive(credentialsType, credentialsList, nextToken);
    }

    return credentialsList;
}

/**
 * Returns array of aws assume role
 * credentials added to the account
 */
async function getCredentials(credentialsType: string): Promise<CredentialsResponseType> {
    logger.info('Getting credentials ', credentialsType);
    if (getAsyncLocalStorageResource(HEADERS.REFERER) === WF) {
        const credentialsList = await getAllCredentialsRecursive(credentialsType);
        return credentialsList.map(({ id, credentials, metadata: { name } }) => ({
            credentialsId: id,
            name,
            arn: credentials,
            providerAccountId: credentials.match(/\d+/)?.[0] || ''
        }));
    }
    const data = await getAllBxpCredentials(credentialsType);
    return data.map(({ credentialsId, extra: { name, arn } }) => ({
        credentialsId,
        name,
        arn,
        providerAccountId: arn.match(/\d+/)?.[0] || ''
    }));
}

async function getRoleDetails(credentialsId: string) {
    logger.debug('Getting role details:', credentialsId);
    if (getAsyncLocalStorageResource(HEADERS.REFERER) === WF) {
        const { metadata } = await getWfCredentialDetails(credentialsId);
        return {
            roleName: metadata.arn.match(/role\/(.*)/)?.[1] || '',
            roleArn: metadata.arn,
            providerAccountId: metadata.arn.match(/\d+/)?.[0] || ''
        };
    }
    const data = await getBxpCredentialDetails(credentialsId);
    return {
        roleName: data.extra.arn.match(/role\/(.*)/)?.[1] || '',
        roleArn: data.extra.arn,
        providerAccountId: data.extra.arn.match(/\d+/)?.[0] || ''
    };
}

async function lookupCredentials(credentialsId: string) {
    logger.debug('Looking up credentials:', credentialsId);
    try {
        const {
            credentials: { accessKeyId, secretAccessKey, sessionToken }
        } = await getWfCredentialDetails(credentialsId);

        return {
            source: WF,
            credentials: {
                accessKey: accessKeyId,
                secretKey: secretAccessKey,
                sessionId: sessionToken
            }
        };
    } catch (error) {
        try {
            const { credentials, extra } = await getBxpCredentialDetails(credentialsId);
            return {
                source: BXP,
                credentials,
                extra
            };
        } catch (err) {
            const errMsg = `Failed to fetch credentials. ${err}`;
            logger.error(errMsg);
            throw createError(400, errMsg);
        }
    }
}

async function getCredentialsDetails(credentialsId: string, accountId?: string) {
    logger.debug('Getting credentials details:', { credentialsId, accountId });

    return lookupCredentials(credentialsId);

    /* the below logic tries to look up credentials based on the referer header, keeping it until a decision is made if new credentials service can handle both blue xp and new creds */
    // if (isEmpty(getAsyncLocalStorageResource(HEADERS.REFERER)) && !process.env.TEST) {
    // in case of background processes trying to fetch credentials, doing a lookup in new and old credentials service

    // }
    // if (getAsyncLocalStorageResource(HEADERS.REFERER) === WF) {
    //     const {
    //         credentials: { accessKeyId, secretAccessKey, sessionToken }
    //     } = await getWfCredentialDetails(credentialsId, accountId);

    //     return {
    //         credentials: {
    //             accessKey: accessKeyId,
    //             secretKey: secretAccessKey,
    //             sessionId: sessionToken
    //         }
    //     };
    // }
    // return getBxpCredentialDetails(credentialsId);
}
export { lookupCredentials, getCredentials, getRoleDetails, getCredentialsDetails };
