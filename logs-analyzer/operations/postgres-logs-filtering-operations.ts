import { createReadStream } from 'node:fs';
import { groupBy } from "lodash-es";
import logger from '../../logs-analyzer/src/utils/logging';
import { PGSQL_ERROR_PATTERN } from '../utils/const';


interface PostgresLog {
    timestamp: string;
    processId: string;
    message: string;
    context: string;
    severity: string;
}

async function readPostgresLogsFile(filePath: string, timestampLastLogProcessed: number) {
    logger.info(`Starting to read PostgreSQL logs from file: ${filePath}`, { timestampLastLogProcessed });

    const stream = createReadStream(filePath, { encoding: 'utf-8' });

    let buffer = '';
    const logs: PostgresLog[] = [];

    const logSet = new Set();
    return new Promise<PostgresLog[]>((resolve, reject) => {
        stream.on('data', chunk => {
            buffer += chunk;
            let lines = buffer.split('\n');
            buffer = lines.pop() || '';

            const contextLines = 15;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                line = line.replace(/[^\x20-\x7E]/g, ''); // Remove non-printable characters
                const match = PGSQL_ERROR_PATTERN.exec(line);

                if (timestampLastLogProcessed && match) {
                    const [_, timestamp] = match;
                    const logTimestamp = new Date(timestamp).getTime();
                    if (logTimestamp <= timestampLastLogProcessed) {
                        continue; // Skip logs older than the last processed timestamp
                    }
                }

                if (match) {
                    const [_, timestamp, processId, message] = match;
                    if (!logSet.has(message)) {
                        const start = Math.max(0, i - contextLines);
                        const end = Math.min(lines.length, i + contextLines + 1);
                        const contextData = lines.slice(start, end).map(currLine => currLine.replace(/[^\x20-\x7E]/g, '')).filter((currentLine) => {
                            const contextMatch = PGSQL_ERROR_PATTERN.exec(currentLine);
                            if (contextMatch) {
                                const [_, contextTimestamp, contextProcessId] = contextMatch;
                                return contextTimestamp === timestamp && contextProcessId === processId;
                            }
                            return false;
                        });
                        const context = contextData.join('\n');
                        logs.push({ timestamp, processId, message, context });
                        contextData.forEach(item => logSet.add(item));
                    }
                }
            }
        });

        stream.on('end', () => {
            resolve(logs);
        });

        stream.on('error', err => {
            reject(err);
        });
    });
}

async function getUniquePostgresErrors(logs: PostgresLog[]) {
    logger.debug('Grouping PostgreSQL logs by message');
    const groupedLogs = groupBy(logs, 'message');
    const uniqueErrorLogs = Object.keys(groupedLogs).map(key => {
        return {
            errorContext: groupedLogs[key][0].context,
            errorMessage: groupedLogs[key][0].message,
            errorCount: groupedLogs[key].length,
            severity: groupedLogs[key][0].severity,
        };
    });
    return { uniqueErrorLogs };
}

export {
    PostgresLog,
    readPostgresLogsFile,
    getUniquePostgresErrors
}