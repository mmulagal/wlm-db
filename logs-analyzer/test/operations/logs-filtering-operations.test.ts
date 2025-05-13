import collectLogs from '../../operations/logs-filtering-operations';
import ms from 'ms';
import { DATABASE_TYPE } from '../../utils/const';

// Add edge case tests and improve test names
describe('collectLogs', () => {
    it('should process MSSQL logs correctly', async () => {
        const logsFolderPath = 'Logs/mssql';

        const { uniqueErrorLogs } = await collectLogs(DATABASE_TYPE.MSSQL, logsFolderPath, ms('1d'),100);

        expect(uniqueErrorLogs).toBeDefined();
    });
    it('should process PostgreSQL logs correctly', async () => {
        const logsFolderPath = 'Logs/pgsql';
        const { uniqueErrorLogs } = await collectLogs(DATABASE_TYPE.POSTGRESQL, logsFolderPath, ms('1d'),100);
        expect(uniqueErrorLogs).toBeDefined();
    });
});