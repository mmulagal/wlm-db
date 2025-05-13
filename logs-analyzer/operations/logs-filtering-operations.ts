import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getUniqueErrorAndRespectiveCount, MsSqlErrorLog, readMsSqlLogsFile } from './mssql-logs-filtering-operations';
import { getUniquePostgresErrors, PostgresLog, readPostgresLogsFile } from './postgres-logs-filtering-operations';
import { isEmpty } from 'lodash-es';
import logger from '../../logs-analyzer/src/utils/logging';
import { DATABASE_TYPE } from '../utils/const';


export default async function collectLogs(databaseType: string, logsFolderPath: string, timestampLastLogProcessed: number, logsCount: number) {
    logger.debug(`Starting to collect logs from ${logsFolderPath} for database type: ${databaseType}`);

    const files = readdirSync(logsFolderPath);

    const filteredFiles = files.filter(file => {
        const filePath = join(logsFolderPath, file);
        const stats = statSync(filePath);
        return stats.mtimeMs > timestampLastLogProcessed;
    });

    const filesToProcess = filteredFiles.length > 0 ? filteredFiles : files;

    if (databaseType === DATABASE_TYPE.MSSQL) {
        let logs: MsSqlErrorLog[] = [];
        await Promise.all(filesToProcess.map(async file => {
            const filePath = join(logsFolderPath, file);
            if (statSync(filePath).isFile()) {
                logger.debug(`Processing file: ${filePath}`);
                const content = await readMsSqlLogsFile(filePath, timestampLastLogProcessed);

                if (!isEmpty(content)) {
                    logs.push(...content);
                }

                if (logs.length >= logsCount) {
                    logger.debug(`Collected ${logs.length} logs, stopping further processing.`);
                    logs = logs.slice(0, logsCount); // Limit to logsCount
                    logger.debug(`Final logs count: ${logs.length}`);
                    return;
                }
            }
        }));

        return getUniqueErrorAndRespectiveCount(logs);
    } else if (databaseType === DATABASE_TYPE.POSTGRESQL) {
        let logs: PostgresLog[] = [];
        await Promise.all(filesToProcess.map(async file => {
            const filePath = join(logsFolderPath, file);
            if (statSync(filePath).isFile()) {
                const content = await readPostgresLogsFile(filePath, timestampLastLogProcessed);
                if (!isEmpty(content)) {
                    logs.push(...content);
                }

                if (logs.length >= logsCount) {
                    logger.debug(`Collected ${logs.length} logs, stopping further processing.`);
                    logs = logs.slice(0, logsCount); // Limit to logsCount
                    logger.debug(`Final logs count: ${logs.length}`);
                    return;
                }
            }
        }));

        return getUniquePostgresErrors(logs);
    }
    throw new Error(`Unsupported database type: ${databaseType}`);
}

