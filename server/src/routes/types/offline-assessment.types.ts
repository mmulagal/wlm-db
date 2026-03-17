import { Static, Type } from 'typebox';
import { API_DESCRIPTION } from '../../utils/schema-description-consts';
import { MSSQLDriftAssessmentResponse } from './mssql-continuous-optimisation.types';

// Upload file body schema (similar to onprem-tco)
const UploadOfflineAssessmentFileBody = Type.Object({
    fileName: Type.String(),
    fileContent: Type.String()
});
type UploadOfflineAssessmentFileBodyType = Static<typeof UploadOfflineAssessmentFileBody>;

// Path parameters for upload (only accountId required)
const OfflineAssessmentUploadPathParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 1 })
});

type OfflineAssessmentUploadPathParamsType = Static<typeof OfflineAssessmentUploadPathParams>;

// Query parameters for upload
const OfflineAssessmentUploadQueryParams = Type.Object({
    credentialsId: Type.Optional(Type.String({ description: API_DESCRIPTION.CREDENTIALS_ID_DESC })),
    region: Type.Optional(Type.String({ description: API_DESCRIPTION.AWS_REGION_CODE_DESC }))
});

type OfflineAssessmentUploadQueryParamsType = Static<typeof OfflineAssessmentUploadQueryParams>;

// Path parameters for list (only accountId required)
const OfflineAssessmentPathParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 1 })
});

type OfflineAssessmentPathParamsType = Static<typeof OfflineAssessmentPathParams>;

// Query parameters for listing WAD assessments
const OfflineAssessmentListQueryParams = Type.Object({
    pageSize: Type.Optional(Type.Number({ description: 'Number of items per page', default: 50 })),
    nextToken: Type.Optional(Type.String({ description: 'Pagination token' })),
    credentialsId: Type.Optional(Type.String({ description: API_DESCRIPTION.CREDENTIALS_ID_DESC })),
    region: Type.Optional(Type.String({ description: API_DESCRIPTION.AWS_REGION_CODE_DESC }))
});

type OfflineAssessmentListQueryParamsType = Static<typeof OfflineAssessmentListQueryParams>;

// List response
const OfflineAssessmentListResponse = Type.Object({
    items: Type.Array(
        Type.Object({
            resourceId: Type.String(),
            databaseInstanceId: Type.String(),
            databaseInstanceName: Type.Optional(Type.String()),
            credentialsId: Type.Optional(Type.String()),
            region: Type.Optional(Type.String()),
            regionName: Type.Optional(Type.String()),
            vmName: Type.Optional(Type.String()),
            vmInstanceId: Type.Optional(Type.String()),
            virtualNetworkId: Type.Optional(Type.String()),
            virtualNetworkName: Type.Optional(Type.String()),
            numberOfDatabaseInstances: Type.Optional(Type.Number()),
            agName: Type.Optional(Type.String()),
            clusterNodes: Type.Optional(
                Type.Array(
                    Type.Object({
                        vmInstanceId: Type.String(),
                        nodeName: Type.Optional(Type.String()),
                        nodeState: Type.Optional(Type.String())
                    })
                )
            ),
            assessments: Type.Optional(MSSQLDriftAssessmentResponse),
            error: Type.Optional(Type.String())
        })
    ),
    count: Type.Number(),
    nextToken: Type.Optional(Type.String())
});

type OfflineAssessmentListResponseType = Static<typeof OfflineAssessmentListResponse>;

// Upload response - returns only job ID
const OfflineAssessmentUploadResponse = Type.Object({
    jobId: Type.String({ description: 'Job ID for the upload operation' })
});

type OfflineAssessmentUploadResponseType = Static<typeof OfflineAssessmentUploadResponse>;

// Get by ID path params
const OfflineAssessmentGetByIdParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 1 }),
    resourceId: Type.String({ description: 'EC2 instance ID', minLength: 1 }),
    databaseInstanceId: Type.String({ description: 'Database instance ID', minLength: 1 })
});

type OfflineAssessmentGetByIdParamsType = Static<typeof OfflineAssessmentGetByIdParams>;

// Get by ID query params (same as drift assessment)
const OfflineAssessmentGetByIdQueryParams = Type.Object({
    fields: Type.Optional(
        Type.String({
            description: 'Comma-separated list of assessment fields to include (e.g., storage, network, performance)'
        })
    ),
    credentialsId: Type.Optional(Type.String({ description: API_DESCRIPTION.CREDENTIALS_ID_DESC })),
    region: Type.Optional(Type.String({ description: API_DESCRIPTION.AWS_REGION_CODE_DESC }))
});

type OfflineAssessmentGetByIdQueryParamsType = Static<typeof OfflineAssessmentGetByIdQueryParams>;

// Download script path params
const OfflineAssessmentDownloadPathParams = Type.Object({
    accountId: Type.String({ description: API_DESCRIPTION.ACCOUNT_ID_DESC, minLength: 1 })
});

type OfflineAssessmentDownloadPathParamsType = Static<typeof OfflineAssessmentDownloadPathParams>;

// Download script query params
const OfflineAssessmentDownloadQueryParams = Type.Object({
    databaseType: Type.Optional(
        Type.String({
            description: 'Database type for the assessment script (mssql, oracle, pgsql). Defaults to mssql.',
            default: 'mssql'
        })
    )
});

type OfflineAssessmentDownloadQueryParamsType = Static<typeof OfflineAssessmentDownloadQueryParams>;

export {
    OfflineAssessmentUploadPathParams,
    OfflineAssessmentUploadPathParamsType,
    OfflineAssessmentUploadQueryParams,
    OfflineAssessmentUploadQueryParamsType,
    OfflineAssessmentPathParams,
    OfflineAssessmentPathParamsType,
    OfflineAssessmentListQueryParams,
    OfflineAssessmentListQueryParamsType,
    OfflineAssessmentListResponse,
    OfflineAssessmentListResponseType,
    OfflineAssessmentUploadResponse,
    OfflineAssessmentUploadResponseType,
    OfflineAssessmentGetByIdParams,
    OfflineAssessmentGetByIdParamsType,
    OfflineAssessmentGetByIdQueryParams,
    OfflineAssessmentGetByIdQueryParamsType,
    OfflineAssessmentDownloadPathParams,
    OfflineAssessmentDownloadPathParamsType,
    OfflineAssessmentDownloadQueryParams,
    OfflineAssessmentDownloadQueryParamsType,
    UploadOfflineAssessmentFileBody,
    UploadOfflineAssessmentFileBodyType
};
