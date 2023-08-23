import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SECRETS_MANAGER_KEYS, SECRETS } from '../utils/consts';
import getLogger from '../utils/logger';

const logger = getLogger();

async function readSecretFromSecretManager(name?: string, isDefault?: boolean, secretId?: string, region?: string) {
    logger.info('Getting secret from secret manager for: ', { name, isDefault, secretId, region });

    const client = new SecretsManagerClient({
        region: region || process.env.REGION
    });

    try {
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: secretId || process.env.SECRET_NAME,
                VersionStage: 'AWSCURRENT' // VersionStage defaults to AWSCURRENT if unspecified
            })
        );

        logger.debug('Fetched secret values from secret manager', response);
        const secrets = JSON.parse(response.SecretString || '{}');
        return secrets;
    } catch (error) {
        logger.error('Failed to read secrets from secret manager', error);
        return undefined;
    }
}

async function initiateSecrets() {
    logger.info('Initiate secrets:');
    await Promise.all(
        Object.keys(SECRETS_MANAGER_KEYS).map(async (secretName: string) => {
            if (!SECRETS[secretName]) {
                const secret = await readSecretFromSecretManager(SECRETS_MANAGER_KEYS[secretName], true);
                SECRETS[secretName] = secret;
            }
        })
    );
}

export { initiateSecrets, readSecretFromSecretManager };
