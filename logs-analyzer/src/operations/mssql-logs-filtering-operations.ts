import { createReadStream } from 'node:fs';
import { groupBy } from 'lodash-es';
import logger from '../utils/logging';
import { MSSQL_ERROR_PATTERN } from '../utils/const';

interface MsSqlErrorLog {
    timestamp: string;
    spid: string;
    errorCode: string;
    severity: string;
    state: string;
    context: string;
    error: string;
}

async function readMsSqlLogsFile(filePath: string, timestampLastLogProcessed: number = 1): Promise<MsSqlErrorLog[]> { // default to 1 to process all logs
    logger.debug(`Starting to read SQL logs from file: ${filePath}`, { timestampLastLogProcessed });
    const stream = createReadStream(filePath, { encoding: 'utf-8' });

    let buffer = '';
    const errorLogs: MsSqlErrorLog[] = [];

    const errorSet = new Set();
    return new Promise<MsSqlErrorLog[]>((resolve, reject) => {
        stream.on('data', chunk => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            logger.debug(`Processing chunk from file: ${filePath}`);

            const contextLines = 15;

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                line = line.replace(/[^\x20-\x7E]/g, ''); // Remove non-printable characters
                const match = MSSQL_ERROR_PATTERN.exec(line);

                if (timestampLastLogProcessed && match) {
                    const [, errorLogTimestamp] = match;
                    const logTimestamp = new Date(errorLogTimestamp).getTime();
                    if (logTimestamp >= timestampLastLogProcessed) {
                        if (!errorSet.has(line)) {
                            logger.debug(`Error found in file: ${filePath}, line: ${line}`);
                            const [, timestamp, spid, errorCode = '', severity = '', state = ''] = match;
                            const start = Math.max(0, i - contextLines);
                            const end = Math.min(lines.length, i + contextLines + 1);
                            const contextData = lines
                                .slice(start, end)
                                .map(currLine => currLine.replace(/[^\x20-\x7E]/g, ''))
                                .filter(currentLine => {
                                    const contextMatch = MSSQL_ERROR_PATTERN.exec(currentLine);
                                    if (contextMatch) {
                                        const [, contextTimestamp, contextSpid] = contextMatch;
                                        return contextTimestamp === timestamp && contextSpid === spid;
                                    }
                                    return false;
                                });
                            const context = contextData.join('\n');
                            // unshift to push error to the beginning of the array so that the latest error logs are at the top
                            errorLogs.unshift({ timestamp, spid, errorCode, severity, state, context, error: line });
                            // errorLogs.push({ timestamp, spid, errorCode, severity, state, context, error: line });
                            contextData.forEach(item => errorSet.add(item));
                        }
                    }
                }
            }

            // order logs by timestamp
            errorLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        });

        stream.on('end', () => {
            logger.debug(`Finished reading SQL logs from file: ${filePath}`);
            resolve(errorLogs);
        });

        stream.on('error', err => {
            logger.error(`Error reading file: ${filePath}`, err);
            reject(err);
        });
    });
}

async function getUniqueErrorAndRespectiveCount(logs: MsSqlErrorLog[]) {
    logger.debug('Starting to group logs by error code');
    const groupedLogs = groupBy(logs, 'errorCode');
    const uniqueErrorLogs = Object.keys(groupedLogs).map(key => {
        const [{ context: errorContext, error: errorMessage, severity }] = groupedLogs[key];
        return {
            errorContext,
            errorMessage,
            errorCount: groupedLogs[key].length,
            severity
        };
    });
    logger.debug('Finished grouping logs by error code');
    return { uniqueErrorLogs };
}

export { MsSqlErrorLog, readMsSqlLogsFile, getUniqueErrorAndRespectiveCount };
