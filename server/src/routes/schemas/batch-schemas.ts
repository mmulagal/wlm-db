import { RouteTags } from '../../utils/consts';
import { BatchParams, BatchRequestBody, BatchResponse } from '../types/batch.types';

// Base Request for Batch Routes
const baseRequest = {
    tags: [RouteTags.BATCH],
    params: BatchParams
};

// Batch Schema
const BatchSchema = {
    ...baseRequest,
    description: 'Make the batch of api calls concurrently',
    body: BatchRequestBody,
    response: {
        200: BatchResponse
    }
};

export { BatchSchema };
