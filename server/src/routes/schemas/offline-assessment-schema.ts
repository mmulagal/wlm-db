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
    UploadOfflineAssessmentFileBody,
    OfflineAssessmentDatabasesResponse,
    OfflineAssessmentDatabasesPerAccountResponse
} from '../types/offline-assessment.types';
import { MSSQLDriftAssessmentResponse } from '../types/mssql-continuous-optimisation.types';
import { OracleDriftAssessmentResponse } from '../types/oracle-continuous-optimization.types';
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
    summary: `Upload ${databaseType} one-time assessment JSON`,
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
    summary: `Get ${databaseType} one-time assessment results`,
    description: `Get one-time WAD assessment by resource ID and database instance ID with drift assessment results for ${databaseType}`,
    tags: getOfflineAssessmentTags(databaseType),
    params: OfflineAssessmentGetByIdParams,
    querystring: OfflineAssessmentGetByIdQueryParams,
    response: {
        200: databaseType === DatabaseTypes.ORACLE ? OracleDriftAssessmentResponse : MSSQLDriftAssessmentResponse
    }
});

const OfflineAssessmentDownloadSchema = (databaseType?: string) => ({
    summary: `Download ${databaseType} one-time assessment script`,
    description: `Download one-time assessment script as ZIP file for ${databaseType}`,
    tags: getOfflineAssessmentTags(databaseType),
    params: OfflineAssessmentDownloadPathParams
    // No response schema for binary content
});

const OfflineAssessmentListSchema = (databaseType?: string) => ({
    summary: `List ${databaseType} one-time assessments`,
    description: `List all ${databaseType} one-time assessments in an account with optional filtering and pagination`,
    tags: getOfflineAssessmentTags(databaseType),
    params: OfflineAssessmentPathParams,
    querystring: OfflineAssessmentListQueryParams,
    response: {
        200: OfflineAssessmentListResponse
    }
});

const DeleteOfflineAssessment = (databaseType?: string) => ({
    tags: getOfflineAssessmentTags(databaseType),
    summary: `Delete ${databaseType} one-time assessment record`,
    description: `Delete ${databaseType} one-time assessment record`,
    params: Type.Object({
        accountId: Type.String({ description: 'The account ID' }),
        databaseHostIds: Type.String({ description: 'The resource IDs for the offline assessment record' })
    }),
    response: {
        200: Type.Object({
            count: Type.Number()
        })
    }
});

const OfflineAssessmentDatabasesSchema = (databaseType?: string) => ({
    summary: `List databases for ${databaseType} one-time assessment`,
    description: `Returns a list of user databases and their storage details (LUNs, size, file system) from a ${databaseType} one-time WAD offline assessment record`,
    tags: getOfflineAssessmentTags(databaseType),
    params: OfflineAssessmentGetByIdParams,
    querystring: OfflineAssessmentGetByIdQueryParams,
    response: {
        200: OfflineAssessmentDatabasesResponse
    }
});

const OfflineAssessmentDatabasesPerAccountSchema = (databaseType?: string) => ({
    summary: `List all databases for ${databaseType} one-time assessments at account level`,
    description: `Returns a paginated list of databases grouped by assessment instance across all ${databaseType} one-time WAD offline assessment records for the account`,
    tags: getOfflineAssessmentTags(databaseType),
    params: OfflineAssessmentPathParams,
    querystring: OfflineAssessmentListQueryParams,
    response: {
        200: OfflineAssessmentDatabasesPerAccountResponse
    }
});

export {
    OfflineAssessmentUploadSchema,
    OfflineAssessmentGetByIdSchema,
    OfflineAssessmentDownloadSchema,
    OfflineAssessmentListSchema,
    DeleteOfflineAssessment,
    OfflineAssessmentDatabasesSchema,
    OfflineAssessmentDatabasesPerAccountSchema,
    getOfflineAssessmentTags
};
