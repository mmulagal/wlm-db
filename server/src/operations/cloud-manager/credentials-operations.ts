import { getAllCredentials } from '../../lib/cloud-manager/credentials';
import { CredentialsResponseType } from '../../routes/types/credentials.types';
import getLogger from '../../utils/logger';

const logger = getLogger();

/**
 * Returns array of aws assume role
 * credentials added to the account
 */
async function getCredentials(credentialsType: string): Promise<CredentialsResponseType> {
    logger.info('Getting credentials ', credentialsType);

    const data = await getAllCredentials(credentialsType);
    return data.map(({ credentialsId, extra: { name, arn } }) => ({
        credentialsId,
        name,
        arn,
        providerAccountId: arn.match(/\d+/)?.[0] || ''
    }));
}

export { getCredentials };
