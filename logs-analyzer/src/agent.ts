import { readdirSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
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
    DATABASE_TYPE,
    MSSQL_ERROR_LOGS_ANALYZER_PROMPT,
    PGSQL_ERROR_LOGS_ANALYZER_PROMPT,
    PGSQL_REMEDIATION_RECOMMENDATION_PROMPT,
    REMIDIATION_RECOMMENDATION_PROMPT
} from './utils/const';
import streamMessages from './aws/bedrock';
import collectLogs from '../operations/logs-filtering-operations';
import TOOLS from './utils/tools';
import { getPowershellScript, getBashScript, runPowerShellScript, deleteOlderFilesInDirectory } from './utils/utils';
import logger from './utils/logging';
import {
    ErrorLg,
    ToolUse,
    ToolSpec,
    ErrorLogWithScript,
    MessageObj,
    ErrorLogWithAdditionalInfo
} from './utils/interfaces';

const LIMIT_3 = pLimit(3); // Limit concurrency to 3

const { argv } = yargs(hideBin(process.argv))
    .option('logs-path', {
        alias: 'l',
        type: 'string',
        description: 'Database application logs folder path',
        demandOption: true
    })
    .option('sql-auth-enabled', {
        alias: 's',
        type: 'boolean',
        description: 'SQL authentication enabled',
        default: false,
        demandOption: false
    })
    .option('database-instance-name', {
        alias: 'd',
        type: 'string',
        description: 'SQL instance name',
        default: 'MSSQLSERVER',
        demandOption: false
    })
    .option('job-id', {
        alias: 'j',
        type: 'string',
        description: 'Workload Factory job ID',
        demandOption: true
    })
    .option('instance-id', {
        alias: 'i',
        type: 'string',
        description: 'EC2 instance ID',
        demandOption: true
    })
    .option('region', {
        alias: 'r',
        type: 'string',
        description: 'AWS region',
        demandOption: true
    })
    .option('log-level', {
        alias: 'll',
        type: 'string',
        description: 'Log level',
        choices: ['debug', 'info', 'warn', 'error'],
        default: 'info'
    })
    .option('timestamp', {
        alias: 't',
        type: 'number',
        description: 'Timestamp of the last log statement in milliseconds',
        default: Date.now() - 1000 * 60 * 60 * 24 * 120 // Default to 24 hours ago
    })
    .option('logs-count-to-consider', {
        alias: 'c',
        type: 'number',
        description: 'Number of logs to consider for analysis',
        default: 1000
    })
    .option('temperature', {
        alias: 'e',
        type: 'string',
        description: 'Temperature for the model',
        demandOption: false,
        default: '0.5'
    })
    .option('top-p', {
        alias: 'p',
        type: 'string',
        description: 'Top P for the model',
        demandOption: false,
        default: '0.9'
    })
    .option('max-tokens', {
        alias: 'm',
        type: 'string',
        description: 'Max tokens for the model',
        demandOption: false,
        default: '1000'
    })
    .option('model-id', {
        type: 'string',
        description: 'Model ID to use for analysis',
        demandOption: true
    })
    .option('model-region', {
        type: 'string',
        description: 'Model ID to use for analysis',
        demandOption: true
    })
    .option('help', {
        alias: 'h',
        type: 'boolean',
        description: 'Show help'
    })
    .help();

logger.info('Command line arguments:', argv);

const {
    'logs-path': LOGS_FOLDER,
    'sql-auth-enabled': SQL_AUTH_ENABLED,
    'database-instance-name': DATABASE_INSTANCE_NAME,
    'job-id': JOB_ID,
    'instance-id': INSTANCE_ID,
    'log-level': LOG_LEVEL,
    region: REGION,
    'model-id': MODEL_ID,
    'model-region': MODEL_REGION,
    timestamp: TIMESTAMP_LAST_LOG_PROCESSED,
    'logs-count-to-consider': LOGS_COUNT,
    'top-p': TOP_P,
    temperature: TEMP,
    'max-tokens': MAX_TOKENS
} = argv as any;

const INFERENCE_CONFIG = {
    temperature: parseFloat(TEMP),
    top_p: parseFloat(TOP_P),
    max_tokens_to_sample: parseInt(MAX_TOKENS, 10)
};

logger.level = LOG_LEVEL;
logger.info(`Log level set to: ${LOG_LEVEL}`);

const logGroupName = 'netapp/wlmdb/ssm-response';
const logStreamSuffix = 'aws-runPowerShellScript/stdout';
const logStreamName = `${INSTANCE_ID}-logs-analyzer/${JOB_ID}/${logStreamSuffix}`;
const CW_OUTPUT_PATH = `${logGroupName}/${logStreamName}`;

const remediationRecommendation: {
    error: string;
    cause: string;
    count: number;
    severity: string | number;
    remediation: string;
}[] = [];

initiateLogsAnalysis(
    `Analyze the SQL profiles logs available in ${LOGS_FOLDER} and provide remediation recommendations for the errors found in the logs.`
);

async function initiateLogsAnalysis(inputText: string) {
    logger.info('Step 1: Initializing client and preparing messages.');
    const client = new BedrockRuntimeClient({ region: MODEL_REGION });
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
        const { stopReason, message } = await streamMessages(client, MODEL_ID, messages, toolConfig, INFERENCE_CONFIG);
        messages.push(message);

        if (stopReason === 'tool_use') {
            await handleToolUse(client, message, messages, toolConfig, uniqueQueryMap, INFERENCE_CONFIG);
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
                remediationRecommendation
            }
        };

        logger.info('Step 5: Writing to CloudWatch Logs.');
        await writeToCloudWatchLogGroup(JSON.stringify(response));
    } catch (err) {
        writeFileSync(statusFilePath, 'Failed', 'utf-8');
        handleError(err);
    } finally {
        logger.info(
            `Log analysis completed for ${LOGS_FOLDER}. Output files are saved in ${outputDir} of the database node. Log analysis results are available in Cloud watch logs at ${CW_OUTPUT_PATH}`
        );
    }
}

async function handleToolUse(
    client: BedrockRuntimeClient,
    message: MessageObj,
    messages: MessageObj[],
    toolConfig: { tools: ToolSpec[] },
    uniqueQueryMap: Map<string, string[]>,
    inferenceConfig: InferenceConfiguration = INFERENCE_CONFIG
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
                                await analyzeDatabaseApplicationLogs(tool, client, LOGS_FOLDER, SQL_AUTH_ENABLED, DATABASE_INSTANCE_NAME, messages, INFERENCE_CONFIG);
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
                            await handleToolUse(client, message, messages, toolConfig, uniqueQueryMap, inferenceConfig);
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
    errorLogs: ErrorLg[],
    inferenceConfig: InferenceConfiguration = INFERENCE_CONFIG
) {
    logger.info('Analyzing error logs.', { databaseType });

    const errorLogsWithCause: MessageObj[] = [];
    const errorLogsWithScripts = [];

    const prompt =
        databaseType === DATABASE_TYPE.MSSQL ? MSSQL_ERROR_LOGS_ANALYZER_PROMPT : PGSQL_ERROR_LOGS_ANALYZER_PROMPT;

    await Promise.all(
        errorLogs.map(logChunk =>
            pLimit(5)(async () => {
                const response = await streamMessages(
                    client,
                    MODEL_ID,
                    [
                        {
                            role: ConversationRole.USER,
                            content: [{ text: prompt + JSON.stringify(logChunk) }]
                        }
                    ],
                    undefined,
                    inferenceConfig
                );

                const { message } = response;
                errorLogsWithCause.push(message);
            })
        )
    );

    const assistantMessages = compact(
        errorLogsWithCause
            .filter((message: MessageObj) => message.role === 'assistant')
            .flatMap(message => message.content?.[0]?.text ?? [])
    );

    const scripts = parseSuggestedScripts(assistantMessages);
    errorLogsWithScripts.push(...scripts);

    return { errorLogsWithScripts, databaseType };
}

function parseSuggestedScripts(assistantMessages: string[]): ErrorLogWithScript[] {
    logger.info('Parsing suggested scripts from assistant messages.');

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
                        severity,
                        sql: { query }
                    } = JSON.parse(message);
                    const filteredQueries = query.filter((queryEntry: string) => queryEntry !== 'NA');
                    return { error, cause, count, severity, sql: filteredQueries };
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

async function checkAndExecuteAdditionalScript(databaseType: string, errorLogsWithScripts: ErrorLogWithScript[], databaseInstanceName?: string, sqlAuthEnabled?: boolean) {
    logger.info('Checking and executing additional scripts.', { databaseType, databaseInstanceName, sqlAuthEnabled });

    const result: ErrorLogWithAdditionalInfo[] = [];

    const uniqueQueryMap = new Map();
    errorLogsWithScripts.forEach((logWithScript: ErrorLogWithScript) => {
        const { error, cause, count, severity, sql = [] } = logWithScript;
        const queryKey = createHash('sha256')
            .update(sql.map((queryEntry: { query: string }) => queryEntry?.query).join('|'))
            .digest('hex');

        if (!uniqueQueryMap.has(queryKey)) {
            uniqueQueryMap.set(queryKey, [{ error, cause, count, severity, sql }]);
        } else {
            uniqueQueryMap.get(queryKey).push({ error, count, severity, cause });
        }
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
                    const errorAndCauseWithAdditionalInfo = value.map(
                        ({ error, cause, count, severity }: ErrorLogWithScript) => ({
                            error,
                            cause,
                            count,
                            severity,
                            additionalInfo: response
                        })
                    );
                    result.push(...errorAndCauseWithAdditionalInfo);
                } else {
                    const errorAndCauseWithAdditionalInfo = value.map(
                        ({ error, cause, count, severity }: ErrorLogWithScript) => ({
                            error,
                            cause,
                            count,
                            severity,
                            additionalInfo: 'No additional script executed.'
                        })
                    );
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
    result: ErrorLogWithAdditionalInfo[],
    inferenceConfig: InferenceConfiguration
) {
    logger.info('Recommending remediation for errors.', { databaseType });

    const prompt =
        databaseType === DATABASE_TYPE.MSSQL
            ? REMIDIATION_RECOMMENDATION_PROMPT
            : PGSQL_REMEDIATION_RECOMMENDATION_PROMPT;

    await Promise.all(
        result.map(errorWithInfo =>
            LIMIT_3(async () => {
                const response = await streamMessages(
                    client,
                    MODEL_ID,
                    [
                        {
                            role: ConversationRole.USER,
                            content: [{ text: prompt + JSON.stringify(errorWithInfo) }]
                        }
                    ],
                    undefined,
                    inferenceConfig
                );

                const { message } = response;
                const { content: [{ text }] = [] } = message;
                if (text) {
                    const { error, cause, count, severity, remediation } = JSON.parse(text);
                    remediationRecommendation.push({ error, cause, count, severity, remediation });
                } else {
                    logger.error('No text found in the response.');
                }
            })
        )
    );
    return remediationRecommendation;
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
    inferenceConfig: InferenceConfiguration = INFERENCE_CONFIG
) {
    logger.info('Analyzing database application logs.', { logsFolderPath, sqlAuthEnabled, databaseInstanceName });

    const databaseDetails = await getDatabaseDetails(logsFolderPath);
    // Collect logs based on the identified database type
    const { databaseType: dbType = '' } = databaseDetails || {};

    const { uniqueErrorLogs: errorLogs } = await collectLogs(
        dbType,
        logsFolderPath,
        TIMESTAMP_LAST_LOG_PROCESSED,
        LOGS_COUNT
    );

    if (isEmpty(errorLogs)) {
        logger.error('No error logs found in the logs.');
        return;
    }

    // Analyze the error logs to identify the cause of the errors and find out if any additional scripts need to be run
    const { errorLogsWithScripts } = await analyzeErrorLogs(dbType, client, errorLogs, inferenceConfig);

    if (!isEmpty(errorLogsWithScripts)) {
        const { result } = await checkAndExecuteAdditionalScript(dbType, errorLogsWithScripts, databaseInstanceName, sqlAuthEnabled);
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
    logger.info('Writing to CloudWatch Logs:', message);

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

function handleError(err: any) {
    logger.error('A client error occurred:', err);
}
