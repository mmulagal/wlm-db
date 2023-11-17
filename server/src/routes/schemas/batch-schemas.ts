import { RouteTags } from '../../utils/consts';
import { BatchParams, BatchRequestBody, BatchResponse } from '../types/batch.types';

// Base Request for Batch Routes
const BaseRequest = {
    tags: [RouteTags.BATCH],
    params: BatchParams
};

// Batch Schema
const BatchSchema = {
    ...BaseRequest,
    summary: 'Make concurrent api calls',
    description: 'Make the batch of api calls concurrently',
    body: BatchRequestBody,
    response: {
        200: BatchResponse
    }
};

export { BatchSchema };
