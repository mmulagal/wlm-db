import { faker } from '@faker-js/faker';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/cloud-watch-scope';
import '../../simulator/scopes/opentelemetry-scope';
import ms from 'ms';
import getMetricStatistics from '../../../src/lib/aws/cloud-watch';
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
});
