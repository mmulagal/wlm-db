import { describe, it, expect } from 'vitest';
import ms from 'ms';
import { readPostgresLogsFile, getUniquePostgresErrors } from '../../src/operations/postgres-logs-filtering-operations';

describe('readPostgresLogsFile', () => {
    it('should process valid PGSQL log files and return unique error logs', async () => {
        const logsFilePath = 'Logs/pgsql/error';

        const response = await readPostgresLogsFile(logsFilePath, ms('1d'));

        expect(response.length).toBeGreaterThan(1);
    });

    it('should get unique error logs from the file and their respective count', async () => {
        const logsFilePath = 'Logs/pgsql/error';

        const logs = await readPostgresLogsFile(logsFilePath, ms('1d'));

        const response = await getUniquePostgresErrors(logs);

        expect(response.uniqueErrorLogs).toBeDefined();
    });
});
