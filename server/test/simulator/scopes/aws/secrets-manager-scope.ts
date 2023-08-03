// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { SecretsManagerClient, CreateSecretCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import secretManagerResponse from '../../responses/aws/secrets-manager-create.json';

const smMock = mockClient(SecretsManagerClient);

smMock.on(CreateSecretCommand).resolves(secretManagerResponse);
