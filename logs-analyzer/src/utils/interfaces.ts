import { ConversationRole } from '@aws-sdk/client-bedrock-runtime';

interface ErrorLg {
    errorContext: string;
    errorMessage: string;
    errorCount: number;
    severity: string;
    firstOccurrence?: number;
    lastOccurrence?: number;
    errorCode?: string;
}

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
    cause: string;
    count: number;
    severity: string | number;
    firstOccurrence?: string;
    lastOccurrence?: string;
    errorCode?: string;
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
    ErrorLg,
    ToolSpec,
    MsSqlErrorLog,
    ErrorLogWithAdditionalInfo,
    ErrorLogWithScriptAndDetails,
    AgentArgs
};
