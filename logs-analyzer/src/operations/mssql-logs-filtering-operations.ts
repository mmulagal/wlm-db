import { createReadStream } from 'node:fs';
import { groupBy, isEmpty } from 'lodash-es';
import logger from '../utils/logging';
import { MSSQL_ERROR_PATTERN, MSSQL_SEVERITY_THRESHOLD } from '../utils/const';
import { generateHash } from '../utils/utils';

interface MsSqlErrorLog {
    timestamp: string;
    spid: string;
    errorCode: string;
    severity: string;
    state: string;
    context: string;
    error: string;
}
async function readMsSqlLogsFile(filePath: string, timestampLastLogProcessed: number = 1): Promise<MsSqlErrorLog[]> {
    // default to 1 to process all logs
    logger.debug(`Starting to read SQL logs from file: ${filePath}`, { timestampLastLogProcessed });
    const stream = createReadStream(filePath, { encoding: 'utf-8' });

    let buffer = '';
    const errorLogs: MsSqlErrorLog[] = [];
    const linesToIgnore = new Set();
    const errorSet = new Set();
    return new Promise<MsSqlErrorLog[]>((resolve, reject) => {
        let pendingEntries: string[] = [];
        stream.on('data', chunk => {
            buffer += chunk;
            let lines = buffer.split('\n');
            buffer = lines.pop() || '';

            // while streaming, errors occurring towards end of buffer may not contain the complete error context. So, we need to concatenate pending entries with the current lines
            if (pendingEntries.length > 0) {
                lines = pendingEntries.concat(lines);
                pendingEntries = [];
            }

            logger.debug(`Processing chunk from file: ${filePath}`);

            const contextLines = 15;

            processErrorLogLines(
                lines,
                timestampLastLogProcessed,
                errorSet,
                contextLines,
                pendingEntries,
                linesToIgnore,
                errorLogs
            );
        });

        stream.on('end', () => {
            if (pendingEntries.length > 0) {
                processErrorLogLines(
                    pendingEntries,
                    timestampLastLogProcessed,
                    errorSet,
                    0,
                    pendingEntries,
                    linesToIgnore,
                    errorLogs
                );
            }
            logger.debug(`Finished reading SQL logs from file: ${filePath}`);
            resolve(errorLogs);
        });

        stream.on('error', err => {
            logger.error(`Error reading file: ${filePath}`, err);
            reject(err);
        });
    });
}

function processErrorLogLines(
    lines: string[],
    timestampLastLogProcessed: number,
    errorSet: Set<unknown>,
    contextLines: number,
    pendingEntries: string[],
    linesToIgnore: Set<unknown>,
    errorLogs: MsSqlErrorLog[]
) {
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        line = line.replace(/[^\x20-\x7E]/g, ''); // Remove non-printable characters
        const match = MSSQL_ERROR_PATTERN.exec(line);

        if (timestampLastLogProcessed && match?.groups) {
            const [, errorLogTimestamp] = match;
            const logTimestamp = new Date(errorLogTimestamp).getTime();
            if (logTimestamp >= timestampLastLogProcessed && !errorSet.has(line)) {
                const { timestamp, spid, errorCode, severity, state } = match.groups;
                const contextLimit = i + contextLines;
                const start = Math.max(0, i - contextLines);
                const end = Math.min(lines.length, contextLimit);

                if (contextLimit > lines.length) {
                    // if the error is towards the end of the file, we need to store it in pendingEntries so that we can process with the next chunk
                    pendingEntries.push(line);
                } else {
                    const contextData = lines
                        .slice(start, end)
                        .map(currLine => currLine.replace(/[^\x20-\x7E]/g, ''))
                        .filter(currentLine => currentLine.startsWith(timestamp) && currentLine.includes(spid));
                    if (
                        (severity && Number(severity) >= MSSQL_SEVERITY_THRESHOLD) ||
                        (isEmpty(severity) && !linesToIgnore.has(line))
                    ) {
                        const context = contextData.join('\n');
                        // unshift to push error to the beginning of the array so that the latest error logs are at the top
                        errorLogs.unshift({
                            timestamp,
                            spid,
                            errorCode,
                            severity,
                            state,
                            context,
                            error: line
                        });
                        contextData.forEach(item => errorSet.add(item));
                    } else {
                        // remove associated lines with timestamp and spid as that of the error with severity less than the threshold
                        contextData.forEach(item => linesToIgnore.add(item));
                    }
                }
            }
        }
    }
    // order logs by timestamp
    errorLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function getUniqueErrorAndRespectiveCount(logs: MsSqlErrorLog[], uniqueLogsCountToConsider: number) {
    logger.debug('Starting to group logs by error code', { uniqueLogsCountToConsider });
    logs.forEach(log => {
        if (!log.errorCode || isEmpty(log.errorCode)) {
            const match = MSSQL_ERROR_PATTERN.exec(log.error);
            if (match?.groups) {
                const { message } = match.groups;
                const dummyErrorCode = generateHash(message);
                log.errorCode = `${dummyErrorCode}-dummy`;
            }
        }
    });

    const groupedLogs = groupBy(logs, 'errorCode');

    const uniqueErrorLogs = Object.keys(groupedLogs)
        .slice(0, uniqueLogsCountToConsider)
        .map(key => {
            const logsForError = groupedLogs[key];
            const logsByHour: { [hour: string]: number } = {};
            logsForError.forEach(log => {
                if (log.timestamp) {
                    const date = new Date(log.timestamp);
                    // Set to start of the hour
                    date.setMinutes(0, 0, 0);
                    const hourKey = date.getTime(); // Milliseconds since epoch at the start of the hour
                    logsByHour[hourKey] = (logsByHour[hourKey] || 0) + 1;
                }
            });

            const hourlyErrorCounts = Object.entries(logsByHour)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([hour, count]) => ({ hour: Number(hour), count }));

            const [{ context, error, severity }] = logsForError;
            return {
                uniqueErrorKey: key,
                error,
                context,
                count: groupedLogs[key].length,
                firstOccurrence: groupedLogs[key]?.[0]?.timestamp
                    ? new Date(groupedLogs[key][0].timestamp).getTime()
                    : undefined,
                lastOccurrence:
                    Array.isArray(groupedLogs[key]) &&
                    groupedLogs[key].length > 0 &&
                    groupedLogs[key][groupedLogs[key].length - 1]?.timestamp
                        ? new Date(groupedLogs[key][groupedLogs[key].length - 1].timestamp).getTime()
                        : undefined,
                severity,
                hourlyErrorCounts,
                errorCode: !key.includes('-dummy') ? key : undefined // If the key contains '-dummy', it means it's a generated error code for internal grouping above, so we can set it to undefined
            };
        });
    logger.debug('Finished grouping logs by error code');
    return { uniqueErrorLogs };
}

export { MsSqlErrorLog, readMsSqlLogsFile, getUniqueErrorAndRespectiveCount };
