import { RouteTags } from '../../utils/consts';
import {
    StorageSavingsRequestParams,
    StorageSavingsRequestBody,
    StorageSavingsResponse,
    StorageSavingsCalculationsMetricsResponse,
    ManualStorageSavingsRequestBody,
    ManualStorageSavingsRequestParams
} from '../types/storage-savings.types';

const internalUpdateRecommendationPreferenceSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    hide: process.env.NODE_ENV === 'production',
    summary: 'Internal API to update recommendation preference',
    description: 'Internal API to update recommendation preference',
    response: {
        200: {}
    }
};

const getStorageSavingsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'Storage savings calculations for MSSQL server',
    description: 'Calculates the storage savings for MSSQL server if FSX is used instead of EBS',
    params: StorageSavingsRequestParams,
    body: StorageSavingsRequestBody,
    response: {
        200: StorageSavingsResponse
    }
};

const getStorageSavingsCalculationMetricsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'Storage savings calculation metrics for MSSQL server',
    description: 'Retrieves the calculation metrics for storage savings in MSSQL server if FSX is used instead of EBS',
    params: StorageSavingsRequestParams,
    body: StorageSavingsRequestBody,
    response: {
        200: StorageSavingsCalculationsMetricsResponse
    }
};

const getManualStorageSavingsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'Manual mode storage savings calculations for MSSQL server',
    description: 'Calculates the storage savings for MSSQL server if FSX is used instead of EBS in manual mode',
    params: ManualStorageSavingsRequestParams,
    body: ManualStorageSavingsRequestBody,
    response: {
        200: StorageSavingsResponse
    }
};

const getManualStorageSavingsCalculationMetricsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'Storage savings calculation metrics for MSSQL server',
    description: 'Retrieves the calculation metrics for storage savings in MSSQL server if FSX is used instead of EBS',
    params: ManualStorageSavingsRequestParams,
    body: ManualStorageSavingsRequestBody,
    response: {
        200: StorageSavingsCalculationsMetricsResponse
    }
};

export {
    internalUpdateRecommendationPreferenceSchema,
    getStorageSavingsSchema,
    getStorageSavingsCalculationMetricsSchema,
    getManualStorageSavingsSchema,
    getManualStorageSavingsCalculationMetricsSchema
};
