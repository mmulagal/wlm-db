import { SNSClient, ListTopicsCommand } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';
import listTopicResponse from '../../responses/aws/sns-topics.json';

const snsMock = mockClient(SNSClient);

snsMock.on(ListTopicsCommand).resolves(listTopicResponse);
