// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { SNSClient, ListTopicsCommand } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';
import listTopicResponse from '../../responses/aws/sns-topics.json';

const snsMock = mockClient(SNSClient);

snsMock.on(ListTopicsCommand).resolves(listTopicResponse);
