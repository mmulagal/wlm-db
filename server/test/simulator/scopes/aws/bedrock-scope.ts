import { HttpResponse } from '@smithy/types';
import nock from 'nock';

nock('https://bedrock.us-east-1.amazonaws.com')
    .persist(true)
    .get(/^\/foundation-model-availability\/anthropic\.claude-3-7-sonnet-20250219-v1:0$/)
    .reply(200, () => {
        return {
            statusCode: 200,
            headers: {
                date: 'Tue, 13 May 2025 01:44:18 GMT',
                'content-type': 'application/json',
                'content-length': '226',
                connection: 'keep-alive',
                'x-amzn-requestid': '62d8fe76-4d38-4f58-be0e-2984aa2d021f'
            },
            body: {
                agreementAvailability: {
                    status: 'AVAILABLE'
                },
                entitlementAvailability: 'AVAILABLE',
                modelAvailability: 'AVAILABLE'
            }
        } as HttpResponse;
    });
