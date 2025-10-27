import { RouteTags } from '../../utils/consts';
import { AccountIdParams, CredentialsIdParams, JobIdResponse } from '../types/generic.types';
import {
    DatabaseHostInstanceSummaryParams,
    DatabaseHostOptionalInstanceSummaryParams,
    DatabaseHostSummaryParams
} from '../types/database-hosts.types';

import {
    ContinuousOptimizationQueryString,
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
    summary: 'Get database instance parameters drift from recommended settings',
    description: 'Get database instance parameters drift from recommended settings',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        200: MSSQLDriftAssessmentResponse
    }
};

const DriftAssessmentPerHost = {
    ...resourceRequest,
    summary: 'Get database parameter drift from recommended settings for all instances on a host',
    description: 'Get database parameters drift from recommended settings for all instances on a host',
    params: DatabaseHostSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        200: DriftAssessmentResponsePerHost
    }
};

const BaseTriggerDriftAssessmentSchema = {
    ...resourceRequest,
    summary: 'Trigger assessment for a database instance',
    description: 'Trigger assessment for best practice misalignments on a managed database instance',
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
    tags: [RouteTags.ORACLE_ASSESSMENT]
};

const OptimizeStorageSchemaDescription =
    'Fix storage parameters as per the best practice for the selected database instance.';

const OptimizeStorageSchema = {
    ...resourceRequest,
    summary: 'Fix storage for a database instance',
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
    summary: 'Fix storage sizing for a database instance',
    description: 'Fix sizing parameters as per the best practice for the selected database instance.',
    params: DatabaseHostInstanceSummaryParams,
    body: OptimizeGenericRequestBody,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    response: {
        200: JobIdResponse
    }
};

const OptimizeComputeSchema = {
    ...resourceRequest,
    summary: 'Fix compute rightsizing for a database instance',
    description: 'Fix compute rightsizing as per the best practice for the selected database instance.',
    params: DatabaseHostInstanceSummaryParams,
    body: OptimizeComputeRequestBody,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    response: {
        200: JobIdResponse
    }
};

const OptimizeOperatingSystemSchema = {
    ...resourceRequest,
    summary: 'Fix MPIO settings for a database instance',
    description: 'Fix MPIO settings parameters as per the best practice for the selected database instance.',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    body: OptimizeOperatingSystemRequestBody,
    response: {
        200: JobIdResponse
    }
};

const OptimizeStorageTierSchema = {
    ...resourceRequest,
    summary: 'Fix storage-tier settings for a database instance',
    description: 'Fix storage-tier parameters as per the best practice for the selected database instance.',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
    body: OptimizeGenericRequestBody,
    response: {
        200: JobIdResponse
    }
};

const DriftAssessmentPerAccount = {
    ...resourceRequest,
    summary: 'Get database parameter drift from recommended settings for all registered instances on an account',
    description: 'Get database parameter drift from recommended settings for all registered instances on an account',
    params: CredentialsIdParams,
    tags: [RouteTags.MSSQL_ASSESSMENT],
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
    tags: [RouteTags.MSSQL_ASSESSMENT],
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
    tags: [RouteTags.MSSQL_ASSESSMENT],
    body: BulkOptimizeComputeRequestBody,
    summary: 'Fix compute',
    description: 'Fix compute parameters as per the best practice for selected database instances.',
    response: {
        200: JobIdResponse
    }
};

const BulkOptimizeMaxDopSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix max-dop',
    description: 'Fix max-dop parameters as per the best practice for selected database instances.'
};

const BulkOptimizeAwsBackupSchema = {
    ...resourceRequest,
    summary: 'Enable scheduled AWS FSx for ONTAP backups',
    description: 'Enable scheduled AWS FSx for ONTAP backups.',
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
    summary: 'Dismiss Assessment Configurations',
    description: 'Dismiss Assessment Configurations for selected database instances.',
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
    tags: [RouteTags.ORACLE_ASSESSMENT]
};

const BulkOptimizeCloneSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix clone parameters for database instances',
    description: 'Fix clone parameters for database instances',
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
    summary: 'Fix shared storage parameters as part of High Availability Cluster configuration',
    description: 'Fix shared storage parameters as per the best practice for selected database instances.',
    response: {
        200: JobIdResponse
    }
};

const BulkOptimizeHeartbeatSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix heartbeat settings in cluster configuration',
    description: 'Fix heartbeat settings in cluster configuration'
};

const BulkOptimizeClusterQuorumSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix cluster quorum type in cluster configuration',
    description: 'Fix cluster quorum type in cluster configuration'
};

const BulkOptimizeSQLServerServiceSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Fix sql server service parameters as part of High Availability Cluster configuration',
    description: 'Fix sql server service parameters as per the best practice for selected database instances.'
};

const BulkOptimizeMTUAlignmentSchema = {
    ...BulkOptimizeGeneralSchema,
    summary: 'Optimize MTU alignment settings',
    description: 'Optimize MTU alignment settings to match FSx file system MTU for improved network performance.',
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
