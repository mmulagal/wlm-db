import { faker } from '@faker-js/faker';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/opentelemetry-scope';
import '../../simulator/scopes/aws/cloud-watch-logs-scope';
import { DEFAULT_AWS_REGION } from '../../utils/consts';
import { getPaginatedCloudwatchLogs } from '../../../src/lib/aws/cloud-watch-logs';

describe('Cloud watch logs lib', () => {
    const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
    it('Get paginated logs', async () => {
        const logs = await getPaginatedCloudwatchLogs(CREDENTIALS_ID, DEFAULT_AWS_REGION, {
            logGroupName: 'test-log-group',
            logStreamName: 'test-log-stream',
            limit: 200
        });

        expect(logs).toEqual(['log message 1log message 2']);
    });
});
