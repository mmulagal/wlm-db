import { BedrockRuntimeClient, ConversationRole, ConverseStreamCommand, Message, ToolConfiguration } from "@aws-sdk/client-bedrock-runtime";
import { Readable } from "node:stream";

interface ToolUse {
    toolUseId?: string;
    name?: string;
    input?: string;
}
interface MessageObj {
    role?: ConversationRole;
    content?: Array<{ text?: string; toolUse?: ToolUse }>;
    user?: string;
}

export default async function streamMessages(client: BedrockRuntimeClient, modelId: string, messages: MessageObj[], toolConfig?: ToolConfiguration) {
    const command = new ConverseStreamCommand({
        modelId,
        messages: messages as Message[],
        toolConfig,
        inferenceConfig: {
            maxTokens: 2048, temperature: 0.5, topP: 0.9
        }
    });

    const response = await client.send(command);
    const stream = response.stream as Readable;

    let stopReason = "";
    const message: MessageObj = { content: [] };
    let text = '';
    let toolUse: ToolUse = {};

    for await (const chunk of stream) {
        let chunkStr;
        if (typeof chunk === 'object') {
            chunkStr = JSON.stringify(chunk);
        } else {
            chunkStr = chunk.toString();
        }
        let chunkJson;
        try {
            chunkJson = JSON.parse(chunkStr);
        } catch (error) {
            console.error("Failed to parse chunk as JSON:", error);
            continue; // Skip this chunk if it cannot be parsed
        }

        if (chunkJson?.messageStart) {
            message.role = chunkJson.messageStart.role as ConversationRole;
        } else if (chunkJson?.contentBlockStart) {
            const tool = chunkJson.contentBlockStart.start.toolUse;
            toolUse = { toolUseId: tool.toolUseId, name: tool.name };
        } else if (chunkJson?.contentBlockDelta) {
            const delta = chunkJson.contentBlockDelta.delta;
            if (delta.toolUse) {
                toolUse.input = (toolUse.input || '') + delta.toolUse.input;
            } else if (delta.text) {
                text += delta.text;
                // if (toolConfig?.logToConsole) {
                //     process.stdout.write(delta.text);
                // }
            }
        } else if (chunkJson.contentBlockStop) {
            if (toolUse.input) {
                toolUse.input = JSON.parse(toolUse.input);
                message.content?.push({ toolUse });
                toolUse = {};
            } else {
                message.content?.push({ text });
                text = '';
            }
        } else if (chunkJson.messageStop) {
            stopReason = chunkJson.messageStop.stopReason;
        }
    }

    return { stopReason, message };
}
