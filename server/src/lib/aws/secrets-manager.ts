import { SecretsManagerClient, CreateSecretCommand, PutResourcePolicyCommand } from '@aws-sdk/client-secrets-manager';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import getLogger from '../../utils/logger';

const logger = getLogger();

const SECRETS_POLICY = (rolearn: string) => `{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "${rolearn}"
            },
            "Action": ["secretsmanager:GetSecretValue"],
            "Resource": "*"
        }
    ]
}`;

async function getSecretsManagerClient(credentialsId: string, region: string) {
    logger.debug('Getting SecretsManager client:', { credentialsId, region });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId);

    return new SecretsManagerClient({ region, credentials: { accessKeyId, secretAccessKey, sessionToken } });
}

async function putResourcePolicy(credentialsId: string, region: string, secretId: string, roleArn: string) {
    logger.info(
        `Create Secrets Manager resource policy for ${secretId} in region ${region} with credentials ${credentialsId}.`
    );
    const secretsManagerClient = await getSecretsManagerClient(credentialsId, region);
    const resp = await secretsManagerClient.send(
        new PutResourcePolicyCommand({
            SecretId: secretId,
            ResourcePolicy: SECRETS_POLICY(roleArn)
        })
    );
    logger.debug('Create Secrets Manager Policy response', resp);
    return resp;
}

async function createSecret(
    credentialsId: string,
    region: string,
    secretName: string,
    username: string,
    password: string,
    roleArn: string
) {
    logger.info('Create Secrets Manager String');
    const secretsManagerClient = await getSecretsManagerClient(credentialsId, region);
    const secretString = { username, password };
    const resp = await secretsManagerClient.send(
        new CreateSecretCommand({ Name: secretName, SecretString: JSON.stringify(secretString) })
    );
    logger.debug('Create Secrets Manager response', resp);
    await putResourcePolicy(credentialsId, region, resp.ARN!, roleArn);
    return resp;
}

export { getSecretsManagerClient, createSecret, putResourcePolicy };
