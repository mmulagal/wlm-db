import {
    setLogGroupRetentionPolicy,
    cloudWatchLogsLogger
} from '../../../src/operations/aws/cloud-watch-logs-operations';
import { CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../utils/consts';

describe('setLogGroupRetentionPolicy', () => {
    const LOG_GROUP_NAME = 'netapp/wlmdb/ssm-response';
    const RETENTION_IN_DAYS = 7;

    const loggerMockInfo = vi.spyOn(cloudWatchLogsLogger, 'info').mockImplementation(() => undefined);
    const loggerMockWarn = vi.spyOn(cloudWatchLogsLogger, 'warn').mockImplementation(() => undefined);

    afterAll(() => {
        loggerMockInfo.mockReset();
        loggerMockWarn.mockReset();
    });

    it('should set the log group retention policy', async () => {
        const response = await setLogGroupRetentionPolicy(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            LOG_GROUP_NAME,
            RETENTION_IN_DAYS
        );
        expect(response).toBeUndefined();
        expect(loggerMockInfo).toHaveBeenLastCalledWith(
            `Retention policy updated to ${RETENTION_IN_DAYS} days for log group "${LOG_GROUP_NAME}"`
        );
    });

    it('should handle non-existent log group gracefully', async () => {
        const response = await setLogGroupRetentionPolicy(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'non-existent-log-group',
            RETENTION_IN_DAYS
        );
        expect(response).toBeUndefined();
        expect(loggerMockWarn).toHaveBeenLastCalledWith('Log group "non-existent-log-group" does not exist.');
    });

    it('should handle invalid retention days gracefully', async () => {
        const response = await setLogGroupRetentionPolicy(CREDENTIALS_ID, DEFAULT_AWS_REGION, LOG_GROUP_NAME, -1);
        expect(response).toBeUndefined();
        expect(loggerMockInfo).toHaveBeenLastCalledWith(
            `Retention policy is invalid or already set to ${-1} days. No update needed`
        );
    });
});
