import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { mockClient } from 'aws-sdk-client-mock';

const cloudwatchMock = mockClient(CloudWatchClient);

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'StorageUsed' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Sum: 19791209299968,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Sum: 19791209299968,
            Unit: 'Bytes'
        }
    ]
});

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'StorageEfficiencySavings' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Average: 9895604649984,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Average: 9895604649984,
            Unit: 'Bytes'
        }
    ]
});

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'DeduplicationSavedStorage' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Average: 9895604649984,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Average: 9895604649984,
            Unit: 'Bytes'
        }
    ]
});

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'StorageCapacityUtilization' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Average: 9895604649984,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Average: 9895604649984,
            Unit: 'Bytes'
        }
    ]
});
