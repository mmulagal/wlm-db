import { createReadStream } from 'node:fs';
import { groupBy } from 'lodash-es';
import logger from '../utils/logging';
import { PGSQL_ERROR_PATTERN } from '../utils/const';

interface PostgresLog {
    timestamp: string;
    processId: string;
    message: string;
    context: string;
    severity: string;
}

async function readPostgresLogsFile(filePath: string, timestampLastLogProcessed: number = 1): Promise<PostgresLog[]> {
    // default to 1 to process all logs
    logger.info(`Starting to read PostgreSQL logs from file: ${filePath}`, { timestampLastLogProcessed });

    const stream = createReadStream(filePath, { encoding: 'utf-8' });

    let buffer = '';
    const logs: PostgresLog[] = [];

    const logSet = new Set();
    return new Promise<PostgresLog[]>((resolve, reject) => {
        stream.on('data', chunk => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            const contextLines = 15;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                line = line.replace(/[^\x20-\x7E]/g, ''); // Remove non-printable characters
                const match = PGSQL_ERROR_PATTERN.exec(line);

                if (timestampLastLogProcessed && match) {
                    const [, errorLogTimestamp] = match;
                    const logTimestamp = new Date(errorLogTimestamp).getTime();
                    if (logTimestamp >= timestampLastLogProcessed) {
                        const [, timestamp, processId, severity, message] = match;
                        if (!logSet.has(message)) {
                            const start = Math.max(0, i - contextLines);
                            const end = Math.min(lines.length, i + contextLines + 1);
                            const contextData = lines
                                .slice(start, end)
                                .map(currLine => currLine.replace(/[^\x20-\x7E]/g, ''))
                                .filter(currentLine => {
                                    const contextMatch = PGSQL_ERROR_PATTERN.exec(currentLine);
                                    if (contextMatch) {
                                        const [, contextTimestamp, contextProcessId] = contextMatch;
                                        return contextTimestamp === timestamp && contextProcessId === processId;
                                    }
                                    return false;
                                });
                            const context = contextData.join('\n');
                            logs.unshift({ timestamp, processId, message, context, severity });
                            contextData.forEach(item => logSet.add(item));
                        }
                    }
                }
            }
            // sort the logs by timestamp in descending order
            logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        });

        stream.on('end', () => {
            resolve(logs);
        });

        stream.on('error', err => {
            reject(err);
        });
    });
}

async function getUniquePostgresErrors(logs: PostgresLog[], uniqueLogsCountToConsider: number) {
    logger.debug('Grouping PostgreSQL logs by message');
    const groupedLogs = groupBy(logs, 'message');
    const uniqueErrorLogs = Object.keys(groupedLogs)
        .slice(0, uniqueLogsCountToConsider)
        .map(key => {
            const [{ context, message, severity }] = groupedLogs[key];
            return {
                context,
                error: message,
                count: groupedLogs[key].length,
                severity
            };
        });
    return { uniqueErrorLogs };
}

export { PostgresLog, readPostgresLogsFile, getUniquePostgresErrors };
