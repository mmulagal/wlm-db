import { HttpResponse } from '@smithy/types';
import nock from 'nock';

import { mockClient } from 'aws-sdk-client-mock';
import {
    BedrockClient,
    InferenceProfileSummary,
    ListFoundationModelsCommand,
    ListFoundationModelsCommandOutput,
    ListInferenceProfilesCommand
} from '@aws-sdk/client-bedrock';

import listInferenceProfilesResponse from '../../responses/aws/list-inference-profile.json';
import listFoundationModelsResponse from '../../responses/aws/list-foundation-models-response.json';

const bedrockMock = mockClient(BedrockClient);

nock(/https?:\/\/bedrock\.(.+)\.amazonaws\.com/)
    .persist(true)
    .get(/^\/foundation-model-availability\/anthropic\.claude-(.+)$/)
    .reply(
        200,
        () =>
            ({
                statusCode: 200,
                headers: {
                    date: 'Tue, 13 May 2025 01:44:18 GMT',
                    'content-type': 'application/json',
                    'content-length': '226',
                    connection: 'keep-alive',
                    'x-amzn-requestid': '62d8fe76-4d38-4f58-be0e-2984aa2d021f'
                },

                agreementAvailability: {
                    status: 'AVAILABLE'
                },
                entitlementAvailability: 'AVAILABLE',
                modelAvailability: 'AVAILABLE'
            } as HttpResponse)
    );

bedrockMock.on(ListInferenceProfilesCommand).resolves({
    inferenceProfileSummaries: (listInferenceProfilesResponse as any[]).map(item => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
    })) as InferenceProfileSummary[]
});

bedrockMock.on(ListFoundationModelsCommand).resolves(listFoundationModelsResponse as ListFoundationModelsCommandOutput);
