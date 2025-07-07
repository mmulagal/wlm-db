import { ConversationRole } from '@aws-sdk/client-bedrock-runtime';


interface Content {
    text?: string;
    toolUse?: ToolUse;
    toolResult?: {
        toolUseId?: string;
        content?: Array<Content>;
    };
}

interface ToolUse {
    toolUseId?: string;
    name?: string;
    input?: string;
}

interface MessageObj {
    role?: ConversationRole;
    content?: Array<Content>;
    user?: string;
}

interface ToolSpec {
    toolSpec: {
        name: string;
        description: string;
        inputSchema: {
            json: {
                type: string;
                properties: {
                    logsFolderPath?: {
                        type: string;
                        description: string;
                    };
                    script?: {
                        type: string;
                        description: string;
                    };
                };
                required: string[];
            };
        };
    };
}

interface MsSqlErrorLog {
    timestamp: string;
    spid: string;
    errorCode: string;
    severity: string;
    state: string;
    context: string;
    error: string;
}

interface ErrorLog {
    error: string;
    context: string;
    cause: string;
    count: number;
    severity?: string | number;
    firstOccurrence?: number;
    lastOccurrence?: number;
    errorCode?: string;
    uniqueErrorKey?: string;
    hourlyErrorCounts?: Array<{
        hour: number;
        count: number;
    }>;
    tokenUsageForCauseIdentification?: {
        input: number;
        output: number;
        total: number;
    };
}

interface ErrorLogWithAdditionalInfo extends ErrorLog {
    additionalInfo?: string;
}

interface ErrorLogWithScriptAndDetails extends ErrorLog {
    sql?: { query: string }[];
}

interface AgentArgs {
    logsPath: string;
    sqlAuthEnabled: boolean;
    databaseInstanceName: string;
    jobId: string;
    instanceId: string;
    logLevel: string;
    region: string;
    modelId: string;
    modelRegion: string;
    timestamp: number;
    logsCountToConsider: number;
    topP: number;
    temperature: number;
    maxTokens: number;
}

export {
    MessageObj,
    ToolUse,
    ErrorLog,
    ToolSpec,
    MsSqlErrorLog,
    ErrorLogWithAdditionalInfo,
    ErrorLogWithScriptAndDetails,
    AgentArgs
};
