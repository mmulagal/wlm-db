import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { mockClient } from 'aws-sdk-client-mock';

const cloudwatchMock = mockClient(CloudWatchClient);

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'StorageUsed' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Sum: 155104012697.1,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Sum: 155051607517.1,
            Unit: 'Bytes'
        }
    ]
});

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'StorageEfficiencySavings' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Average: 155104012697.2,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Average: 155051607517.2,
            Unit: 'Bytes'
        }
    ]
});

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'DeduplicationSavedStorage' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Average: 155104012697.3,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Average: 155051607517.3,
            Unit: 'Bytes'
        }
    ]
});

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'StorageCapacityUtilization' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Average: 155104012697.4,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Average: 155051607517.4,
            Unit: 'Bytes'
        }
    ]
});
