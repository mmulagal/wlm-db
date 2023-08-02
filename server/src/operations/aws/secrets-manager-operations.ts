import { createSecret } from '../../lib/aws/secrets-manager';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function createSecrets(
    credentialsId: string,
    region: string,
    secretStringDetails: Array<{ secretName: string; username: string; password: string }>
) {
    logger.info(`Creating secrets in region ${region} with credentials ${credentialsId}.`);
    secretStringDetails.forEach(async secretString => {
        logger.info(
            `Creating ${secretString.secretName} secret in region ${region} with credentials ${credentialsId}.`
        );
        try {
            const resp = await createSecret(
                credentialsId,
                region,
                secretString.secretName,
                secretString.username,
                secretString.password
            );
            logger.debug(`Secret string creation response for ${secretString.secretName}: ${resp}.`);
        } catch (error) {
            logger.error(`Secret string creation failed for ${secretString.secretName}: ${error}.`);
        }
    });
}

export { createSecrets };
