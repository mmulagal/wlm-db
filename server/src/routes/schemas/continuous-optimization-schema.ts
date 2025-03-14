import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';
import { CredentialsIdParams } from '../types/generic.types';
import {
    DatabaseHostInstanceSummaryParams,
    DatabaseHostOptionalInstanceSummaryParams,
    DatabaseHostSummaryParams,
    DatabaseQueryString
} from '../types/database-hosts.types';
import {
    OptimizeStorageRequestBody,
    OptimizeSizingRequestBody,
    DriftAssessmentResponse,
    OptimizeComputeRequestBody,
    OptimizeOperatingSystemRequestBody,
    DriftAssessmentResponsePerHost,
    DriftAssessmentResponsePerAccount,
    BulkOptimizeGeneralRequestBody,
    AvailableSnapshotPoliciesResponse,
    OptimizeResiliencyBody
} from '../types/continuous-optimization.types';

const resourceRequest = {
    tags: [RouteTags.RESOURCE],
    params: CredentialsIdParams
};

const AssessmentQueryStringPerAccount = Type.Object({
    fields: Type.Optional(Type.String()),
    nextToken: Type.Optional(Type.String()),
    pageSize: Type.Optional(Type.Integer())
});

const DriftAssessmentDataCollection = {
    ...resourceRequest,
    summary: 'Get database instance parameters drift from recommended settings',
    description: 'Get database instance parameters drift from recommended settings',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ASSESSMENT],
    querystring: DatabaseQueryString,
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
    querystring: DatabaseQueryString,
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
    querystring: DatabaseQueryString,
    response: {
        202: Type.Object({
            jobId: Type.String()
        })
    }
};

const OptimizeStorageSchemaDescription =
    'Optimize storage parameters as per the best practice for the selected database instance.';

const OptimizeStorageSchema = {
    ...resourceRequest,
    summary: 'Optimize storage for a database instance',
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
    summary: 'Optimize storage sizing for a database instance',
    description: 'Optimize sizing parameters as per the best practice for the selected database instance.',
    params: DatabaseHostInstanceSummaryParams,
    body: OptimizeSizingRequestBody,
    tags: [RouteTags.ASSESSMENT],
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const OptimizeComputeSchema = {
    ...resourceRequest,
    summary: 'Optimize compute for a database instance',
    description: 'Optimize compute as per the best practice for the selected database instance.',
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
    summary: 'Optimize MPIO settings for a database instance',
    description: 'Optimize MPIO settings parameters as per the best practice for the selected database instance.',
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
    summary: 'Optimize storage-tier settings for a database instance',
    description: 'Optimize storage-tier parameters as per the best practice for the selected database instance.',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ASSESSMENT],
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const DriftAssessmentPerAccount = {
    ...resourceRequest,
    summary: 'Get database parameter drift from recommended settings for all managed instances on an account',
    description: 'Get database parameter drift from recommended settings for all managed instances on an account',
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
    summary: 'Optimize resilience parameters for database instances',
    description: 'Optimize resilience parameters for database instances',
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
    params: CredentialsIdParams,
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
    summary: 'Optimize storage-sizing',
    description: 'Optimize storage-sizing as per the best practice for selected database instances.'
};

const BulkOptimizeOperatingSystemSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Optimize MPIO settings',
    description: 'Optimize mpio settings parameters as per the best practice for selected database instances.'
};

const BulkOptimizeStorageTierSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Optimize storage-tier',
    description: 'Optimize storage-tier parameters as per the best practice for selected database instances.'
};

const BulkOptimizeComputeSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Optimize compute',
    description: 'Optimize compute parameters as per the best practice for selected database instances.'
};

const BulkOptimizeMaxDopSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Optimize max-dop',
    description: 'Optimize max-dop parameters as per the best practice for selected database instances.'
};

const BulkOptimizeAwsBackupSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Update FSx for ONTAP backup',
    description: 'Update FSx for ONTAP backup parameters.'
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
    BulkOptimizeAwsBackupSchema
};
