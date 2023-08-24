// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { faker } from '@faker-js/faker';
import { KMSClient, ListKeysCommand, DescribeKeyCommand, ListAliasesCommand } from '@aws-sdk/client-kms';
import { mockClient } from 'aws-sdk-client-mock';

const keyArn = `${faker.string.alphanumeric(20)}`;
const keyId = `${faker.string.alphanumeric(20)}`;
const accountId = `${faker.string.numeric(12)}`;

const listKeysResponse = {
    KeyCount: 2,
    Keys: [
        {
            KeyArn: keyArn,
            KeyId: keyId
        },
        {
            KeyArn: keyArn,
            KeyId: keyId
        }
    ]
};

const listKeyAliasesResponse = {
    Aliases: [
        {
            AliasArn: keyArn,
            AliasName: 'alias/nviet-openlab-key6',
            TargetKeyId: keyId
        }
    ],
    Truncated: false
};

const describeKeyResponse = {
    KeyMetadata: {
        AWSAccountId: accountId,
        Arn: keyArn,
        CustomerMasterKeySpec: 'SYMMETRIC_DEFAULT',
        Description: 'sathish-openLab',
        Enabled: true,
        EncryptionAlgorithms: ['SYMMETRIC_DEFAULT'],
        KeyId: keyId,
        KeyManager: 'CUSTOMER',
        KeySpec: 'SYMMETRIC_DEFAULT',
        KeyState: 'Enabled',
        KeyUsage: 'ENCRYPT_DECRYPT',
        MultiRegion: false,
        Origin: 'AWS_KMS'
    }
};

const kmsMock = mockClient(KMSClient);

kmsMock.on(DescribeKeyCommand).resolves(describeKeyResponse);

kmsMock.on(ListKeysCommand).resolves(listKeysResponse);

kmsMock.on(ListAliasesCommand).resolves(listKeyAliasesResponse);
