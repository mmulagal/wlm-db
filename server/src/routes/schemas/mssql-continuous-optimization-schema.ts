import { Type } from '@fastify/type-provider-typebox';

import { RouteTags } from '../../utils/consts';
import { AccountIdParams, CredentialsIdParams, HttpErrorResponse, JobIdResponse } from '../types/generic.types';
import {
    DatabaseHostInstanceSummaryParams,
    DatabaseHostOptionalInstanceSummaryParams,
    DatabaseHostSummaryParams
} from '../types/database-hosts.types';

import {
    ContinuousOptimizationQueryString,
    OracleContinuousOptimizationQueryString,
    AssessmentQueryStringPerAccount,
    ErrorResponse
} from '../types/continuous-optimization.types';
import {
    OptimizeStorageRequestBody,
    OptimizeComputeRequestBody,
    OptimizeOperatingSystemRequestBody,
    DriftAssessmentResponsePerHost,
    DriftAssessmentResponsePerAccount,
    DriftAssessmentResponsePerAccountV1,
    BulkOptimizeGeneralRequestBody,
    BulkOptimizeMTURequestBody,
    AvailableSnapshotPoliciesResponse,
    OptimizeResiliencyBody,
    OptimizeGenericRequestBody,
    BulkOptimizeComputeRequestBody,
    BulkOptimizeCloneBody,
    BulkOptimizeHASharedStorageBody,
    BulkOptimizeBackupRequestBody,
    HostOsPatchScanResponse,
    MSSQLPatchScanResponse,
    MssqlPatchScanField,
    MssqlAssessmentResponse,
    MssqlAssessmentResponseV1
} from '../types/mssql-continuous-optimisation.types';
import { resourceRequest } from './database-hosts-schemas';
import { BaseBulkDismissConfigurationSchema } from './generic-schemas';

const DriftAssessmentDataCollectionV1 = {
    ...resourceRequest,
    summary: 'Get MSSQL database instance parameters drift from recommended settings [Deprecated]',
    description: 'Get MSSQL database instance parameters drift from recommended settings, [Deprecated]',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        200: MssqlAssessmentResponseV1
    }
};

const DriftAssessmentPerAccountV1 = {
    ...resourceRequest,
    summary:
        'Get MSSQL database parameter drift from recommended settings for all registered instances on an account [Deprecated]',
    description:
        'Get MSSQL database parameter drift from recommended settings for all registered instances on an account, [Deprecated]',
    params: CredentialsIdParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    querystring: AssessmentQueryStringPerAccount,
    response: {
        200: DriftAssessmentResponsePerAccountV1
    }
};

const DriftAssessmentDataCollection = {
    ...resourceRequest,
    summary: 'Get MSSQL database instance parameters drift from recommended settings',
    description: 'Get MSSQL database instance parameters drift from recommended settings',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        200: MssqlAssessmentResponse
    }
};

const DriftAssessmentPerHost = {
    ...resourceRequest,
    summary: 'Get MSSQL database parameter drift from recommended settings for all instances on a host',
    description: 'Get MSSQL database parameters drift from recommended settings for all instances on a host',
    params: DatabaseHostSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        200: DriftAssessmentResponsePerHost
    }
};

const BaseTriggerDriftAssessmentSchema = {
    ...resourceRequest,
    summary: 'Trigger assessment for a MSSQL database instance',
    description: 'Trigger assessment for best practice misalignments on a managed MSSQL database instance',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        202: JobIdResponse
    }
};

const TriggerDriftAssessmentSchema = {
    ...BaseTriggerDriftAssessmentSchema,
    tags: [RouteTags.MSSQL_ASSESSMENT]
};

const TriggerOracleDriftAssessmentSchema = {
    ...BaseTriggerDriftAssessmentSchema,
    summary: 'Trigger assessment for a Oracle database instance',
    description: 'Trigger assessment for best practice misalignments on a managed Oracle database instance',
    tags: [RouteTags.ORACLE_ASSESSMENT],
    querystring: OracleContinuousOptimizationQueryString
};

const OptimizeStorageSchemaDescription =
    'Fix storage parameters as per the best practice for the selected MSSQL database instance.';

const OptimizeStorageSchema = {
    ...resourceRequest,
    summary: 'Fix storage for a MSSQL database instance',
    description: OptimizeStorageSchemaDescription,
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    body: OptimizeStorageRequestBody,
    response: {
        200: JobIdResponse
    }
};

const OptimizeSizingSchema = {
    ...resourceRequest,
    summary: 'Fix storage sizing for a MSSQL database instance',
    description: 'Fix sizing parameters as per the best practice for the selected MSSQL database instance.',
    params: DatabaseHostInstanceSummaryParams,
    body: OptimizeGenericRequestBody,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    response: {
        200: JobIdResponse
    }
};

const OptimizeComputeSchema = {
    ...resourceRequest,
    summary: 'Fix compute rightsizing for a MSSQL database instance',
    description: 'Fix compute rightsizing as per the best practice for the selected MSSQL database instance.',
    params: DatabaseHostInstanceSummaryParams,
    body: OptimizeComputeRequestBody,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    response: {
        200: JobIdResponse
    }
};

const OptimizeOperatingSystemSchema = {
    ...resourceRequest,
    summary: 'Fix MPIO settings for a MSSQL database instance',
    description: 'Fix MPIO settings parameters as per the best practice for the selected MSSQL database instance.',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    body: OptimizeOperatingSystemRequestBody,
    response: {
        200: JobIdResponse
    }
};

const OptimizeStorageTierSchema = {
    ...resourceRequest,
    summary: 'Fix storage-tier settings for a MSSQL database instance',
    description: 'Fix storage-tier parameters as per the best practice for the selected MSSQL database instance.',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    body: OptimizeGenericRequestBody,
    response: {
        200: JobIdResponse
    }
};

const DriftAssessmentPerAccount = {
    ...resourceRequest,
    summary: 'Get MSSQL database parameter drift from recommended settings for all registered instances on an account',
    description:
        'Get MSSQL database parameter drift from recommended settings for all registered instances on an account',
    params: CredentialsIdParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    querystring: AssessmentQueryStringPerAccount,
    response: {
        200: DriftAssessmentResponsePerAccount
    }
};

const AvailableSnapshotPolicies = {
    ...resourceRequest,
    summary: 'Get available snapshot policies for MSSQL database instance',
    description:
        'Get available snapshot policies for a MSSQL database instance, returns snapshot policies on cluster and SVM level',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    response: {
        200: AvailableSnapshotPoliciesResponse
    }
};

const OptimizeResilienceSchema = {
    ...resourceRequest,
    summary: 'Fix resilience parameters for MSSQL database instances',
    description: 'Fix resilience parameters for MSSQL database instances',
    params: DatabaseHostInstanceSummaryParams,
    body: OptimizeResiliencyBody,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    response: {
        200: JobIdResponse
    }
};

const BulkOptimizeGeneralSchema = {
    ...resourceRequest,
    params: AccountIdParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    body: BulkOptimizeGeneralRequestBody,
    response: {
        200: JobIdResponse
    }
};

const BulkOptimizeStorageSizingSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix storage-sizing',
    description: 'Fix storage-sizing as per the best practice for selected MSSQL database instances.'
};

const BulkOptimizeOperatingSystemSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix MPIO settings for MSSQL database',
    description: 'Fix mpio settings parameters as per the best practice for selected MSSQL database instances.'
};

const BulkOptimizeStorageTierSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix storage-tier for MSSQL database',
    description: 'Fix storage-tier parameters as per the best practice for selected MSSQL database instances.'
};

const BulkOptimizeComputeSchema = {
    ...resourceRequest,
    params: AccountIdParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    body: BulkOptimizeComputeRequestBody,
    summary: 'Fix compute for MSSQL database',
    description: 'Fix compute parameters as per the best practice for selected MSSQL database instances.',
    response: {
        200: JobIdResponse
    }
};

const BulkOptimizeMaxDopSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix max-dop for MSSQL database',
    description: 'Fix max-dop parameters as per the best practice for selected MSSQL database instances.'
};

const BulkOptimizeAwsBackupSchema = {
    ...resourceRequest,
    summary: 'Enable scheduled AWS FSx for ONTAP backups for MSSQL',
    description: 'Enable scheduled AWS FSx for ONTAP backups for MSSQL.',
    params: AccountIdParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    body: BulkOptimizeBackupRequestBody,
    response: {
        200: JobIdResponse
    }
};

const BulkDismissConfigurationSchema = {
    ...BaseBulkDismissConfigurationSchema,
    summary: 'Dismiss Assessment Configurations for MSSQL database',
    description: 'Dismiss Assessment Configurations for selected MSSQL database instances.',
    tags: [RouteTags.MSSQL_ASSESSMENT]
};

const BulkOptimizeCloneSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix clone parameters for MSSQL database instances',
    description: 'Fix clone parameters for MSSQL database instances',
    body: BulkOptimizeCloneBody,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    response: {
        200: JobIdResponse
    }
};

const BulkOptimizeSharedStorageSchema = {
    ...BulkOptimizeGeneralSchema,
    params: AccountIdParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    body: BulkOptimizeHASharedStorageBody,
    summary: 'Fix shared storage parameters as part of High Availability Cluster configuration for MSSQL database',
    description: 'Fix shared storage parameters as per the best practice for selected MSSQL database instances.',
    response: {
        200: JobIdResponse
    }
};

const BulkOptimizeHeartbeatSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix heartbeat settings in cluster configuration for MSSQL database',
    description: 'Fix heartbeat settings in cluster configuration for MSSQL database'
};

const BulkOptimizeClusterQuorumSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix cluster quorum type in cluster configuration for MSSQL database',
    description: 'Fix cluster quorum type in cluster configuration for MSSQL database'
};

const BulkOptimizeSQLServerServiceSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix MSSQL server service parameters as part of High Availability Cluster configuration',
    description: 'Fix MSSQL server service parameters as per the best practice for selected MSSQL database instances.'
};

const BulkOptimizeMTUAlignmentSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Optimize MTU alignment settings for MSSQL database',
    description:
        'Optimize MTU alignment settings to match FSx file system MTU for improved network performance for MSSQL database.',
    body: BulkOptimizeMTURequestBody
};

const MssqlPatchScanQueryString = Type.Object({
    field: MssqlPatchScanField
});

const FetchMssqlPatchScanSchema = {
    ...resourceRequest,
    summary: 'Run an on-demand patch scan for an MSSQL database instance',
    description:
        'Gather the database instance details and run the patch scan for the requested category. ' +
        'Currently supports: host-os-patch, mssql-patch.',
    params: DatabaseHostOptionalInstanceSummaryParams,
    querystring: MssqlPatchScanQueryString,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    response: {
        200: Type.Union([HostOsPatchScanResponse, MSSQLPatchScanResponse, ErrorResponse]),
        400: HttpErrorResponse,
        404: HttpErrorResponse,
        500: HttpErrorResponse
    }
};

const MssqlUnregisteredAssessmentParams = Type.Intersect([
    CredentialsIdParams,
    Type.Object({
        ec2InstanceId: Type.String({ minLength: 1, description: 'EC2 instance ID hosting the SQL Server instance.' }),
        instanceName: Type.String({ minLength: 1, description: 'SQL Server instance name, e.g. MSSQLSERVER.' })
    })
]);

const TriggerMssqlUnregisteredAssessmentSchema = {
    tags: [RouteTags.MSSQL_ASSESSMENT],
    summary: 'Trigger a one-time storage assessment for an unregistered MSSQL instance',
    description:
        'Collects registry-based storage layout and MPIO configuration via AWS Fleet Manager for a SQL Server ' +
        'instance that is not registered with Workload Factory (e.g. when the credential only has AWS-doc permission).',
    params: MssqlUnregisteredAssessmentParams,
    response: {
        202: JobIdResponse
    }
};

export {
    DriftAssessmentDataCollection,
    TriggerDriftAssessmentSchema,
    TriggerMssqlUnregisteredAssessmentSchema,
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
    BulkOptimizeSharedStorageSchema,
    BulkOptimizeHeartbeatSchema,
    BulkOptimizeClusterQuorumSchema,
    BulkOptimizeSQLServerServiceSchema,
    BulkOptimizeMTUAlignmentSchema,
    TriggerOracleDriftAssessmentSchema,
    FetchMssqlPatchScanSchema,
    DriftAssessmentDataCollectionV1,
    DriftAssessmentPerAccountV1
};
