import { faker } from '@faker-js/faker';
import { DEFAULT_AWS_REGION } from '../../utils/consts';
import {
    getPaginatedCloudwatchLogs,
    describeLogGroups,
    putLogGroupRetentionPolicy
} from '../../../src/lib/aws/cloud-watch-logs';

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

    it('Get log groups', async () => {
        const logGroup = await describeLogGroups(CREDENTIALS_ID, DEFAULT_AWS_REGION, 'netapp/wlmdb/ssm-response');
        expect(logGroup?.[0].retentionInDays).toEqual(1);
    });

    // set retention policy to 1 day
    it('Set log group retention policy', async () => {
        const response = await putLogGroupRetentionPolicy(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'netapp/wlmdb/ssm-response',
            1
        );

        expect(response).toBeUndefined();
    });
});
