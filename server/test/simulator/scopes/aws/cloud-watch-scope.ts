import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { mockClient } from 'aws-sdk-client-mock';

const cloudwatchMock = mockClient(CloudWatchClient);

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'StorageUsed' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Sum: 155104012697.6,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Sum: 155051607517.86667,
            Unit: 'Bytes'
        }
    ]
});

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'StorageEfficiencySavings' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Average: 155104012697.6,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Average: 155051607517.86667,
            Unit: 'Bytes'
        }
    ]
});
//
