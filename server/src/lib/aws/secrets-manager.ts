import {
    SecretsManagerClient,
    CreateSecretCommand,
    PutResourcePolicyCommand,
    GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager';
import { getCredentialDetails } from '../cloud-manager/credentials';
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
    } = await getCredentialDetails(credentialsId);

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

async function duplicateSecret(
    credentialsId: string,
    region: string,
    existingSecretName: string,
    duplicateSecretName: string,
    roleArn: string
) {
    logger.info('Duplicate secret:', { credentialsId, region, existingSecretName, duplicateSecretName, roleArn });
    const smClient = await getSecretsManagerClient(credentialsId, region);

    const getResponse = await smClient.send(new GetSecretValueCommand({ SecretId: existingSecretName }));
    logger.info('Get Secrets Manager response:', getResponse);

    const newSecretInput = {
        Name: duplicateSecretName,
        Description: 'WLMDB Secret',
        SecretString: getResponse.SecretString
    };
    const createResponse = await smClient.send(new CreateSecretCommand(newSecretInput));
    logger.info('Create Secrets Manager response:', createResponse);

    const policyResponse = await putResourcePolicy(credentialsId, region, createResponse.ARN!, roleArn);

    return policyResponse;
}

export { getSecretsManagerClient, createSecret, putResourcePolicy, duplicateSecret };
