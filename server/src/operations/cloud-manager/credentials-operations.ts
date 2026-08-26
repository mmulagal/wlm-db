import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { getAllWfCredentials, getWfCredentialDetails, wfCredentials } from '../../lib/cloud-manager/credentials';
import { CredentialsResponseType } from '../../routes/types/credentials.types';
import getLogger from '../../utils/logger';
import { derivePropertiesFromARN, IS_DEMO_FLOW } from '../../utils/utils';

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
    const credentialsList = await getAllCredentialsRecursive(credentialsType);
    return credentialsList
        .filter(el => el?.credentials)
        .map(({ id, credentials, metadata: { name } }) => ({
            credentialsId: id,
            name,
            arn: credentials,
            providerAccountId: credentials.match(/\d+/)?.[0] || ''
        }));
}

async function getRoleDetails(credentialsId: string) {
    logger.debug('Getting role details:', credentialsId);
    const { metadata } = await getCredentialsDetails(credentialsId);

    return {
        roleName: metadata?.arn?.match(/role\/(.*)/)?.[1] || '',
        roleArn: metadata?.arn,
        providerAccountId: metadata?.arn.match(/\d+/)?.[0] || ''
    };
}

async function getCredentialsDetails(credentialsId: string, accountId?: string) {
    logger.debug('Getting credentials details:', { credentialsId, accountId });
    if (isEmpty(credentialsId)) {
        throw new Error('Credentials id is invalid');
    }
    try {
        const {
            credentials: { accessKeyId, secretAccessKey, sessionToken },
            metadata
        } = (await getWfCredentialDetails(credentialsId, accountId, IS_DEMO_FLOW)) as wfCredentials;

        return {
            credentials: {
                accessKey: accessKeyId,
                secretKey: secretAccessKey,
                sessionId: sessionToken
            },
            metadata
        };
    } catch (error) {
        const errMsg = `Failed to fetch credentials. ${error}`;
        logger.error(errMsg);
        throw createError(400, errMsg);
    }
}

async function resolveAwsAccountIdFromCredentials(
    credentialsId: string,
    accountId?: string
): Promise<string | undefined> {
    const { metadata: { arn } = {} } = await getCredentialsDetails(credentialsId, accountId);
    const { awsAccountId } = derivePropertiesFromARN(arn ?? '') ?? {};
    return awsAccountId;
}

export { getCredentials, getRoleDetails, getCredentialsDetails, resolveAwsAccountIdFromCredentials };
