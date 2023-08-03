import { SecretsManagerClient, CreateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getSecretsManagerClient(credentialsId: string, region: string) {
    logger.debug('Getting SecretsManager client:', { credentialsId, region });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);

    return new SecretsManagerClient({ region: region, credentials: { accessKeyId, secretAccessKey, sessionToken } });
}

async function createSecret(
    secretManagerClient: SecretsManagerClient,
    secretName: string,
    username: string,
    password: string
) {
    logger.info('Create Secrets Manager String');

    const secretString = { username: username, password: password };
    const resp = await secretManagerClient.send(
        new CreateSecretCommand({ Name: secretName, SecretString: JSON.stringify(secretString) })
    );
    logger.debug('Create Secrets Manager response', resp);

    return resp;
}

export { getSecretsManagerClient, createSecret };
