import {
    getUniqueErrorAndRespectiveCount,
    readMsSqlLogsFile
} from '../../src/operations/mssql-logs-filtering-operations';

describe('readMsSqlLogsFile', () => {
    it('should process valid MSSQL log files and return unique error logs', async () => {
        const logsFilePath = 'Logs/mssql/ERRORLOG';

        const response = await readMsSqlLogsFile(logsFilePath);

        expect(response.length).toBeGreaterThanOrEqual(1);
    });

    it('should get unique error logs from the file and their respective count', async () => {
        const logsFilePath = 'Logs/mssql/ERRORLOG';

        const logs = await readMsSqlLogsFile(logsFilePath);

        const response = await getUniqueErrorAndRespectiveCount(logs, 100);

        expect(response.uniqueErrorLogs).toBeDefined();
        expect(response.uniqueErrorLogs[0]?.hourlyErrorCounts?.length).toBeGreaterThanOrEqual(1);
    });
});
