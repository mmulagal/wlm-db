import collectLogs from '../../operations/logs-filtering-operations';
import { readMsSqlLogsFile } from '../../operations/mssql-logs-filtering-operations';
import { readPostgresLogsFile } from '../../operations/postgres-logs-filtering-operations';
import ms from 'ms';
import { DATABASE_TYPE } from '../../utils/const';

// Add edge case tests and improve test names
describe('collectLogs', () => {
    it('should process MSSQL logs correctly', async () => {
        const logsFolderPath = 'Logs/mssql';
        readMsSqlLogsFile(logsFolderPath, ms('1d'));

        const { uniqueErrorLogs } = await collectLogs(DATABASE_TYPE.MSSQL, logsFolderPath, ms('1d'));


        expect(uniqueErrorLogs).toBeDefined();
    });
    it('should process PostgreSQL logs correctly', async () => {
        const logsFolderPath = 'Logs/pgsql';
        readPostgresLogsFile(logsFolderPath, ms('1d'));

        const { uniqueErrorLogs } = await collectLogs(DATABASE_TYPE.POSTGRESQL, logsFolderPath, ms('1d'));

        expect(uniqueErrorLogs).toBeDefined();
    });
});