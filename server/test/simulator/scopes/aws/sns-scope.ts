// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { SNSClient, ListTopicsCommand, CreateTopicCommand, SubscribeCommand } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';
import listTopicResponse from '../../responses/aws/sns-topics.json';
import createTopicResponse from '../../responses/aws/create-topic.json';
import subscribeResponse from '../../responses/aws/subscribe-topic.json';
const snsMock = mockClient(SNSClient);

snsMock.on(ListTopicsCommand).resolves(listTopicResponse);
snsMock.on(CreateTopicCommand).resolves(createTopicResponse);
snsMock.on(SubscribeCommand).resolves(subscribeResponse);
