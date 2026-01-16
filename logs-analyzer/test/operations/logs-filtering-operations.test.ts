import ms from 'ms';
import { describe, it, expect } from 'vitest';
import collectLogs from '../../src/operations/logs-filtering-operations';
import { DATABASE_TYPE } from '../../src/utils/const';

// Add edge case tests and improve test names
describe('collectLogs', () => {
    it('should process MSSQL logs correctly', async () => {
        const logsFolderPath = 'SampleLogs/mssql';

        const { uniqueErrorLogs } = await collectLogs(DATABASE_TYPE.MSSQL, logsFolderPath, ms('1d'), ms('10h'), 100);

        expect(uniqueErrorLogs).toBeDefined();
    });

    it('should process PostgreSQL logs correctly', async () => {
        const logsFolderPath = 'SampleLogs/pgsql';
        const { uniqueErrorLogs } = await collectLogs(DATABASE_TYPE.POSTGRESQL, logsFolderPath, ms('1d'), ms('10h'), 100);
        expect(uniqueErrorLogs).toBeDefined();
    });

    it('should process Oracle logs correctly', async () => {
        const logsFolderPath = 'SampleLogs/oracle';
        const { uniqueErrorLogs } = await collectLogs(DATABASE_TYPE.ORACLE, logsFolderPath, ms('1d'), ms('10h'), 100);
        expect(uniqueErrorLogs).toBeDefined();
    });

    it('should throw error for unsupported database type', async () => {
        const logsFolderPath = 'SampleLogs/oracle';
        await expect(collectLogs('unsupported', logsFolderPath, ms('1d'), ms('10h'), 100)).rejects.toThrow(
            'Unsupported database type: unsupported'
        );
    });
});
