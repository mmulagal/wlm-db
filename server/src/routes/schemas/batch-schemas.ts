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
    summary: 'Make concurrent API calls',
    description: 'Make the batch of API calls concurrently',
    body: BatchRequestBody,
    response: {
        200: BatchResponse
    }
};

export { BatchSchema };
