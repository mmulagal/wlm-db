import Promise from 'bluebird';
import { HTTPMethods } from 'fastify';
import { isNil, omitBy } from 'lodash-es';
import { BatchRequestBodyType, SingleBatchResponseType, BatchResponseType } from '../routes/types/batch.types';
import { METHODS_WITH_PAYLOAD, HEADERS, USER_TOKEN, BATCH_API_CONCURRENCY_LIMIT } from '../utils/consts';
import getLogger from '../utils/logger';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';

const logger = getLogger();

export default async function executeBatchApiCalls(instance, requestBody: BatchRequestBodyType) {
    logger.info('Executing Batch Api calls', requestBody);

    const allApiResponse: BatchResponseType = await Promise.map(
        requestBody,
        async singleRequest => {
            const responseData: SingleBatchResponseType = {};
            const { url, headers, payload, method } = singleRequest;

            try {
                const response = await instance.inject({
                    method: method as HTTPMethods,
                    url,
                    ...(METHODS_WITH_PAYLOAD.includes(method) && { payload: payload }),
                    headers: omitBy(
                        {
                            ...headers,
                            [HEADERS.AUTHORIZATION]: getAsyncLocalStorageResource<string>(USER_TOKEN)
                        },
                        isNil
                    )
                });

                if (response?.statusCode >= 400) {
                    responseData.error = JSON.parse(response.payload);
                    return responseData;
                } else {
                    responseData.data = response ? JSON.parse(response.payload) : 'Success';
                    return responseData;
                }
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
