import { RouteTags } from '../../utils/consts';
import { AccountIdParams, CredentialsIdParams, JobIdResponse } from '../types/generic.types';
import {
    DatabaseHostInstanceSummaryParams,
    DatabaseHostOptionalInstanceSummaryParams,
    DatabaseHostSummaryParams
} from '../types/database-hosts.types';

import {
    ContinuousOptimizationQueryString,
    OracleContinuousOptimizationQueryString,
    AssessmentQueryStringPerAccount
} from '../types/continuous-optimization.types';
import {
    OptimizeStorageRequestBody,
    MSSQLDriftAssessmentResponse,
    OptimizeComputeRequestBody,
    OptimizeOperatingSystemRequestBody,
    DriftAssessmentResponsePerHost,
    DriftAssessmentResponsePerAccount,
    BulkOptimizeGeneralRequestBody,
    BulkOptimizeMTURequestBody,
    AvailableSnapshotPoliciesResponse,
    OptimizeResiliencyBody,
    OptimizeGenericRequestBody,
    BulkOptimizeComputeRequestBody,
    BulkOptimizeCloneBody,
    BulkDismissConfigurationRequestBody,
    BulkDismissConfigurationResponse,
    BulkOptimizeHASharedStorageBody,
    BulkOptimizeBackupRequestBody
} from '../types/mssql-continuous-optimisation.types';
import { resourceRequest } from './database-hosts-schemas';

const DriftAssessmentDataCollection = {
    ...resourceRequest,
    summary: 'Get MSSQL database instance parameters drift from recommended settings',
    description: 'Get MSSQL database instance parameters drift from recommended settings',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        200: MSSQLDriftAssessmentResponse
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

const BaseBulkDismissConfigurationSchema = {
    params: AccountIdParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    body: BulkDismissConfigurationRequestBody,
    summary: 'Dismiss Assessment Configurations for MSSQL database',
    description: 'Dismiss Assessment Configurations for selected MSSQL database instances.',
    response: {
        200: BulkDismissConfigurationResponse
    }
};

const BulkDismissConfigurationSchema = {
    ...BaseBulkDismissConfigurationSchema,
    tags: [RouteTags.MSSQL_ASSESSMENT]
};

const BulkDismissOracleConfigurationSchema = {
    ...BaseBulkDismissConfigurationSchema,
    summary: 'Dismiss Assessment Configurations for Oracle database',
    description: 'Dismiss Assessment Configurations for selected Oracle database instances.',
    tags: [RouteTags.ORACLE_ASSESSMENT]
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
    BulkOptimizeSharedStorageSchema,
    BulkOptimizeHeartbeatSchema,
    BulkOptimizeClusterQuorumSchema,
    BulkOptimizeSQLServerServiceSchema,
    BulkOptimizeMTUAlignmentSchema,
    BulkDismissOracleConfigurationSchema,
    TriggerOracleDriftAssessmentSchema
};
