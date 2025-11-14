import { faker } from '@faker-js/faker';
import ms from 'ms';
import { getMetricStatistics, getCloudWatchMetrics } from '../../../src/lib/aws/cloud-watch';
import { DEFAULT_AWS_REGION } from '../../utils/consts';

describe('Cloud watch Lib', () => {
    const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
    it('Get metrics statistics command', async () => {
        const resp = await getMetricStatistics(CREDENTIALS_ID, DEFAULT_AWS_REGION, {
            EndTime: new Date(),
            MetricName: 'StorageUsed',
            Namespace: 'AWS/FSx',
            Period: 60, // 1 minute
            StartTime: new Date(Date.now() - ms('1d')),
            Statistics: ['Sum'],
            Dimensions: [
                {
                    Name: 'FileSystemId',
                    Value: 'fs-1234567890abcdef0'
                }
            ]
        });

        expect(resp.Datapoints).toBeDefined();
    });

    it('Get metrics data command', async () => {
        const resp = await getCloudWatchMetrics(CREDENTIALS_ID, DEFAULT_AWS_REGION, {
            EndTime: new Date(),
            MetricDataQueries: [
                {
                    Id: 'cpuused_sum',
                    MetricStat: {
                        Metric: {
                            Namespace: 'netapp/wlmdb/performance',
                            MetricName: 'cpuUsed',
                            Dimensions: [
                                {
                                    Name: 'FileSystemId',
                                    Value: 'fs-1234567890abcdef0'
                                }
                            ]
                        },
                        Period: 600,
                        Stat: 'Sum'
                    },
                    ReturnData: true
                }
            ],
            StartTime: new Date(Date.now() - ms('1d'))
        });

        expect(resp).toBeDefined();
    });
});
