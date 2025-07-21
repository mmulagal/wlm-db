import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';
import { AccountIdParams, CredentialsIdParams } from '../types/generic.types';
import {
    DatabaseHostInstanceSummaryParams,
    DatabaseHostOptionalInstanceSummaryParams,
    DatabaseHostSummaryParams
} from '../types/database-hosts.types';

import {
    OptimizeStorageRequestBody,
    DriftAssessmentResponse,
    OptimizeComputeRequestBody,
    OptimizeOperatingSystemRequestBody,
    DriftAssessmentResponsePerHost,
    DriftAssessmentResponsePerAccount,
    BulkOptimizeGeneralRequestBody,
    AvailableSnapshotPoliciesResponse,
    OptimizeResiliencyBody,
    OptimizeGenericRequestBody,
    BulkOptimizeComputeRequestBody,
    BulkOptimizeCloneBody,
    BulkDismissConfigurationRequestBody,
    BulkDismissConfigurationResponse,
    ContinuousOptimizationQueryString,
    AssessmentQueryStringPerAccount,
    BulkOptimizeHASharedStorageBody
} from '../types/continuous-optimization.types';

const resourceRequest = {
    tags: [RouteTags.RESOURCE],
    params: CredentialsIdParams
};

const DriftAssessmentDataCollection = {
    ...resourceRequest,
    summary: 'Get database instance parameters drift from recommended settings',
    description: 'Get database instance parameters drift from recommended settings',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        200: DriftAssessmentResponse
    }
};

const DriftAssessmentPerHost = {
    ...resourceRequest,
    summary: 'Get database parameter drift from recommended settings for all instances on a host',
    description: 'Get database parameters drift from recommended settings for all instances on a host',
    params: DatabaseHostSummaryParams,
    tags: [RouteTags.ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        200: DriftAssessmentResponsePerHost
    }
};

const TriggerDriftAssessmentSchema = {
    ...resourceRequest,
    summary: 'Trigger assessment for a database instance',
    description: 'Trigger assessment for best practice misalignments on a managed database instance',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        202: Type.Object({
            jobId: Type.String()
        })
    }
};

const OptimizeStorageSchemaDescription =
    'Fix storage parameters as per the best practice for the selected database instance.';

const OptimizeStorageSchema = {
    ...resourceRequest,
    summary: 'Fix storage for a database instance',
    description: OptimizeStorageSchemaDescription,
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ASSESSMENT],
    body: OptimizeStorageRequestBody,
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const OptimizeSizingSchema = {
    ...resourceRequest,
    summary: 'Fix storage sizing for a database instance',
    description: 'Fix sizing parameters as per the best practice for the selected database instance.',
    params: DatabaseHostInstanceSummaryParams,
    body: OptimizeGenericRequestBody,
    tags: [RouteTags.ASSESSMENT],
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const OptimizeComputeSchema = {
    ...resourceRequest,
    summary: 'Fix compute rightsizing for a database instance',
    description: 'Fix compute rightsizing as per the best practice for the selected database instance.',
    params: DatabaseHostInstanceSummaryParams,
    body: OptimizeComputeRequestBody,
    tags: [RouteTags.ASSESSMENT],
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const OptimizeOperatingSystemSchema = {
    ...resourceRequest,
    summary: 'Fix MPIO settings for a database instance',
    description: 'Fix MPIO settings parameters as per the best practice for the selected database instance.',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ASSESSMENT],
    body: OptimizeOperatingSystemRequestBody,
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const OptimizeStorageTierSchema = {
    ...resourceRequest,
    summary: 'Fix storage-tier settings for a database instance',
    description: 'Fix storage-tier parameters as per the best practice for the selected database instance.',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ASSESSMENT],
    body: OptimizeGenericRequestBody,
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const DriftAssessmentPerAccount = {
    ...resourceRequest,
    summary: 'Get database parameter drift from recommended settings for all registered instances on an account',
    description: 'Get database parameter drift from recommended settings for all registered instances on an account',
    params: CredentialsIdParams,
    tags: [RouteTags.ASSESSMENT],
    querystring: AssessmentQueryStringPerAccount,
    response: {
        200: DriftAssessmentResponsePerAccount
    }
};

const AvailableSnapshotPolicies = {
    ...resourceRequest,
    summary: 'Get available snapshot policies',
    description:
        'Get available snapshot policies for a database instance, returns snapshot policies on cluster and SVM level',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ASSESSMENT],
    response: {
        200: AvailableSnapshotPoliciesResponse
    }
};

const OptimizeResilienceSchema = {
    ...resourceRequest,
    summary: 'Fix resilience parameters for database instances',
    description: 'Fix resilience parameters for database instances',
    params: DatabaseHostInstanceSummaryParams,
    body: OptimizeResiliencyBody,
    tags: [RouteTags.ASSESSMENT],
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const BulkOptimizeGeneralSchema = {
    ...resourceRequest,
    params: AccountIdParams,
    tags: [RouteTags.ASSESSMENT],
    body: BulkOptimizeGeneralRequestBody,
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const BulkOptimizeStorageSizingSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix storage-sizing',
    description: 'Fix storage-sizing as per the best practice for selected database instances.'
};

const BulkOptimizeOperatingSystemSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix MPIO settings',
    description: 'Fix mpio settings parameters as per the best practice for selected database instances.'
};

const BulkOptimizeStorageTierSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix storage-tier',
    description: 'Fix storage-tier parameters as per the best practice for selected database instances.'
};

const BulkOptimizeComputeSchema = {
    ...resourceRequest,
    params: AccountIdParams,
    tags: [RouteTags.ASSESSMENT],
    body: BulkOptimizeComputeRequestBody,
    summary: 'Fix compute',
    description: 'Fix compute parameters as per the best practice for selected database instances.',
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const BulkOptimizeMaxDopSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix max-dop',
    description: 'Fix max-dop parameters as per the best practice for selected database instances.'
};

const BulkOptimizeAwsBackupSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Enable scheduled AWS FSx for ONTAP backups',
    description: 'Enable scheduled AWS FSx for ONTAP backups.'
};

const BulkDismissConfigurationSchema = {
    params: AccountIdParams,
    tags: [RouteTags.ASSESSMENT],
    body: BulkDismissConfigurationRequestBody,
    summary: 'Dismiss Assessment Configurations',
    description: 'Dismiss Assessment Configurations for selected database instances.',
    response: {
        200: BulkDismissConfigurationResponse
    }
};

const BulkOptimizeCloneSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix clone parameters for database instances',
    description: 'Fix clone parameters for database instances',
    body: BulkOptimizeCloneBody,
    tags: [RouteTags.ASSESSMENT],
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const BulkOptimizeSharedStorageSchema = {
    ...BulkOptimizeGeneralSchema,
    params: AccountIdParams,
    tags: [RouteTags.ASSESSMENT],
    body: BulkOptimizeHASharedStorageBody,
    summary: 'Fix shared storage parameters as part of High Availability Cluster configuration',
    description: 'Fix shared storage parameters as per the best practice for selected database instances.',
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

export {
    DriftAssessmentDataCollection,
    TriggerDriftAssessmentSchema,
    OptimizeStorageSchema,
    OptimizeSizingSchema,
    OptimizeComputeSchema,
    OptimizeOperatingSystemSchema,
    DriftAssessmentPerHost,
    OptimizeStorageTierSchema,
    DriftAssessmentPerAccount,
    AvailableSnapshotPolicies,
    OptimizeResilienceSchema,
    BulkOptimizeStorageSizingSchema,
    BulkOptimizeOperatingSystemSchema,
    BulkOptimizeStorageTierSchema,
    BulkOptimizeComputeSchema,
    BulkOptimizeMaxDopSchema,
    BulkOptimizeAwsBackupSchema,
    BulkOptimizeCloneSchema,
    BulkDismissConfigurationSchema,
    BulkOptimizeSharedStorageSchema
};
