import { RouteTags } from '../../utils/consts';
import { CredentialsIdParams } from '../types/generic.types';
import {
    StorageSavingsRequestParams,
    StorageSavingsRequestBody,
    StorageSavingsResponse,
    StorageSavingsCalculationsMetricsResponse,
    ManualStorageSavingsRequestBody,
    ManualStorageSavingsRequestParams,
    InternalUpdateInstRecQueryString,
    BulkStorageSavingsRequestBody,
    BulkStorageSavingsResponse,
    BulkStorageSavingsCalculationsMetricsResponse,
    OracleBulkStorageSavingsRequestBody
} from '../types/storage-savings.types';

const internalUpdateRecommendationPreferenceSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    hide: process.env.NODE_ENV === 'production',
    summary: 'Internal API to update recommendation preference',
    description: 'Internal API to update recommendation preference',
    querystring: InternalUpdateInstRecQueryString,
    response: {
        202: {}
    }
};

const getEbsStorageSavingsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'EBS Storage savings calculations for MSSQL server',
    description: 'Calculates the storage savings for MSSQL server if FSxN is used instead of EBS',
    params: StorageSavingsRequestParams,
    body: StorageSavingsRequestBody,
    response: {
        200: StorageSavingsResponse
    }
};

const getFsxwStorageSavingsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'FSxW Storage savings calculations for MSSQL server',
    description: 'Calculates the storage savings for MSSQL server if FSxN is used instead of FSxW',
    params: StorageSavingsRequestParams,
    body: StorageSavingsRequestBody,
    response: {
        200: StorageSavingsResponse
    }
};

const getEbsStorageSavingsCalculationMetricsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'EBS Storage savings calculation metrics for MSSQL server',
    description: 'Retrieves the calculation metrics for storage savings in MSSQL server if FSxN is used instead of EBS',
    params: StorageSavingsRequestParams,
    body: StorageSavingsRequestBody,
    response: {
        200: StorageSavingsCalculationsMetricsResponse
    }
};

const getFsxwStorageSavingsCalculationMetricsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'FSxW Storage savings calculation metrics for MSSQL server',
    description:
        'Retrieves the calculation metrics for storage savings in MSSQL server if FSxN is used instead of FSxW',
    params: StorageSavingsRequestParams,
    body: StorageSavingsRequestBody,
    response: {
        200: StorageSavingsCalculationsMetricsResponse
    }
};

const getEbsManualStorageSavingsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'EBS Manual mode storage savings calculations for MSSQL server',
    description: 'Calculates the storage savings for MSSQL server if FSxN is used instead of EBS in manual mode',
    params: ManualStorageSavingsRequestParams,
    body: ManualStorageSavingsRequestBody,
    response: {
        200: StorageSavingsResponse
    }
};

const getFsxwManualStorageSavingsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'FSxW Manual mode storage savings calculations for MSSQL server',
    description: 'Calculates the storage savings for MSSQL server if FSxN is used instead of FSxW in manual mode',
    params: ManualStorageSavingsRequestParams,
    body: ManualStorageSavingsRequestBody,
    response: {
        200: StorageSavingsResponse
    }
};

const getEbsManualStorageSavingsCalculationMetricsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'EBS Manual mode storage savings calculation metrics for MSSQL server',
    description:
        'Retrieves the calculation metrics for storage savings in MSSQL server if FSxN is used instead of EBS in manual mode',
    params: ManualStorageSavingsRequestParams,
    body: ManualStorageSavingsRequestBody,
    response: {
        200: StorageSavingsCalculationsMetricsResponse
    }
};

const getFsxwManualStorageSavingsCalculationMetricsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'FSxW Manual mode storage savings calculation metrics for MSSQL server',
    description:
        'Retrieves the calculation metrics for storage savings in MSSQL server if FSxN is used instead of FSxW in manual mode',
    params: ManualStorageSavingsRequestParams,
    body: ManualStorageSavingsRequestBody,
    response: {
        200: StorageSavingsCalculationsMetricsResponse
    }
};

const getEbsBulkStorageSavingsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'Bulk EBS Storage savings calculations for MSSQL server',
    description: 'Calculates the storage savings for MSSQL server if FSxN is used instead of EBS in bulk mode',
    params: CredentialsIdParams,
    body: BulkStorageSavingsRequestBody,
    response: {
        200: BulkStorageSavingsResponse
    }
};

const getEbsBulkStorageSavingsCalculationMetricsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'Bulk EBS Storage savings calculation metrics for MSSQL server',
    description:
        'Retrieves the calculation metrics for storage savings in MSSQL server if FSxN is used instead of EBS in bulk mode',
    params: CredentialsIdParams,
    body: BulkStorageSavingsRequestBody,
    response: {
        200: BulkStorageSavingsCalculationsMetricsResponse
    }
};

const getOracleEbsBulkStorageSavingsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'Bulk EBS storage savings calculations for Oracle on EC2',
    description:
        'Calculates storage savings for Oracle database workloads on EC2 with EBS when using FSx for ONTAP instead.',
    params: CredentialsIdParams,
    body: OracleBulkStorageSavingsRequestBody,
    response: {
        200: BulkStorageSavingsResponse
    }
};

const getOracleEbsBulkStorageSavingsCalculationMetricsSchema = {
    tags: [RouteTags.STORAGE_SAVINGS],
    summary: 'Bulk EBS storage savings calculation metrics for Oracle on EC2',
    description: 'Returns detailed calculation metrics for Oracle bulk EBS versus FSx for ONTAP savings.',
    params: CredentialsIdParams,
    body: OracleBulkStorageSavingsRequestBody,
    response: {
        200: BulkStorageSavingsCalculationsMetricsResponse
    }
};

export {
    internalUpdateRecommendationPreferenceSchema,
    getEbsStorageSavingsSchema,
    getEbsStorageSavingsCalculationMetricsSchema,
    getEbsManualStorageSavingsSchema,
    getEbsManualStorageSavingsCalculationMetricsSchema,
    getFsxwStorageSavingsSchema,
    getFsxwStorageSavingsCalculationMetricsSchema,
    getFsxwManualStorageSavingsSchema,
    getFsxwManualStorageSavingsCalculationMetricsSchema,
    getEbsBulkStorageSavingsSchema,
    getEbsBulkStorageSavingsCalculationMetricsSchema,
    getOracleEbsBulkStorageSavingsSchema,
    getOracleEbsBulkStorageSavingsCalculationMetricsSchema
};
