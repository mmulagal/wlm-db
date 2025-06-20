import {
    BedrockRuntimeClient,
    ContentBlock,
    ConverseCommand,
    InferenceConfiguration,
    Message,
    ToolConfiguration
} from '@aws-sdk/client-bedrock-runtime';
import { MessageObj, ToolUse } from '../utils/interfaces';

export default async function streamMessages(
    client: BedrockRuntimeClient,
    modelId: string,
    messages: MessageObj[],
    toolConfig?: ToolConfiguration,
    inferenceConfig?: InferenceConfiguration
) {
    const command = new ConverseCommand({
        modelId,
        messages: messages as Message[],
        toolConfig,
        inferenceConfig
    });

    const response = await client.send(command);
    const { stopReason, usage } = response;
    const message: MessageObj = { content: [] };

    message.role = response?.output?.message?.role;

    message.content = response?.output?.message?.content?.map((msgContent: ContentBlock) => {
        if (msgContent.text) {
            return { text: msgContent.text };
        }
        if (msgContent.toolUse) {
            return {
                toolUse: {
                    ...msgContent.toolUse,
                    input:
                        typeof msgContent.toolUse.input === 'string'
                            ? msgContent.toolUse.input
                            : JSON.stringify(msgContent.toolUse.input)
                } as ToolUse
            };
        }
        if (msgContent.toolResult) {
            return { toolResult: msgContent.toolResult };
        }
        return {};
    });

    return { stopReason, message, usage };
}
