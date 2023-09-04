import Promise from 'bluebird';
import { HTTPAlias } from 'got';
import { gotInstanceForInternalRequest } from '../utils/got';
import { BatchRequestBodyType, SingleBatchResponseType, BatchResponseType } from '../routes/types/batch.types';
import { METHODS_WITH_PAYLOAD, HEADERS, USER_TOKEN, BATCH_API_CONCURRENCY_LIMIT } from '../utils/consts';
import getLogger from '../utils/logger';

import { getAsyncLocalStorageResource } from '../utils/async-local-storage';

const logger = getLogger();

export default async function executeBatchApiCalls(requestBody: BatchRequestBodyType) {
    logger.info('Executing Batch Api calls', requestBody);

    const allApiResponse: BatchResponseType = await Promise.map(
        requestBody,
        async singleRequest => {
            const responseData: SingleBatchResponseType = {};
            const { url, headers, payload, method } = singleRequest;

            try {
                const response = await gotInstanceForInternalRequest[method.toLowerCase() as HTTPAlias](url, {
                    headers: {
                        ...headers,
                        [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource<string>(USER_TOKEN)
                    },
                    ...(METHODS_WITH_PAYLOAD.includes(method) && { json: payload })
                });

                responseData.data = response ? response : 'Success';
                return responseData;
            } catch (err: any) {
                const errMsg = `Failed to execute the batch api call. ${err.message}`;
                logger.error(errMsg);
                responseData.error = errMsg;
                return responseData;
            }
        },
        { concurrency: BATCH_API_CONCURRENCY_LIMIT }
    );

    return allApiResponse;
}
