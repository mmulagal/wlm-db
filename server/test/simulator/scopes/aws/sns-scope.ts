// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { SNSClient, ListTopicsCommand, CreateTopicCommand, SubscribeCommand } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';
import { faker } from '@faker-js/faker';

const snsMock = mockClient(SNSClient);

snsMock.on(ListTopicsCommand).resolves({
    $metadata: {
        httpStatusCode: 200,
        requestId: '65eee4cc-7d69-5b1d-a36d-b98f8b982e17',
        attempts: 1,
        totalRetryDelay: 0
    },
    Topics: [
        {
            TopicArn: `arn:aws:sns:${faker.string.alpha(10)}:${faker.number.int(12)}:${faker.string.alpha(50)}`
        },
        {
            TopicArn: `arn:aws:sns:${faker.string.alpha(10)}:${faker.number.int(12)}:${faker.string.alpha(50)}`
        }
    ]
});
snsMock.on(CreateTopicCommand).resolves({
    $metadata: {
        httpStatusCode: 200,
        requestId: '7091cfd8-c00c-5cc6-a728-92848bf89d63',
        extendedRequestId: 'undefined',
        cfId: 'undefined',
        attempts: 1,
        totalRetryDelay: 0
    },
    TopicArn: `arn:aws:sns:${faker.string.alpha(10)}:${faker.number.int(12)}:${faker.string.alpha(10)}`
});
snsMock.on(SubscribeCommand).resolves({
    $metadata: {
        httpStatusCode: 200,
        requestId: 'e2915aa8-7a64-5bae-8eba-07f42bcff917',
        extendedRequestId: 'undefined',
        cfId: 'undefined',
        attempts: 1,
        totalRetryDelay: 0
    },
    SubscriptionArn: `arn:aws:sns:${faker.string.alpha(10)}:${faker.number.int(12)}:${faker.string.alpha(
        10
    )}:${faker.string.uuid()}`
});
