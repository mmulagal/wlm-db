import { CloudWatchLogsClient, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { mockClient } from 'aws-sdk-client-mock';

const cloudwatchLogsMock = mockClient(CloudWatchLogsClient);

cloudwatchLogsMock.on(GetLogEventsCommand).resolves({
    events: [{ message: 'log message 1' }, { message: 'log message 2' }]
});

export default cloudwatchLogsMock;
