// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
    SecretsManagerClient,
    CreateSecretCommand,
    GetSecretValueCommand,
    PutResourcePolicyCommand
} from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import secretManagerResponse from '../../responses/aws/secrets-manager-create.json';
import secretManagerGetSecretValueResponse from '../../responses/aws/secrets-manager-get.json';
import secretManagerPolicyResponse from '../../responses/aws/secrets-manager-create-policy.json';
const smMock = mockClient(SecretsManagerClient);

smMock.on(CreateSecretCommand).resolves(secretManagerResponse);
smMock.on(GetSecretValueCommand).resolves(secretManagerGetSecretValueResponse);
smMock.on(PutResourcePolicyCommand).resolves(secretManagerPolicyResponse);
