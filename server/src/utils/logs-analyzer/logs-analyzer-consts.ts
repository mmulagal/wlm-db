import { WLMDB } from '../consts';

const LOGS_ANALYZER_BUNDLE_PATH = `${WLMDB}/scripts/logs-analyzer/agent-win.exe`;
const LOGS_ANALYZER_PACKAGE_NAME = 'LogsAnalyzerAgent';
const LOGS_ANALYZER_PACKAGE_VERSION = '1.0.0';
const LOG_LEVEL = 'info';
const LOGS_COUNT_TO_CONSIDER = 100;

const LOGS_ANALYZER_MODEL_IDS = [
    'anthropic.claude-3-7-sonnet-20250219-v1:0',
    'anthropic.claude-3-5-sonnet-20240620-v1:0'
];

enum MODEL_AVAILABILITY_STATUS {
    AVAILABLE = 'AVAILABLE',
    NOT_AVAILABLE = 'NOT_AVAILABLE'
}

const BEDROCK_PRICE = {
    INPUT_1K_TOKENS: 0.003,
    OUTPUT_1K_TOKENS: 0.015
};
const AVG_TOKEN_COUNT_PER_ERROR = {
    INPUT: 15000,
    OUTPUT: 3500
};

const MSSQL_ERROR_PATTERN =
    /(?<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{2}) (?<spid>\w+) +(?:Error: (?<errorCode>\d+), Severity: (?<severity>\d+), State: (?<state>\d+)|.*?\b(?:(?<keyword>deadlock|error|failed|bottleneck))\b(?<message>.*))/;

export {
    MODEL_AVAILABILITY_STATUS,
    LOGS_ANALYZER_BUNDLE_PATH,
    LOGS_ANALYZER_PACKAGE_NAME,
    LOGS_ANALYZER_PACKAGE_VERSION,
    LOG_LEVEL,
    LOGS_COUNT_TO_CONSIDER,
    LOGS_ANALYZER_MODEL_IDS,
    BEDROCK_PRICE,
    AVG_TOKEN_COUNT_PER_ERROR,
    MSSQL_ERROR_PATTERN
};
