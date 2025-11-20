import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isEmpty } from 'lodash-es';
import { getUniqueErrorAndRespectiveCount, MsSqlErrorLog, readMsSqlLogsFile } from './mssql-logs-filtering-operations';
import { getUniquePostgresErrors, PostgresLog, readPostgresLogsFile } from './postgres-logs-filtering-operations';
import { fetchAllOracleLogs, getUniqueOracleErrorsAndRespectiveCount } from './oracle-logs-filtering-operations';
import logger from '../utils/logging';
import { DATABASE_TYPE } from '../utils/const';

export default async function collectLogs(
    databaseType: string,
    logsFolderPath: string,
    timestampLastLogProcessed: number,
    logsCount: number,
    databaseInstanceName?: string,
    ec2InstanceId?: string
) {
    logger.debug(`Starting to collect logs from ${logsFolderPath} for database type: ${databaseType}`);

    if (databaseType === DATABASE_TYPE.ORACLE) {
        const logsRecords = await fetchAllOracleLogs({
            databaseInstanceName,
            startTime: timestampLastLogProcessed,
            ec2InstanceId
        });
        return getUniqueOracleErrorsAndRespectiveCount(logsRecords, logsCount);
    }

    const files = readdirSync(logsFolderPath);

    const filteredFiles = files.filter(file => {
        const filePath = join(logsFolderPath, file);
        const stats = statSync(filePath);
        return stats.mtimeMs > timestampLastLogProcessed;
    });

    const filesToProcess = filteredFiles.length > 0 ? filteredFiles : files;

    if (databaseType === DATABASE_TYPE.MSSQL) {
        const logs: MsSqlErrorLog[] = [];
        await Promise.all(
            filesToProcess.map(async file => {
                const filePath = join(logsFolderPath, file);
                if (statSync(filePath).isFile()) {
                    logger.debug(`Processing file: ${filePath}`);
                    const content = await readMsSqlLogsFile(filePath, timestampLastLogProcessed);

                    if (!isEmpty(content)) {
                        logs.push(...content);
                    }
                }
            })
        );

        return getUniqueErrorAndRespectiveCount(logs, logsCount);
    }
    if (databaseType === DATABASE_TYPE.POSTGRESQL) {
        const logs: PostgresLog[] = [];
        await Promise.all(
            filesToProcess.map(async file => {
                const filePath = join(logsFolderPath, file);
                if (statSync(filePath).isFile()) {
                    const content = await readPostgresLogsFile(filePath, timestampLastLogProcessed);
                    if (!isEmpty(content)) {
                        logs.push(...content);
                    }
                }
            })
        );

        return getUniquePostgresErrors(logs, logsCount);
    }
    throw new Error(`Unsupported database type: ${databaseType}`);
}
