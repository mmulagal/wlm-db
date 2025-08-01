import { readdirSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { BedrockRuntimeClient, ConversationRole, InferenceConfiguration } from '@aws-sdk/client-bedrock-runtime';
import { createHash } from 'node:crypto';
import {
    CloudWatchLogsClient,
    CreateLogStreamCommand,
    DescribeLogStreamsCommand,
    PutLogEventsCommand
} from '@aws-sdk/client-cloudwatch-logs';
import { compact, isEmpty } from 'lodash-es';
import { execa } from 'execa';
import pLimit from 'p-limit';
import {
    BEDROCK_RETRY,
    DATABASE_TYPE,
    MSSQL_ERROR_LOGS_ANALYZER_PROMPT,
    PGSQL_ERROR_LOGS_ANALYZER_PROMPT,
    PGSQL_REMEDIATION_RECOMMENDATION_PROMPT,
    REMIDIATION_RECOMMENDATION_PROMPT
} from './utils/const';
import streamMessages from './aws/bedrock';
import collectLogs from './operations/logs-filtering-operations';
import TOOLS from './utils/tools';
import {
    getPowershellScript,
    getBashScript,
    runPowerShellScript,
    deleteOlderFilesInDirectory,
    safeParseJson,
    hoursAgoTimestamp
} from './utils/utils';
import logger from './utils/logging';
import { ToolUse, ToolSpec, MessageObj, AgentArgs, ErrorLogWithScriptAndDetails, ErrorLog } from './utils/interfaces';

const LIMIT_3 = pLimit(3); // Limit concurrency to 3
logger.info('Starting logs analysis agent...');

const program = new Command();

program
    .requiredOption('-l, --logs-path <path>', 'Database application logs folder path')
    .option('-s, --sql-auth-enabled <enabled>', 'SQL authentication enabled', false)
    .option('-d, --database-instance-name <name>', 'SQL instance name', 'MSSQLSERVER')
    .requiredOption('-j, --job-id <id>', 'Workload Factory job ID')
    .requiredOption('-i, --instance-id <id>', 'EC2 instance ID')
    .requiredOption('-r, --region <region>', 'AWS region')
    .option('-g, --log-level <level>', 'Log level', 'info')
    .option('-t, --timestamp <ms>', 'Timestamp of the last log statement in milliseconds', `${hoursAgoTimestamp(24)}`)
    .option('-c, --logs-count-to-consider <count>', 'Number of logs to consider for analysis', '1000')
    .option('-w, --time-window-hours <hours>', 'Time window in hours to look back for logs', '24')
    .option('-e, --temperature <temp>', 'Temperature for the model', '0.5')
    .option('-p, --top-p <topP>', 'Top P for the model', '0.9')
    .option('-m, --max-tokens <tokens>', 'Max tokens for the model', '1000')
    .requiredOption('-a, --model-id <id>', 'Model ID to use for analysis')
    .requiredOption('-n, --model-region <region>', 'Model region to use for analysis');

program.parse(process.argv);
const argv = program.opts();

logger.info('Command line arguments:', argv);

const {
    logsPath,
    sqlAuthEnabled: SQL_AUTH_ENABLED,
    databaseInstanceName: DATABASE_INSTANCE_NAME,
    jobId: JOB_ID,
    instanceId: INSTANCE_ID,
    logLevel: LOG_LEVEL,
    region: REGION,
    modelId: MODEL_ID,
    modelRegion: MODEL_REGION,
    timestamp: TIMESTAMP_LAST_LOG_PROCESSED,
    logsCountToConsider: LOGS_COUNT,
    timeWindowHours: TIME_WINDOW_HOURS,
    topP: TOP_P,
    temperature: TEMP,
    maxTokens: MAX_TOKENS
} = argv as AgentArgs;

const LOGS_FOLDER = decodeURIComponent(logsPath);
if (!existsSync(LOGS_FOLDER)) {
    logger.error(`Logs folder does not exist: ${LOGS_FOLDER}`);
    throw new Error(`Logs folder does not exist: ${LOGS_FOLDER}`);
}
const INFERENCE_CONFIG = {
    temperature: Number(TEMP),
    top_p: Number(TOP_P),
    max_tokens_to_sample: Number(MAX_TOKENS)
};

logger.level = LOG_LEVEL;
logger.info(`Log level set to: ${LOG_LEVEL}`);

const logGroupName = 'netapp/wlmdb/ssm-response';
const logStreamSuffix = 'aws-runPowerShellScript/stdout';
const logStreamName = `${INSTANCE_ID}-logs-analyzer/${JOB_ID}/${logStreamSuffix}`;
const CW_OUTPUT_PATH = `${logGroupName}/${logStreamName}`;
interface RemediationRecommendation {
    error: string;
    cause?: string;
    count: number;
    remediation: string;
    severity?: string | number;
    firstOccurrence?: number;
    lastOccurrence?: number;
    errorCode?: string;
    uniqueErrorKey?: string;
    sql?: string[];
    context?: string;
    additionalInfo?: string | Array<{ query: any; error: any; result: any }>;
    hourlyErrorCounts?: Array<{
        hour: number;
        count: number;
    }>;
    tokenUsage?: {
        causeIdentification?: {
            input: number;
            output: number;
            total: number;
        };
        remediationRecommendation?: {
            input: number;
            output: number;
            total: number;
        };
    };
}

const remediationRecommendation: RemediationRecommendation[] = [];

initiateLogsAnalysis(
    `Analyze the SQL profiles logs available in ${LOGS_FOLDER} and provide remediation recommendations for the errors found in the logs.`
);

async function initiateLogsAnalysis(inputText: string) {
    logger.info('Step 1: Initializing client and preparing messages.');
    const client = new BedrockRuntimeClient({
        region: MODEL_REGION,
        retryMode: BEDROCK_RETRY.MODE, // https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html
        maxAttempts: BEDROCK_RETRY.MAX_ATTEMPTS, // Maximum retry attempts for Bedrock client
        defaultsMode: 'in-region'
    });
    const uniqueQueryMap = new Map();
    const messages: MessageObj[] = [
        {
            role: ConversationRole.USER,
            content: [
                {
                    text: inputText
                }
            ]
        }
    ];
    const toolConfig = { tools: TOOLS };

    logger.info('Step 2: Creating output directory and file paths.');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const startLogsAnalysisFromTimestamp = getStartTimestampForAnalysis(TIME_WINDOW_HOURS);
    const outputDir = join(process.cwd(), 'output');
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir);
    }
    const conversationFilePath = join(outputDir, `conversation_history_${timestamp}.json`);
    const remediationFilePath = join(outputDir, `remediation_recommendations_${timestamp}.json`);
    const statusFilePath = join(outputDir, `status_${timestamp}.txt`);
    writeFileSync(statusFilePath, 'In Progress', 'utf-8');

    try {
        logger.info('Step 3: Streaming messages and handling tool use.');
        const { stopReason, message, usage } = await streamMessages(
            client,
            MODEL_ID,
            messages,
            toolConfig,
            INFERENCE_CONFIG
        );
        messages.push(message);
        const { inputTokens, outputTokens, totalTokens } = usage || {};
        if (stopReason === 'tool_use') {
            await handleToolUse(
                client,
                message,
                messages,
                toolConfig,
                uniqueQueryMap,
                INFERENCE_CONFIG,
                startLogsAnalysisFromTimestamp
            );
        }

        logger.info('Step 4: Writing output files.');
        writeFileSync(conversationFilePath, JSON.stringify(messages, null, 2), 'utf-8');
        writeFileSync(remediationFilePath, JSON.stringify(remediationRecommendation, null, 2), 'utf-8');
        writeFileSync(statusFilePath, 'Completed', 'utf-8');

        logger.debug('Conversation history:', JSON.stringify(messages, null, 2));
        logger.debug('Recommendations for remediation are:', JSON.stringify(remediationRecommendation, null, 2));

        // delete files older than 7 days
        deleteOlderFilesInDirectory(outputDir, 7);

        const response = {
            status: 'success',
            message: 'Logs analysis complete.',
            data: {
                conversationFilePath,
                remediationFilePath,
                statusFilePath,
                remediationRecommendation,
                startTime: startLogsAnalysisFromTimestamp,
                endTime: Date.now(),
                totalTokens: {
                    tokenUsageForIntentIdentification: {
                        input: inputTokens,
                        output: outputTokens,
                        total: totalTokens
                    },
                    totalTokensForRemediation: {
                        input: sumTokenUsage(remediationRecommendation, 'remediationRecommendation', 'input'),
                        output: sumTokenUsage(remediationRecommendation, 'remediationRecommendation', 'output'),
                        total: sumTokenUsage(remediationRecommendation, 'remediationRecommendation', 'total')
                    },
                    totalTokensForCauseIdentification: {
                        input: sumTokenUsage(remediationRecommendation, 'causeIdentification', 'input'),
                        output: sumTokenUsage(remediationRecommendation, 'causeIdentification', 'output'),
                        total: sumTokenUsage(remediationRecommendation, 'causeIdentification', 'total')
                    }
                }
            }
        };

        logger.info('Step 5: Writing to CloudWatch Logs.');
        await writeToCloudWatchLogGroup(JSON.stringify(response));
    } catch (err) {
        writeFileSync(statusFilePath, `Failed: ${err}`, 'utf-8');
        const errorMessage = `Failed running logs analysis. A client error occurred: ${err}`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
    } finally {
        logger.info(
            `Log analysis completed for ${LOGS_FOLDER}. Output files are saved in ${outputDir} of the database node. Log analysis results are available in Cloud watch logs at ${CW_OUTPUT_PATH}`
        );
    }
}

function getStartTimestampForAnalysis(timeWindowHours: number = 24) {
    if (timeWindowHours > 24) {
        // 24 is default value
        // If the time window is greater than 24 hours, value specifically passed to the agent will be used.
        logger.info(`Using time window of ${timeWindowHours} hours for logs analysis.`);
        return hoursAgoTimestamp(timeWindowHours);
    }
    const windowHrAgoTimestamp = hoursAgoTimestamp(timeWindowHours);
    const startTimestamp = Math.max(TIMESTAMP_LAST_LOG_PROCESSED, windowHrAgoTimestamp);
    return startTimestamp;
}

function sumTokenUsage(
    recommendations: RemediationRecommendation[],
    key: 'causeIdentification' | 'remediationRecommendation',
    type: 'input' | 'output' | 'total'
): number {
    return recommendations.reduce((sum, rec) => {
        const tokenUsage = rec?.tokenUsage?.[key]?.[type];
        return sum + (tokenUsage || 0);
    }, 0);
}

async function handleToolUse(
    client: BedrockRuntimeClient,
    message: MessageObj,
    messages: MessageObj[],
    toolConfig: { tools: ToolSpec[] },
    uniqueQueryMap: Map<string, string[]>,
    inferenceConfig: InferenceConfiguration = INFERENCE_CONFIG,
    startLogsAnalysisFromTimestamp: number
) {
    let stopReason = '';
    if (message?.content) {
        await Promise.all(
            message.content?.map(content =>
                LIMIT_3(async () => {
                    if (content?.toolUse) {
                        const tool = content.toolUse;

                        switch (tool?.name) {
                            case 'analyze_db_logs': {
                                await analyzeDatabaseApplicationLogs(
                                    tool,
                                    client,
                                    LOGS_FOLDER,
                                    SQL_AUTH_ENABLED,
                                    DATABASE_INSTANCE_NAME,
                                    messages,
                                    INFERENCE_CONFIG,
                                    startLogsAnalysisFromTimestamp
                                );
                                stopReason = 'end_turn'; // Stop further tool use
                                logger.info('Log analysis completed. Stopping further tool use.');

                                break;
                            }
                            default: {
                                logger.info(`Tool ${tool.name} is not supported`);
                                break;
                            }
                        }

                        if (stopReason === 'tool_use') {
                            await handleToolUse(
                                client,
                                message,
                                messages,
                                toolConfig,
                                uniqueQueryMap,
                                inferenceConfig,
                                startLogsAnalysisFromTimestamp
                            );
                        }
                    }
                })
            )
        );
    }
}

async function analyzeErrorLogs(
    databaseType: string,
    client: BedrockRuntimeClient,
    errorLogs: ErrorLog[],
    inferenceConfig: InferenceConfiguration = INFERENCE_CONFIG
) {
    logger.info('Analyzing error logs.', { databaseType });

    const errorLogsWithScripts: ErrorLogWithScriptAndDetails[] = [];

    const prompt =
        databaseType === DATABASE_TYPE.MSSQL ? MSSQL_ERROR_LOGS_ANALYZER_PROMPT : PGSQL_ERROR_LOGS_ANALYZER_PROMPT;

    // Sequential processing is intentional to avoid AWS Bedrock throttling
    /* eslint-disable no-await-in-loop */
    for (let index = 0; index < errorLogs.length; index++) {
        const logChunk = errorLogs[index];
        if (!isEmpty(logChunk)) {
            const {
                firstOccurrence,
                lastOccurrence,
                errorCode,
                severity,
                context,
                error,
                count,
                uniqueErrorKey,
                hourlyErrorCounts
            } = logChunk;

            const minimalErrorObject = {
                errorContext: context,
                errorMessage: error
            };

            const response = await streamMessages(
                client,
                MODEL_ID,
                [
                    {
                        role: ConversationRole.USER,
                        content: [{ text: prompt + JSON.stringify(minimalErrorObject) }]
                    }
                ],
                undefined,
                inferenceConfig
            );

            const { message, usage: { totalTokens: total = 0, outputTokens: output, inputTokens: input } = {} } = response;
            if (message.role === ConversationRole.ASSISTANT) {
                const { content: [{ text }] = [] } = message;
                if (text) {
                    const data = parseSuggestedScriptsWithTimestamp([text], {
                        firstOccurrence,
                        lastOccurrence,
                        errorCode,
                        severity,
                        count,
                        uniqueErrorKey,
                        hourlyErrorCounts,
                        tokenUsageForCauseIdentification: {
                            input,
                            output,
                            total
                        },
                        context
                    });
                    errorLogsWithScripts.push(...data);
                }
            }
        }
    }
    /* eslint-enable no-await-in-loop */
    return { errorLogsWithScripts, databaseType };
}

function parseSuggestedScriptsWithTimestamp(
    assistantMessages: string[],
    additionalDetails: object
): ErrorLogWithScriptAndDetails[] {
    logger.debug('Parsing suggested scripts from assistant messages.', { additionalDetails });

    return compact(
        assistantMessages
            .filter((asstMsg: string) => {
                logger.debug('Processing assistant message:', asstMsg);
                if (asstMsg && asstMsg.includes('error')) {
                    try {
                        const parsedMsg = JSON.parse(asstMsg);
                        return parsedMsg.sql !== undefined;
                    } catch (error) {
                        logger.error('Failed to parse assistant message in JSON:', { error, asstMsg });
                        return false;
                    }
                }
                return false;
            })
            .map((message: string) => {
                try {
                    const {
                        error,
                        cause,
                        count,
                        context,
                        sql: { query }
                    } = JSON.parse(message);
                    const filteredQueries = query
                        .filter((queryEntry: string) => queryEntry !== 'NA')
                        .map((queryEntry: string) => queryEntry);
                    return { error, context, cause, count, sql: filteredQueries, ...additionalDetails };
                } catch (error) {
                    logger.error('Failed to parse JSON:', { message, error });
                    return undefined;
                }
            })
    );
}

async function runBashScript(scriptContent: string): Promise<string> {
    logger.info('Running bash script.');

    try {
        const { stdout } = await execa('bash', ['-c', scriptContent]);
        return stdout.trim();
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Bash script failed: ${error.message}`);
        } else {
            throw new Error(`Bash script failed: ${String(error)}`);
        }
    }
}

async function checkAndExecuteAdditionalScript(
    databaseType: string,
    errorLogsWithScripts: ErrorLogWithScriptAndDetails[],
    databaseInstanceName?: string,
    sqlAuthEnabled?: boolean
) {
    logger.info('Checking and executing additional scripts.', { databaseType, databaseInstanceName, sqlAuthEnabled });

    const result: ErrorLogWithScriptAndDetails[] = [];

    const uniqueQueryMap = new Map();
    errorLogsWithScripts.forEach((logWithScript: ErrorLogWithScriptAndDetails) => {
        const { sql = [] } = logWithScript;
        const queryKey = createHash('sha256')
            .update(sql.map((queryEntry: string) => queryEntry).join('|'))
            .digest('hex');

        const arr = uniqueQueryMap.get(queryKey) || [];
        arr.push(logWithScript);
        uniqueQueryMap.set(queryKey, arr);
    });

    await Promise.all(
        Array.from(uniqueQueryMap.values()).map(value =>
            LIMIT_3(async () => {
                const [{ sql }] = value;
                if (!isEmpty(sql)) {
                    const response =
                        databaseType === DATABASE_TYPE.MSSQL
                            ? await runPowerShellScript(getPowershellScript(sql, databaseInstanceName!, sqlAuthEnabled))
                            : await runBashScript(getBashScript(sql));
                    const errorAndCauseWithAdditionalInfo = value.map((val: ErrorLogWithScriptAndDetails) => ({
                        ...val,
                        additionalInfo: response
                    }));
                    result.push(...errorAndCauseWithAdditionalInfo);
                } else {
                    const errorAndCauseWithAdditionalInfo = value.map((val: ErrorLogWithScriptAndDetails) => ({
                        ...val,
                        additionalInfo: 'No additional script executed.'
                    }));
                    result.push(...errorAndCauseWithAdditionalInfo);
                }
            })
        )
    );

    return { result: compact(result) };
}

async function recommendRemediation(
    databaseType: string,
    client: BedrockRuntimeClient,
    result: ErrorLogWithScriptAndDetails[],
    inferenceConfig: InferenceConfiguration
) {
    logger.info('Recommending remediation for errors.', { databaseType });

    const prompt =
        databaseType === DATABASE_TYPE.MSSQL
            ? REMIDIATION_RECOMMENDATION_PROMPT
            : PGSQL_REMEDIATION_RECOMMENDATION_PROMPT;

    /* eslint-disable no-await-in-loop */
    for (let index = 0; index < result.length; index++) {
        const errorWithInfo = result[index];
        if (!isEmpty(errorWithInfo)) {
            const {
                firstOccurrence,
                lastOccurrence,
                errorCode,
                error,
                cause,
                additionalInfo,
                severity,
                count,
                tokenUsageForCauseIdentification: causeIdentification,
                uniqueErrorKey,
                hourlyErrorCounts,
                context,
                sql
            } = errorWithInfo;
            const minimalErrorObject = {
                error,
                cause,
                additionalInfo
            }; // Minimal error object to send to the model to save tokens
            const response = await streamMessages(
                client,
                MODEL_ID,
                [
                    {
                        role: ConversationRole.USER,
                        content: [{ text: prompt + JSON.stringify(minimalErrorObject) }]
                    }
                ],
                undefined,
                inferenceConfig
            );
            const { message, usage: { totalTokens: total = 0, inputTokens: input = 0, outputTokens: output = 0 } = {} } =
                response;
            const { content: [{ text }] = [] } = message;
            if (text) {
                const { remediation } = JSON.parse(text);
                remediationRecommendation.push({
                    error,
                    cause,
                    count,
                    severity,
                    remediation,
                    firstOccurrence,
                    lastOccurrence,
                    errorCode,
                    uniqueErrorKey,
                    hourlyErrorCounts,
                    context,
                    sql,
                    additionalInfo:
                        additionalInfo && !isEmpty(additionalInfo) && typeof additionalInfo !== 'string'
                            ? formatAdditionalInfo(additionalInfo)
                            : [],
                    tokenUsage: {
                        causeIdentification,
                        remediationRecommendation: {
                            input,
                            output, // Assuming no output tokens for remediation recommendation
                            total
                        }
                    }
                });
            } else {
                logger.error('No text found in the response.');
            }
        }
    }
    /* eslint-enable no-await-in-loop */
    return remediationRecommendation;
}

function formatAdditionalInfo(additionalInfo: string) {
    logger.debug('Formatting additional info:', additionalInfo);
    if (!additionalInfo) {
        return [];
    }
    const additionalData = safeParseJson(additionalInfo);
    if (Array.isArray(additionalData)) {
        return additionalData.map((Result: any) => {
            const { Query: query, Result: result, Error: error } = Result;

            return {
                query,
                error,
                result: Array.isArray(result) ? result.join(',') : result
            };
        });
    }
    return [];
}

async function getDatabaseDetails(logsFolderPath: string) {
    logger.info('Getting database details from logs.');
    let databaseDetails: { logFile: string; databaseType: string; databaseVersion: string } | null = null;

    const logFiles = readdirSync(logsFolderPath).filter(
        file => file.endsWith('.trc') || file.endsWith('.xel') || file.endsWith('.log') || file.startsWith('ERRORLOG')
    );

    for (const logFile of logFiles) {
        const filePath = join(logsFolderPath, logFile);
        const fileContent = readFileSync(filePath, 'utf-8').replace(/[^\x20-\x7E]/g, '');
        let databaseType = 'Unknown';
        let databaseVersion = 'Unknown';

        if (fileContent.includes('Microsoft SQL Server')) {
            databaseType = DATABASE_TYPE.MSSQL;
            const versionMatch = fileContent.match(/Microsoft SQL Server\s+([\d.]+)/);
            if (versionMatch) {
                [, databaseVersion] = versionMatch;
            }
        } else if (fileContent.includes('PostgreSQL')) {
            databaseType = DATABASE_TYPE.POSTGRESQL;
            const versionMatch = fileContent.match(/PostgreSQL\s+([\d.]+)/);
            if (versionMatch) {
                [, databaseVersion] = versionMatch;
            }
        }

        if (!databaseDetails) {
            databaseDetails = { logFile, databaseType, databaseVersion };
            break; // Stop as soon as we find a match
        }
    }
    if (isEmpty(databaseDetails)) {
        const errorMessage = 'No database type or version found in the logs.';
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }
    return databaseDetails;
}

async function analyzeDatabaseApplicationLogs(
    tool: ToolUse,
    client: BedrockRuntimeClient,
    logsFolderPath: string,
    sqlAuthEnabled: boolean,
    databaseInstanceName: string,
    messages: MessageObj[],
    inferenceConfig: InferenceConfiguration = INFERENCE_CONFIG,
    startLogsAnalysisFromTimestamp: number
) {
    logger.info('Analyzing database application logs.', { logsFolderPath, sqlAuthEnabled, databaseInstanceName });

    const databaseDetails = await getDatabaseDetails(logsFolderPath);
    // Collect logs based on the identified database type
    const { databaseType: dbType = '' } = databaseDetails || {};

    const { uniqueErrorLogs: errorLogs } = await collectLogs(
        dbType,
        logsFolderPath,
        startLogsAnalysisFromTimestamp,
        LOGS_COUNT
    );

    if (isEmpty(errorLogs)) {
        logger.error('No error logs found in the logs.');
        return;
    }

    // Analyze the error logs to identify the cause of the errors and find out if any additional scripts need to be run
    const { errorLogsWithScripts } = await analyzeErrorLogs(dbType, client, errorLogs, inferenceConfig);
    if (!isEmpty(errorLogsWithScripts)) {
        const { result } = await checkAndExecuteAdditionalScript(
            dbType,
            errorLogsWithScripts,
            databaseInstanceName,
            sqlAuthEnabled
        );
        await recommendRemediation(dbType || DATABASE_TYPE.MSSQL, client, result, inferenceConfig);
    }

    const toolResult = {
        toolUseId: tool.toolUseId,
        content: [
            {
                text: `Logs analysis done and recommendations found for logs in ${logsFolderPath}.Stop further tool use.`
            }
        ]
    };

    messages.push({
        role: ConversationRole.USER,
        content: [{ toolResult }]
    });

    return { databaseDetails, messages };
}

async function writeToCloudWatchLogGroup(message: string) {
    logger.info('Writing to CloudWatch Logs', { logGroupName, logStreamName });

    const client = new CloudWatchLogsClient({ region: REGION });

    try {
        // check if log stream exists
        const describeLogStreamsCommand = new DescribeLogStreamsCommand({
            logGroupName,
            logStreamNamePrefix: logStreamName
        });
        const describeLogStreamsResponse = await client.send(describeLogStreamsCommand);
        if (describeLogStreamsResponse.logStreams && describeLogStreamsResponse.logStreams.length > 0) {
            logger.info('Log stream already exists:', logStreamName);
        } else {
            // Create the log stream if it doesn't exist
            const createLogStreamCommand = new CreateLogStreamCommand({
                logGroupName,
                logStreamName
            });
            await client.send(createLogStreamCommand);
            logger.info('Log stream created:', logStreamName);
        }
        // Write the log message
        const command = new PutLogEventsCommand({
            logGroupName,
            logStreamName,
            logEvents: [
                {
                    message,
                    timestamp: Date.now()
                }
            ]
        });
        await client.send(command);
        logger.info('Log successfully written to CloudWatch');
    } catch (error) {
        logger.error('Error writing to CloudWatch Logs:', error);
        throw error;
    }
}
