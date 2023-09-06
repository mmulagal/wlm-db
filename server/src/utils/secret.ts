import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SECRETS_MANAGER_KEYS, SECRETS } from './consts';
import getLogger from './logger';

const logger = getLogger();

async function readSecretFromSecretManager(name: string) {
    logger.info('Getting secret from secret manager for: ', { name });

    const client = new SecretsManagerClient({
        region: process.env.REGION
    });

    try {
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: process.env.SECRET_NAME,
                VersionStage: 'AWSCURRENT' // VersionStage defaults to AWSCURRENT if unspecified
            })
        );

        logger.debug('Fetched secret values from secret manager');

        const secrets = JSON.parse(response.SecretString || '{}');
        return secrets[name];
    } catch (error) {
        logger.error('Failed to read secrets from secret manager', error);
        return undefined;
    }
}

export default async function initiateSecrets() {
    logger.info('Initiate secrets:');

    await Promise.all(
        Object.keys(SECRETS_MANAGER_KEYS).map(async (secretName: string) => {
            if (!SECRETS[secretName]) {
                const secret = await readSecretFromSecretManager(SECRETS_MANAGER_KEYS[secretName]);
                SECRETS[secretName] = secret;
            }
        })
    );
}
