// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { faker } from '@faker-js/faker';
import {
    KMSClient,
    ListKeysCommand,
    DescribeKeyCommand,
    ListAliasesCommand,
    EncryptCommand,
    DecryptCommand
} from '@aws-sdk/client-kms';
import { mockClient } from 'aws-sdk-client-mock';

const keyArnAwsManagedFsx = `${faker.string.alphanumeric(20)}`;
const keyIdAwsManagedFsx = `${faker.string.alphanumeric(20)}`;
const keyArnAwsManagedEbs = `${faker.string.alphanumeric(20)}`;
const keyIdAwsManagedEbs = `${faker.string.alphanumeric(20)}`;
const keyArnCustomerManaged = `${faker.string.alphanumeric(20)}`;
const keyIdCustomerManaged = `${faker.string.alphanumeric(20)}`;
const accountId = `${faker.string.numeric(12)}`;

const listKeysResponse = {
    KeyCount: 3,
    Keys: [
        {
            KeyArn: keyArnAwsManagedFsx,
            KeyId: keyIdAwsManagedFsx
        },
        {
            KeyArn: keyArnCustomerManaged,
            KeyId: keyIdCustomerManaged
        },
        {
            KeyArn: keyArnAwsManagedEbs,
            KeyId: keyIdAwsManagedEbs
        }
    ]
};

const encryptResponse = {
    CiphertextBlob: Uint8Array.from([
        1, 2, 2, 0, 120, 119, 19, 139, 241, 225, 102, 117, 148, 116, 212, 85, 156, 251, 223, 113, 89, 146, 109, 19, 220,
        86, 187, 183, 92, 24, 119, 43, 181, 238, 119, 137, 41, 1, 105, 62, 117, 153, 137, 126, 137, 16, 214, 206, 44,
        148, 144, 249, 91, 100, 0, 0, 0, 111, 48, 109, 6, 9, 42, 134, 72, 134, 247, 13, 1, 7, 6, 160, 96, 48, 94, 2, 1,
        0, 48, 89, 6, 9, 42, 134, 72, 134, 247, 13, 1, 7, 1, 48, 30, 6, 9, 96, 134, 72, 1, 101, 3, 4, 1, 46, 48, 17, 4,
        12, 142, 124, 172, 198, 127, 152, 23, 102, 85, 105, 95, 175, 2, 1, 16, 128, 44, 119, 64, 212, 133, 202, 114,
        208, 95, 117, 210, 238, 55, 80, 229, 88, 132, 165, 12, 214, 186, 34, 159, 221, 86, 0, 59, 79, 70, 185, 127, 96,
        147, 234, 247, 137, 201, 25, 177, 123, 238, 97, 92, 77, 102
    ]),
    EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
    KeyId: 'arn:aws:kms:us-west-2:111122223333:key/1234abcd-12ab-34cd-56ef-1234567890ab'
};

const decryptResponse = {
    EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
    KeyId: 'arn:aws:kms:us-west-2:111122223333:key/1234abcd-12ab-34cd-56ef-1234567890ab',
    Plaintext: Uint8Array.from([72, 101, 108, 108, 111, 33, 32, 101, 110, 99, 114, 121, 112, 116, 32, 109, 101])
};

const kmsMock = mockClient(KMSClient);

kmsMock
    .on(DescribeKeyCommand, {
        KeyId: keyIdAwsManagedFsx
    })
    .resolves({
        KeyMetadata: {
            AWSAccountId: accountId,
            Arn: keyArnAwsManagedFsx,
            CustomerMasterKeySpec: 'SYMMETRIC_DEFAULT',
            Description: 'wlmdb-openLab',
            Enabled: true,
            EncryptionAlgorithms: ['SYMMETRIC_DEFAULT'],
            KeyId: keyIdAwsManagedFsx,
            KeyManager: 'AWS',
            KeySpec: 'SYMMETRIC_DEFAULT',
            KeyState: 'Enabled',
            KeyUsage: 'ENCRYPT_DECRYPT',
            MultiRegion: false,
            Origin: 'AWS_KMS'
        }
    })
    .on(DescribeKeyCommand, {
        KeyId: keyIdCustomerManaged
    })
    .resolves({
        KeyMetadata: {
            AWSAccountId: accountId,
            Arn: keyArnAwsManagedFsx,
            CustomerMasterKeySpec: 'SYMMETRIC_DEFAULT',
            Description: 'wlmdb-openLab',
            Enabled: true,
            EncryptionAlgorithms: ['SYMMETRIC_DEFAULT'],
            KeyId: keyIdCustomerManaged,
            KeyManager: 'CUSTOMER',
            KeySpec: 'SYMMETRIC_DEFAULT',
            KeyState: 'Enabled',
            KeyUsage: 'ENCRYPT_DECRYPT',
            MultiRegion: false,
            Origin: 'AWS_KMS'
        }
    })
    .on(DescribeKeyCommand, {
        KeyId: keyIdAwsManagedEbs
    })
    .resolves({
        KeyMetadata: {
            AWSAccountId: accountId,
            Arn: keyArnAwsManagedFsx,
            CustomerMasterKeySpec: 'SYMMETRIC_DEFAULT',
            Description: 'wlmdb-openLab',
            Enabled: true,
            EncryptionAlgorithms: ['SYMMETRIC_DEFAULT'],
            KeyId: keyIdAwsManagedEbs,
            KeyManager: 'AWS',
            KeySpec: 'SYMMETRIC_DEFAULT',
            KeyState: 'Enabled',
            KeyUsage: 'ENCRYPT_DECRYPT',
            MultiRegion: false,
            Origin: 'AWS_KMS'
        }
    })
    .on(DescribeKeyCommand)
    .resolves({
        KeyMetadata: {
            AWSAccountId: accountId,
            Arn: keyArnAwsManagedFsx,
            CustomerMasterKeySpec: 'SYMMETRIC_DEFAULT',
            Description: 'wlmdb-openLab',
            Enabled: true,
            EncryptionAlgorithms: ['SYMMETRIC_DEFAULT'],
            KeyId: keyIdAwsManagedFsx,
            KeyManager: 'AWS',
            KeySpec: 'SYMMETRIC_DEFAULT',
            KeyState: 'Enabled',
            KeyUsage: 'ENCRYPT_DECRYPT',
            MultiRegion: false,
            Origin: 'AWS_KMS'
        }
    });

kmsMock.on(ListKeysCommand).resolves(listKeysResponse);

kmsMock
    .on(ListAliasesCommand, {
        KeyId: keyIdAwsManagedFsx
    })
    .resolves({
        Aliases: [
            {
                AliasArn: keyArnAwsManagedFsx,
                AliasName: 'aws/fsx',
                TargetKeyId: keyIdAwsManagedFsx
            }
        ],
        Truncated: false
    })
    .on(ListAliasesCommand, {
        KeyId: keyIdCustomerManaged
    })
    .resolves({
        Aliases: [
            {
                AliasArn: keyArnCustomerManaged,
                AliasName: 'cust-demo-key',
                TargetKeyId: keyIdCustomerManaged
            }
        ],
        Truncated: false
    })
    .on(ListAliasesCommand, {
        KeyId: keyIdAwsManagedEbs
    })
    .resolves({
        Aliases: [
            {
                AliasArn: keyArnAwsManagedEbs,
                AliasName: 'aws/ebs',
                TargetKeyId: keyIdAwsManagedEbs
            }
        ],
        Truncated: false
    })
    .on(ListAliasesCommand)
    .resolves({
        Aliases: [
            {
                AliasArn: keyArnAwsManagedFsx,
                AliasName: 'aws/fsx',
                TargetKeyId: keyIdAwsManagedFsx
            }
        ],
        Truncated: false
    });

kmsMock.on(EncryptCommand).resolves(encryptResponse);

kmsMock.on(DecryptCommand).resolves(decryptResponse);
