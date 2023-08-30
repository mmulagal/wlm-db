import Promise from 'bluebird';
import { gotInstanceForInternalRequest } from '../utils/got';
import { BatchRequestBodyType, SingleBatchResponseType, BatchResponseType } from '../routes/types/batch.types';

import getLogger from '../utils/logger';
import { HTTPAlias } from 'got';

const logger = getLogger();

export default async function executeBatchApiCalls(requestBody: BatchRequestBodyType) {
    logger.info('Executing Batch Api calls', requestBody);

    const methodsWithPayload = ['POST', 'PUT', 'PATCH'];

    const allApiResponse: BatchResponseType = await Promise.map(
        requestBody,
        async singleRequest => {
            const responseData: SingleBatchResponseType = {};
            const { url, headers, payload, method } = singleRequest;

            try {
                // const { token } = await getServiceToken();

                const response = await gotInstanceForInternalRequest[method.toLowerCase() as HTTPAlias](url, {
                    headers: {
                        ...headers
                        // [HEADERS.AUTHORIZATION]: token
                    },
                    ...(methodsWithPayload.includes(method) && { json: payload })
                });
                // logger.info('response here', response);
                responseData.data = response ? response : 'Success';
                return responseData;
            } catch (err: any) {
                const errMsg = `Failed to make the batch api call. ${err.message}`;
                logger.warn(errMsg);
                responseData.error = errMsg;
                return responseData;
            }
        },
        { concurrency: 2 }
    );

    return allApiResponse;
}
