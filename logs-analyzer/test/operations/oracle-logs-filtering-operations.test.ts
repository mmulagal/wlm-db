import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readOracleLogsFile, getUniqueOracleErrorsAndRespectiveCount } from '../../src/operations/oracle-logs-filtering-operations';

describe('Oracle logs filtering operations', () => {
    const logsDir = join(__dirname, '../../Logs/oracle');

    // Skip tests if Oracle logs directory doesn't exist
    const shouldSkip = !existsSync(logsDir);

    it.skipIf(shouldSkip)('should process valid Oracle log files and return unique error logs', async () => {
        const logsFilePath = 'Logs/oracle/alert_test.log';
        const timestampLastLogProcessed = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

        const logs = await readOracleLogsFile(logsFilePath, timestampLastLogProcessed);
        expect(logs).toBeDefined();
        expect(Array.isArray(logs)).toBe(true);
    });

    it.skipIf(shouldSkip)('should get unique Oracle errors and respective counts', async () => {
        const logsFilePath = 'Logs/oracle/alert_test.log';
        const timestampLastLogProcessed = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

        const logs = await readOracleLogsFile(logsFilePath, timestampLastLogProcessed);
        const { uniqueErrorLogs } = getUniqueOracleErrorsAndRespectiveCount(logs, 100);

        expect(uniqueErrorLogs).toBeDefined();
        expect(Array.isArray(uniqueErrorLogs)).toBe(true);

        // Each unique error should have required properties
        uniqueErrorLogs.forEach(errorLog => {
            expect(errorLog.error).toBeDefined();
            expect(errorLog.context).toBeDefined();
            expect(errorLog.count).toBeGreaterThan(0);
            expect(errorLog.uniqueErrorKey).toBeDefined();
        });
    });

    it('should handle empty Oracle logs gracefully', async () => {
        const { uniqueErrorLogs } = getUniqueOracleErrorsAndRespectiveCount([], 100);
        expect(uniqueErrorLogs).toEqual([]);
    });

    it('should extract Oracle error codes correctly', async () => {
        const mockLogs = [
            {
                timestamp: '2025-05-22T21:30:31.658+00:00',
                severity: 'ERROR',
                pid: '2113324',
                sqlid: '',
                module: 'oraclesan2',
                code: '35782660',
                message: 'ORA-00001: unique constraint (SCHEMA.PK_TABLE) violated',
                context: 'ORA-00001: unique constraint (SCHEMA.PK_TABLE) violated\nCause: INSERT or UPDATE attempted to violate constraint',
                filePath: '/path/to/log',
                lineNumber: 1
            }
        ];

        const { uniqueErrorLogs } = getUniqueOracleErrorsAndRespectiveCount(mockLogs, 100);

        expect(uniqueErrorLogs).toHaveLength(1);
        expect(uniqueErrorLogs[0].errorCode).toBe('ORA-00001');
        expect(uniqueErrorLogs[0].error).toBe('ORA-00001: unique constraint (SCHEMA.PK_TABLE) violated');
    });
});
