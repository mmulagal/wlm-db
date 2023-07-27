// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// @ts-nocheck
import { KMSClient, ListKeysCommand, DescribeKeyCommand, ListAliasesCommand } from '@aws-sdk/client-kms';
import { mockClient } from 'aws-sdk-client-mock';
import listKeysResponse from '../../responses/aws/list-keys.json';
import describeKeyResponse from '../../responses/aws/describe-key.json';
import listKeyAliasesResponse from '../../responses/aws/list-key-aliases.json';

const kmsMock = mockClient(KMSClient);

kmsMock.on(DescribeKeyCommand).resolves(describeKeyResponse);

kmsMock.on(ListKeysCommand).resolves(listKeysResponse);

kmsMock.on(ListAliasesCommand).resolves(listKeyAliasesResponse);
