import { WLMDB } from '../consts';

const LOGS_ANALYZER_BUNDLE_PATH = `${WLMDB}/scripts/logs-analyzer/agent-win.exe`;
const LOGS_ANALYZER_PACKAGE_NAME = 'LogsAnalyzerAgent';
const LOGS_ANALYZER_PACKAGE_VERSION = '1.0.0';
const LOG_LEVEL = 'info';
const LOGS_COUNT_TO_CONSIDER = 100;

const LOGS_ANALYZER_MODEL_IDS = [
    'anthropic.claude-sonnet-4-20250514-v1:0',
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
    /(?:Error: (?<errorCode>\d+), Severity: (?<severity>\d+), State: (?<state>\d+)|.*?\b(?:(?<keyword>deadlock|error|failed|bottleneck))\b(?<message>.*))/;
const PRE_REQ_MESSAGES = {
    MODEL_NOT_AVAILABLE:
        'Bedrock model %smodelId%s should be enabled in the AWS account and accessible from the region %sregion%s.',
    BEDROCK_TOOL_NOT_FOUND:
        'Ensure that the AWS.Tools.BedrockRuntime module is installed and available in the PowerShell environment.',
    BEDROCK_NW_CONFIGURATION:
        'Ensure that Bedrock Runtime Interface VPC endpoint is present and associated with the SQL node subnet route table.',
    IAM_INSTANCE_PROFILE:
        'Ensure that IAM instance profile attached to the SQL node has bedrock:InvokeModel permission attached.',
    WLMDB_CREDENTIALS:
        'Ensure that the credentials selected is valid and have the permission bedrock:GetFoundationModelAvailability and bedrock:ListInferenceProfiles permissions attached.'
};

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
    MSSQL_ERROR_PATTERN,
    PRE_REQ_MESSAGES
};
