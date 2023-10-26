import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { Sha256 } from '@aws-crypto/sha256-js';
import { MODEL, BEDROCK_REGION } from '../chatbot/consts';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function getBedrockClient() {
    logger.debug('Getting bedrock client:');

    return new BedrockRuntimeClient({
        region: BEDROCK_REGION,
        sha256: Sha256
    });
}

async function sendPrompt(prompt: string) {
    logger.debug('Send prompt to bedrock', { prompt });
    const client = await getBedrockClient();

    const command = new InvokeModelWithResponseStreamCommand({
        modelId: MODEL,
        // ...input,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            prompt,
            max_tokens_to_sample: 1500,
            temperature: 1,
            top_k: 250,
            top_p: 0.999,
            stop_sequences: ['\n\nHuman:'],
            anthropic_version: 'bedrock-2023-05-31'
        })
    });
    const { body } = await client.send(command);

    let resp = '';
    if (body) {
        for await (const data of body) {
            if (data?.chunk?.bytes) {
                const { completion } = JSON.parse(Buffer.from(data?.chunk?.bytes).toString());
                resp += completion;
            }
        }
    }

    logger.debug(resp);
    return { completion: resp };
}

export default sendPrompt;
export { sendPrompt };
