import createError from 'http-errors';

import {
    BedrockClient,
    InferenceProfileType,
    ListFoundationModelsCommand,
    paginateListInferenceProfiles
} from '@aws-sdk/client-bedrock';
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { Sha256 } from '@aws-crypto/sha256-js';
import { SignatureV4 } from '@smithy/signature-v4';
import { HttpRequest } from '@smithy/protocol-http';
import { NodeHttpHandler, streamCollector } from '@smithy/node-http-handler';
import { MODEL, BEDROCK_REGION } from '../chatbot/consts';
import getLogger from '../../utils/logger';
import { MODEL_AVAILABILITY_STATUS } from '../../utils/logs-analyzer/logs-analyzer-consts';
import { getCredentialsDetails } from '../../operations/cloud-manager/credentials-operations';
import { AWSSDKCacheParams } from '../../utils/common-types';
import addCacheMiddleware from '../../utils/aws-sdk-middlewares';

const logger = getLogger();

interface BedrockClientParams {
    accountId?: string;
    credentialsId?: string;
    cacheParams?: AWSSDKCacheParams;
    region: string;
}

async function getBedrockClient(params: BedrockClientParams) {
    logger.debug('Getting bedrock client:', params);

    let client: BedrockClient;
    const { accountId, credentialsId, region, cacheParams = {} } = params;

    if (!accountId || !credentialsId) {
        client = new BedrockClient({ region });
    } else {
        const {
            credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
        } = await getCredentialsDetails(credentialsId, accountId);
        const credentials = { accessKeyId, secretAccessKey, sessionToken };

        client = new BedrockClient({
            credentials,
            region,
            sha256: Sha256
        });
    }
    return addCacheMiddleware(client, { ...cacheParams, credentialsId });
}

async function getBedrockRuntimeClient() {
    logger.debug('Getting bedrock runtime client:');

    return new BedrockRuntimeClient({
        region: BEDROCK_REGION,
        sha256: Sha256
    });
}

async function sendPrompt(prompt: string) {
    logger.debug('Send prompt to bedrock', { prompt });
    const client = await getBedrockRuntimeClient();

    const command = new InvokeModelWithResponseStreamCommand({
        modelId: MODEL,
        // ...input,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            prompt,
            max_tokens_to_sample: 1500,
            temperature: 0, // Tunes the degree of randomness in generation. Lower temperatures mean less random generations.
            top_k: 0, // Can be used to reduce repetitiveness of generated tokens. The higher the value, the stronger a penalty is applied to previously present tokens, proportional to how many times they have already appeared in the prompt or prior generation
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

async function getModelAvailability(accountId: string, credentialsId: string, region: string, modelId: string) {
    logger.debug('Get model availability:', { accountId, credentialsId, region, modelId });

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialsDetails(credentialsId, accountId);

    const hostname = `bedrock.${region}.amazonaws.com`;
    const signer = new SignatureV4({
        region,
        service: 'bedrock',
        sha256: Sha256,
        credentials: { accessKeyId, secretAccessKey, sessionToken }
    });
    const signedRequest = await signer.sign(
        new HttpRequest({
            headers: {
                'Content-Type': 'application/json',
                host: hostname
            },
            hostname,
            method: 'GET',
            path: `/foundation-model-availability/${modelId}`
        })
    );

    const client = new NodeHttpHandler();
    const {
        response: { body, statusCode, reason }
    } = await client.handle(new HttpRequest(signedRequest));

    if (statusCode === 200) {
        if (body) {
            const data = await streamCollector(body);
            return JSON.parse(Buffer.from(data).toString()) as {
                agreementAvailability: {
                    status: MODEL_AVAILABILITY_STATUS;
                    errorMessage: string;
                };
                entitlementAvailability: MODEL_AVAILABILITY_STATUS;
                authorizationStatus: string;
                modelId: string;
                regionAvailability: MODEL_AVAILABILITY_STATUS;
            };
        }
        logger.error(`Failed to receive body for model ${modelId} - assuming not available`);
        return {
            agreementAvailability: {
                status: MODEL_AVAILABILITY_STATUS.NOT_AVAILABLE
            },
            entitlementAvailability: MODEL_AVAILABILITY_STATUS.NOT_AVAILABLE
        };
    }

    if (statusCode === 403) {
        const errorMessage = `Access forbidden to model ${modelId} - not authorized to perform this operation`;
        logger.error(errorMessage);
        throw createError(403, errorMessage);
    }
    throw createError(statusCode, `AWS Bedrock Model availablity check failed ${reason}`);
}

async function listInferenceProfiles(accountId: string, credentialsId: string, region: string) {
    logger.debug('List inference profile:', { accountId, credentialsId, region });

    const client = await getBedrockClient({ region, accountId, credentialsId });

    const inferenceProfiles = [];

    const paginator = paginateListInferenceProfiles({ client }, { typeEquals: InferenceProfileType.SYSTEM_DEFINED });

    for await (const { inferenceProfileSummaries = [] } of paginator) {
        inferenceProfiles.push(...inferenceProfileSummaries);
    }
    return inferenceProfiles;
}

async function listFoundationModels(region: string, cacheParams?: AWSSDKCacheParams) {
    logger.info('Listing foundation models', { region, cacheParams });

    const client = await getBedrockClient({ region, cacheParams });
    const command = new ListFoundationModelsCommand({
        byProvider: 'Anthropic',
        byOutputModality: 'TEXT'
    });
    const response = await client.send(command);

    logger.debug('List foundation models response', response);

    return response;
}

export { sendPrompt, getModelAvailability, listInferenceProfiles, listFoundationModels };
