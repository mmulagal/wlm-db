import { createSecret } from '../../lib/aws/secrets-manager';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function createSecrets(
    credentialsId: string,
    region: string,
    secretStringDetails: Array<{ secretName: string; username: string; password: string }>,
    roleArn: string
): Promise<Array<string>> {
    logger.info(`Creating secrets in region ${region} with credentials ${credentialsId}.`);

    const secretNames: Array<string> = [];
    if (secretStringDetails?.length) {
        await Promise.all(
            secretStringDetails.map(async secretString => {
                logger.info(
                    `Creating ${secretString.secretName} secret in region ${region} with credentials ${credentialsId}.`
                );
                try {
                    const resp = await createSecret(
                        credentialsId,
                        region,
                        secretString.secretName,
                        secretString.username,
                        secretString.password,
                        roleArn
                    );
                    logger.debug(`Secret string creation response for ${secretString.secretName}: ${resp}.`);
                    secretNames.push(resp.Name!);
                } catch (error) {
                    logger.error(`Secret string creation failed for ${secretString.secretName}: ${error}.`);
                }
            })
        );
    }
    return secretNames;
}

export { createSecrets };
