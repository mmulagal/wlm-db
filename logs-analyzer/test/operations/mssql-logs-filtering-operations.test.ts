import {
    getUniqueErrorAndRespectiveCount,
    readMsSqlLogsFile
} from '../../src/operations/mssql-logs-filtering-operations';

describe('readMsSqlLogsFile', () => {
    it('should process valid MSSQL log files and return unique error logs', async () => {
        const logsFilePath = 'Logs/mssql/ERRORLOG';

        const response = await readMsSqlLogsFile(logsFilePath);

        expect(response.length).toBeGreaterThan(1);
    });

    it('should get unique error logs from the file and their respective count', async () => {
        const logsFilePath = 'Logs/mssql/ERRORLOG';

        const logs = await readMsSqlLogsFile(logsFilePath);

        const response = await getUniqueErrorAndRespectiveCount(logs);

        expect(response.uniqueErrorLogs).toBeDefined();
    });
});
