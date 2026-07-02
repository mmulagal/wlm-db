import { CloudWatchClient, GetMetricStatisticsCommand, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { mockClient } from 'aws-sdk-client-mock';
import { CLOUD_WATCH_METRICS_RESPONSE } from '../../../utils/consts';

const cloudwatchMock = mockClient(CloudWatchClient);

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'StorageUsed' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Average: 34634657054784,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Average: 34634657054784,
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

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'CPUUtilization' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Maximum: 9895604649984,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Maximum: 9895604649984,
            Unit: 'Bytes'
        }
    ]
});

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'NetworkIn' }).resolves({
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

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'NetworkOut' }).resolves({
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

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'VolumeReadBytes' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Sum: 9895604649984,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Sum: 9895604649984,
            Unit: 'Bytes'
        }
    ]
});

cloudwatchMock.on(GetMetricStatisticsCommand, { MetricName: 'VolumeWriteBytes' }).resolves({
    Datapoints: [
        {
            Timestamp: new Date(),
            Sum: 9895604649984,
            Unit: 'Bytes'
        },
        {
            Timestamp: new Date(),
            Sum: 9895604649984,
            Unit: 'Bytes'
        }
    ]
});

cloudwatchMock.on(GetMetricDataCommand).resolves(CLOUD_WATCH_METRICS_RESPONSE);
