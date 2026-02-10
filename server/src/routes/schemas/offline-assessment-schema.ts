import { Type } from 'typebox';
import {
    OfflineAssessmentUploadPathParams,
    OfflineAssessmentUploadQueryParams,
    OfflineAssessmentUploadResponse,
    OfflineAssessmentGetByIdParams,
    OfflineAssessmentGetByIdQueryParams,
    OfflineAssessmentDownloadPathParams,
    OfflineAssessmentPathParams,
    OfflineAssessmentListQueryParams,
    OfflineAssessmentListResponse,
    UploadOfflineAssessmentFileBody
} from '../types/offline-assessment.types';
import { MSSQLDriftAssessmentResponse } from '../types/mssql-continuous-optimisation.types';
import { RouteTags, DatabaseTypes } from '../../utils/consts';

/**
 * Helper function to get the appropriate route tag(s) for a database type
 */
const getOfflineAssessmentTags = (databaseType?: string) => {
    if (databaseType === DatabaseTypes.ORACLE) {
        return [RouteTags.ORACLE_ASSESSMENT];
    }
    if (databaseType === DatabaseTypes.MS_SQL_SERVER) {
        return [RouteTags.MSSQL_ASSESSMENT];
    }
    // Default: include both tags for generic routes
    return [RouteTags.MSSQL_ASSESSMENT, RouteTags.ORACLE_ASSESSMENT];
};

const OfflineAssessmentUploadSchema = (databaseType?: string) => ({
    summary: `Upload ${databaseType} offline assessment JSON`,
    description: `Upload one-time WAD (Workload Assessment and Discovery) JSON file for ${databaseType} instances`,
    tags: getOfflineAssessmentTags(databaseType),
    params: OfflineAssessmentUploadPathParams,
    querystring: OfflineAssessmentUploadQueryParams,
    body: UploadOfflineAssessmentFileBody,
    response: {
        201: OfflineAssessmentUploadResponse,
        400: Type.Object({
            message: Type.String()
        })
    }
});

const OfflineAssessmentGetByIdSchema = (databaseType?: string) => ({
    summary: `Get ${databaseType} offline assessment results`,
    description: `Get one-time WAD assessment by resource ID and database instance ID with drift assessment results for ${databaseType} `,
    tags: getOfflineAssessmentTags(databaseType),
    params: OfflineAssessmentGetByIdParams,
    querystring: OfflineAssessmentGetByIdQueryParams,
    response: {
        200: MSSQLDriftAssessmentResponse
    }
});

const OfflineAssessmentDownloadSchema = (databaseType?: string) => ({
    summary: `Download ${databaseType} assessment script`,
    description: `Download offline assessment script as ZIP file for ${databaseType} `,
    tags: getOfflineAssessmentTags(databaseType),
    params: OfflineAssessmentDownloadPathParams
    // No response schema for binary content
});

const OfflineAssessmentListSchema = (databaseType?: string) => ({
    summary: `List ${databaseType}  offline assessments`,
    description: `List all ${databaseType} offline assessments in an account with optional filtering and pagination`,
    tags: getOfflineAssessmentTags(databaseType),
    params: OfflineAssessmentPathParams,
    querystring: OfflineAssessmentListQueryParams,
    response: {
        200: OfflineAssessmentListResponse
    }
});

export {
    OfflineAssessmentUploadSchema,
    OfflineAssessmentGetByIdSchema,
    OfflineAssessmentDownloadSchema,
    OfflineAssessmentListSchema,
    getOfflineAssessmentTags
};
