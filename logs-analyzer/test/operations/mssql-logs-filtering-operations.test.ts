import { getUniqueErrorAndRespectiveCount, readMsSqlLogsFile } from '../../operations/mssql-logs-filtering-operations';
import ms from 'ms';


describe('readMsSqlLogsFile', () => {
    it('should process valid MSSQL log files and return unique error logs', async () => {
        const logsFilePath = 'Logs/mssql/ERRORLOG';

        const response = await readMsSqlLogsFile(logsFilePath, ms('1d'));

        expect(response.length).toBeGreaterThan(1);
    });

    it('should get unique error logs from the file and their respective count', async () => {  
        const logsFilePath = 'Logs/mssql/ERRORLOG';

        const logs = await readMsSqlLogsFile(logsFilePath, ms('1d'));

        const response = await getUniqueErrorAndRespectiveCount(logs);

        expect(response.uniqueErrorLogs).toBeDefined();
    }
    );
});