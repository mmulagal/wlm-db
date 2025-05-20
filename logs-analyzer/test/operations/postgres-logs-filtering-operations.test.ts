import { describe, it, expect } from 'vitest';
import ms from 'ms';
import { readPostgresLogsFile, getUniquePostgresErrors } from '../../src/operations/postgres-logs-filtering-operations';

beforeAll(() => {
    // Create a dummy PostgreSQL error logs file for testing
    const fs = require('fs');
    const path = require('path');
    const logsDir = path.join(__dirname, '../../Logs/pgsql');
    const logsFilePath = path.join(logsDir, 'error');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    // Current date in yyyy-mm-dd format
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const dummyLog = `${todayStr} 12:00:00.000 UTC [12345] ERROR:  relation \"nonexistent_table\" does not exist at character 15\n${todayStr} 12:01:00.000 UTC [12346] ERROR:  division by zero\n2025-05-20 12:02:00.000 UTC [12347] ERROR:  syntax error at or near \"SELECT\"`;
    fs.writeFileSync(logsFilePath, dummyLog, 'utf-8');
});

describe('readPostgresLogsFile', () => {
    it('should process valid PGSQL log files and return unique error logs', async () => {
        const logsFilePath = 'Logs/pgsql/error';

        const response = await readPostgresLogsFile(logsFilePath, Date.now() - ms('1d'));

        expect(response.length).toBeGreaterThan(1);
    });

    it('should get unique error logs from the file and their respective count', async () => {
        const logsFilePath = 'Logs/pgsql/error';

        const logs = await readPostgresLogsFile(logsFilePath, Date.now() - ms('1d'));

        const response = await getUniquePostgresErrors(logs);

        expect(response.uniqueErrorLogs).toBeDefined();
    });
});
