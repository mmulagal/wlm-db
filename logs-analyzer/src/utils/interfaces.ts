import { ConversationRole } from '@aws-sdk/client-bedrock-runtime';

interface ErrorLg {
    errorContext: string;
    errorMessage: string;
    errorCount: number;
    severity: string;
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

interface ErrorLogWithScript {
    error: string;
    cause: string;
    count: number;
    severity: string | number;
    sql: { query: string }[];
}

export { MessageObj, ToolUse, ErrorLg, ToolSpec, MsSqlErrorLog, ErrorLogWithScript };
