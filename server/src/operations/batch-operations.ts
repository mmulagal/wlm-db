import Promise from 'bluebird';
import { gotInstanceForInternalRequest } from '../utils/got';
import { BatchRequestBodyType, SingleBatchResponseType, BatchResponseType } from '../routes/types/batch.types';
import { METHODS_WITH_PAYLOAD } from '../utils/consts';
import getLogger from '../utils/logger';
import { HTTPAlias } from 'got';

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
                        ...headers
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
        { concurrency: 10 }
    );

    return allApiResponse;
}
