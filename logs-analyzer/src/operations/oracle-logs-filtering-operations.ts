import { createReadStream } from 'node:fs';
import { groupBy, isEmpty } from 'lodash-es';
import logger from '../utils/logging';
import { ORACLE_ERROR_PATTERN, ORACLE_SEVERITY_LEVELS } from '../utils/const';
import {
    containsErrorKeywords,
    generateHash,
    getSqlplusScriptForOracle,
    runSqlPlusScript,
    safeParseJson
} from '../utils/utils';

interface OracleErrorLog {
    timestamp: string;
    severity: string;
    pid?: string;
    sqlid?: string;
    module?: string;
    code?: string;
    message: string;
    context: string;
    filePath?: string;
    lineNumber?: number;
}
interface PaginationOptions {
    limit?: number;
    offset?: number;
    startTime?: string;
}

interface OracleLogRecord {
    timestamp: string;
    messageText: string;
    messageType: string;
    messageLevel: string;
}

interface PaginationResult {
    data: OracleLogRecord[];
    pagination: {
        totalRecords: number;
        limit: number;
        offset: number;
        hasMore: string;
    };
}

interface OracleUniqueErrorLog {
    error: string;
    context: string;
    cause?: string;
    count: number;
    severity?: string;
    firstOccurrence?: number;
    lastOccurrence?: number;
    errorCode?: string;
    uniqueErrorKey?: string;
    hourlyErrorCounts?: Array<{
        hour: number;
        count: number;
    }>;
}

async function readOracleLogsFile(filePath: string, timestampLastLogProcessed: number = 1): Promise<OracleErrorLog[]> {
    // default to 1 to process all logs
    logger.debug(`Starting to read Oracle logs from file: ${filePath}`, { timestampLastLogProcessed });
    const stream = createReadStream(filePath, { encoding: 'utf-8' });

    let buffer = '';
    const errorLogs: OracleErrorLog[] = [];
    const linesToIgnore = new Set();
    const errorSet = new Set();

    return new Promise<OracleErrorLog[]>((resolve, reject) => {
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

            processOracleErrorLogLines(
                lines,
                timestampLastLogProcessed,
                errorSet,
                pendingEntries,
                linesToIgnore,
                errorLogs
            );
        });

        stream.on('end', () => {
            if (pendingEntries.length > 0) {
                processOracleErrorLogLines(
                    pendingEntries,
                    timestampLastLogProcessed,
                    errorSet,
                    pendingEntries,
                    linesToIgnore,
                    errorLogs,
                    true
                );
            }
            logger.debug(`Finished reading Oracle logs from file: ${filePath}`);
            resolve(errorLogs);
        });

        stream.on('error', err => {
            logger.error(`Error reading file: ${filePath}`, err);
            reject(err);
        });
    });
}

const getOracleLogsScript = (pagination: PaginationOptions = {}) => {
    const { limit = 5000, offset = 0, startTime } = pagination;

    return getTimeBasedQuery(startTime, undefined, limit, offset);
};

function getTimeBasedQuery(startTime?: string, endTime?: string, limit: number = 5000, offset: number = 0) {
    return `
        WITH paginated_logs AS (
            SELECT  l.*,
                ROW_NUMBER() OVER (ORDER BY l.originating_timestamp DESC) AS rn,
                COUNT(*)    OVER ()                                      AS total_count
            FROM    v$diag_alert_ext l
            WHERE l.originating_timestamp >= ${
                startTime
                    ? `(timestamp '1970-01-01 00:00:00' + numtodsinterval(${startTime}/1000,'SECOND') )`
                    : 'SYSDATE - 1'
            }
            ORDER BY l.originating_timestamp DESC
            OFFSET ${offset} ROWS 
            FETCH NEXT ${limit} ROWS ONLY
        )
        SELECT JSON_OBJECT(
            'data' VALUE JSON_ARRAYAGG(
                    JSON_OBJECT(
                        'timestamp'    VALUE TO_CHAR(originating_timestamp),
                        /* protect long text */
                        'messageText'  VALUE UTL_URL.ESCAPE(message_text),
                        'messageType'  VALUE CASE message_type
                                                WHEN 1 THEN 'UNKNOWN'
                                                WHEN 2 THEN 'INCIDENT_ERROR'
                                                WHEN 3 THEN 'ERROR'
                                                WHEN 4 THEN 'WARNING'
                                                WHEN 5 THEN 'NOTIFICATION'
                                                WHEN 6 THEN 'TRACE'
                                                ELSE 'UNKNOWN'
                                                END,
                        'messageLevel' VALUE CASE message_level
                                                WHEN 1  THEN 'CRITICAL'
                                                WHEN 2  THEN 'SEVERE'
                                                WHEN 8  THEN 'IMPORTANT'
                                                WHEN 16 THEN 'IMPORTANT'
                                                ELSE 'IMPORTANT'
                                                END
                        RETURNING CLOB           
                    )
                        RETURNING CLOB 
                    ),
            'pagination' VALUE JSON_OBJECT(
                'totalRecords' VALUE MAX(total_count),
                'limit' VALUE ${limit},
                'offset' VALUE ${offset},
                'hasMore' VALUE CASE WHEN ${offset + limit} < MAX(total_count) THEN 'true' ELSE 'false' END
            )
            RETURNING CLOB
        ) AS alert_log_json
        FROM paginated_logs;
    `;
}

async function executeOracleScript(script: string, databaseInstanceName: string, ec2InstanceId: string): Promise<any> {
    const sqlPlusScriptForOracle = getSqlplusScriptForOracle(script, databaseInstanceName, ec2InstanceId);
    const result = await runSqlPlusScript(sqlPlusScriptForOracle);
    const parsedResult = safeParseJson(result);
    return parsedResult;
}

async function fetchAllOracleLogs(options: any): Promise<OracleErrorLog[]> {
    const { databaseInstanceName, startTime, limit = 5000, ec2InstanceId } = options;
    logger.debug(`Starting to fetch Oracle logs for instance: ${databaseInstanceName}`, { startTime, limit });
    let offset = 0;
    let hasMore = true;
    let totalRecords = 0;
    const allRecords: OracleErrorLog[] = [];

    while (hasMore) {
        try {
            const sqlScript = getOracleLogsScript({
                limit,
                offset,
                startTime
            });

            const result = await executeOracleScript(sqlScript, databaseInstanceName, ec2InstanceId);
            const parsedResult: PaginationResult = typeof result === 'string' ? safeParseJson(result) : result;
            if (!parsedResult || !parsedResult.data || parsedResult.data.length === 0) {
                break;
            }

            if (parsedResult.data && parsedResult.data.length > 0) {
                const records = parsedResult.data
                    .filter((record: any) => {
                        if (record.messageType === 'NOTIFICATION' || record.messageType === 'TRACE') {
                            return false;
                        }

                        // Filter out records that don't contain error-related keywords
                        if (!containsErrorKeywords(record.messageText)) {
                            return false;
                        }

                        return true;
                    })
                    .map((record: any) => ({
                        timestamp: record.timestamp,
                        message: record.messageText,
                        context: '',
                        severity: record.messageLevel
                    }));
                allRecords.push(...records);

                // Update pagination info
                if (parsedResult.pagination) {
                    totalRecords = parsedResult.pagination.totalRecords;
                    hasMore = parsedResult.pagination.hasMore === 'true';
                } else {
                    // If no pagination info, assume no more data
                    hasMore = false;
                }
                // Update offset
                offset += limit;

                logger.debug(`Fetched ${allRecords.length} of ${totalRecords} records from Oracle logs`);
            } else {
                hasMore = false;
            }
        } catch (error) {
            logger.error(`Error fetching Oracle logs at offset ${offset}:`, error);
            throw error;
        }
    }

    logger.debug(`Completed fetching Oracle logs. Total records: ${allRecords.length}`);
    return allRecords;
}

function processOracleErrorLogLines(
    lines: string[],
    timestampLastLogProcessed: number,
    errorSet: Set<unknown>,
    pendingEntries: string[],
    linesToIgnore: Set<unknown>,
    errorLogs: OracleErrorLog[],
    isProcessingLastChunk: boolean = false
) {
    const contextLines = 10; // Number of lines to consider as context for each error

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        line = line.replace(/[^\x20-\x7E]/g, ''); // Remove non-printable characters
        const match = ORACLE_ERROR_PATTERN.exec(line);

        if (timestampLastLogProcessed && match?.groups) {
            const { timestamp, severity, pid, sqlid, module, code, message } = match.groups;
            const logTimestamp = new Date(timestamp).getTime();

            if (logTimestamp >= timestampLastLogProcessed && !errorSet.has(line)) {
                const contextLimit = i + contextLines;
                const end = Math.min(lines.length, contextLimit);

                if (!isProcessingLastChunk && contextLimit > lines.length) {
                    // if the error is towards the end of the file, we need to store it in pendingEntries so that we can process with the next chunk
                    pendingEntries.push(line);
                } else {
                    // For Oracle, collect multi-line context including Cause, Action, Call Stack, etc.
                    const contextData = [];

                    // Add the main error line
                    contextData.push(line);

                    // Look for additional context lines (Cause, Action, Call Stack, Trace Details)
                    for (let j = i + 1; j < end && j < lines.length; j++) {
                        const contextLine = lines[j].trim();
                        if (
                            contextLine.startsWith('Cause:') ||
                            contextLine.startsWith('Action:') ||
                            contextLine.startsWith('Call Stack:') ||
                            contextLine.startsWith('Trace Details:') ||
                            contextLine === '' ||
                            contextLine.includes('dbklaWriteAttentionLogTextVaList') ||
                            contextLine.includes('ksuitm_opt') ||
                            contextLine.includes('ksbrdp')
                        ) {
                            contextData.push(lines[j]);
                        } else if (lines[j].match(ORACLE_ERROR_PATTERN)) {
                            // Stop when we hit the next error
                            break;
                        }
                    }

                    // Only process ERROR and WARNING severity logs
                    if (ORACLE_SEVERITY_LEVELS.includes(severity) && !linesToIgnore.has(line)) {
                        // unshift to push error to the beginning of the array so that the latest error logs are at the top
                        errorLogs.unshift({
                            timestamp,
                            severity,
                            pid,
                            sqlid,
                            module,
                            code,
                            message,
                            context: contextData.join('\n'),
                            filePath: '', // Will be set by caller
                            lineNumber: i + 1
                        });

                        contextData.forEach(item => errorSet.add(item));
                    } else if (severity === 'NOTIFICATION') {
                        // For notifications, add to ignore list to avoid processing as errors
                        contextData.forEach(item => linesToIgnore.add(item));
                    }
                }
            }
        }
    }

    // order logs by timestamp
    errorLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function getUniqueOracleErrorsAndRespectiveCount(
    logs: OracleErrorLog[],
    uniqueLogsCountToConsider: number
): { uniqueErrorLogs: OracleUniqueErrorLog[] } {
    logger.debug('Starting to group Oracle logs by error', { uniqueLogsCountToConsider });

    logs.forEach(log => {
        // First try to extract ORA error code from message (this takes priority)
        const oraErrorMatch = log.message.match(/ORA-(\d+)/);
        if (oraErrorMatch) {
            log.code = `ORA-${oraErrorMatch[1]}`;
        } else if (!log.code || isEmpty(log.code)) {
            // If no ORA error found and no existing code, generate a dummy error code
            const dummyErrorCode = generateHash(log.message);
            log.code = `${dummyErrorCode}-dummy`;
        }
    });

    const groupedLogs = groupBy(logs, 'code');

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

            const [{ context, message, severity }] = logsForError;

            // Extract cause from context if available
            const causeMatch = context?.match(/Cause:\s*(.+?)(?:\n|$)/);
            const cause = causeMatch ? causeMatch[1].trim() : undefined;

            return {
                uniqueErrorKey: key,
                error: message,
                context: context || message, // Fallback to message if context is undefined
                cause,
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

    logger.debug('Finished grouping Oracle logs by error');
    return { uniqueErrorLogs };
}

export {
    OracleErrorLog,
    OracleUniqueErrorLog,
    readOracleLogsFile,
    getUniqueOracleErrorsAndRespectiveCount,
    fetchAllOracleLogs
};
