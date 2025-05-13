import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    GetLogEventsCommand,
    PutRetentionPolicyCommand
} from '@aws-sdk/client-cloudwatch-logs';
import { mockClient } from 'aws-sdk-client-mock';
import describeLogGroupsResponse from '../../responses/aws/describe-log-groups.json';

const cloudwatchLogsMock = mockClient(CloudWatchLogsClient);

cloudwatchLogsMock.on(GetLogEventsCommand).resolves({
    events: [{ message: 'log message 1' }, { message: 'log message 2' }]
});
cloudwatchLogsMock.on(DescribeLogGroupsCommand).resolves(describeLogGroupsResponse);

cloudwatchLogsMock.on(PutRetentionPolicyCommand).resolves({});

export default cloudwatchLogsMock;
