import { Type } from '@fastify/type-provider-typebox';

import { RouteTags } from '../../utils/consts';
import { DatabaseHostOptionalInstanceSummaryParams, DatabaseHostSummaryParams } from '../types/database-hosts.types';

import {
    OracleAssessmentQueryStringPerAccount,
    OracleContinuousOptimizationQueryString
} from '../types/continuous-optimization.types';
import {
    DriftAssessmentResponsePerAccount,
    DriftAssessmentResponsePerAccountV1,
    DriftAssessmentResponsePerHost,
    OraclePatchScanField,
    OraclePatchScanDocResponse,
    OptimizeRequestBody,
    OptimizeStorageConfigurationRequestBody,
    OptimizeStorageLayoutRequestBody,
    OracleAssessmentResponse,
    OracleDriftAssessmentResponse
} from '../types/oracle-continuous-optimization.types';
import { resourceRequest } from './database-hosts-schemas';
import { AccountIdParams, CredentialsIdParams, HttpErrorResponse, JobIdResponse } from '../types/generic.types';
import { BaseBulkDismissConfigurationSchema } from './generic-schemas';

const DriftAssessmentDataCollection = {
    ...resourceRequest,
    summary: 'Get Oracle database instance parameters drift from recommended settings',
    description: 'Get Oracle database instance parameters drift from recommended settings',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    querystring: OracleContinuousOptimizationQueryString,
    response: {
        200: OracleAssessmentResponse
    }
};

const DriftAssessmentDataCollectionV1 = {
    ...resourceRequest,
    summary: 'Get Oracle database instance parameters drift from recommended settings [Deprecated]',
    description: 'Get Oracle database instance parameters drift from recommended settings, [Deprecated]',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    querystring: OracleContinuousOptimizationQueryString,
    response: {
        200: OracleDriftAssessmentResponse
    }
};

const DriftAssessmentPerAccountV1 = {
    ...resourceRequest,
    summary:
        'Get Oracle database parameter drift from recommended settings for all registered instances on an account [Deprecated]',
    description:
        'Get Oracle database parameter drift from recommended settings for all registered instances on an account, [Deprecated]',
    params: CredentialsIdParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    querystring: OracleAssessmentQueryStringPerAccount,
    response: {
        200: DriftAssessmentResponsePerAccountV1
    }
};

const OraclePatchScanQueryString = Type.Object({
    field: OraclePatchScanField
});

const FetchOraclePatchScanSchema = {
    ...resourceRequest,
    summary: 'Run an on-demand patch scan for an Oracle database instance',
    description:
        'Gather the database instance details and run the patch scan for the requested category. ' +
        'Currently supports: host-os-patch, oracle-security-patch.',
    params: DatabaseHostOptionalInstanceSummaryParams,
    querystring: OraclePatchScanQueryString,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    response: {
        200: OraclePatchScanDocResponse,
        404: HttpErrorResponse,
        500: HttpErrorResponse
    }
};

const OracleOptimizeSchema = {
    ...resourceRequest,
    summary: 'Fix for an Oracle database',
    description:
        'Fix storage configuration / OS configuration / asm layout / AWS backup / clone optimizations as per best practices for the selected Oracle database instances.',
    params: AccountIdParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    body: OptimizeRequestBody,
    response: {
        200: JobIdResponse
    }
};

const OracleOptimizeStorageSchema = {
    ...resourceRequest,
    summary: 'Fix storage for an Oracle database instance',
    description: 'Fix storage parameters as per the best practice for the selected Oracle database instance.',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    body: OptimizeStorageConfigurationRequestBody,
    response: {
        200: JobIdResponse
    }
};

const OracleOptimizeStorageConfigurationSchema = {
    ...OracleOptimizeStorageSchema,
    summary: 'Fix storage configuration for an Oracle database instance',
    body: OptimizeStorageConfigurationRequestBody
};

const OracleOptimizeStorageLayoutSchema = {
    ...OracleOptimizeStorageSchema,
    summary: 'Fix storage layout for an Oracle database instance',
    body: OptimizeStorageLayoutRequestBody
};

const DriftAssessmentPerHost = {
    ...resourceRequest,
    summary: 'Get Oracle database parameter drift from recommended settings for all instances on a host',
    description: 'Get Oracle database parameters drift from recommended settings for all instances on a host',
    params: DatabaseHostSummaryParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    querystring: OracleContinuousOptimizationQueryString,
    response: {
        200: DriftAssessmentResponsePerHost
    }
};

const DriftAssessmentPerAccount = {
    ...resourceRequest,
    summary: 'Get Oracle database parameter drift from recommended settings for all registered instances on an account',
    description:
        'Get Oracle database parameter drift from recommended settings for all registered instances on an account',
    params: CredentialsIdParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    querystring: OracleAssessmentQueryStringPerAccount,
    response: {
        200: DriftAssessmentResponsePerAccount
    }
};

const BulkDismissOracleConfigurationSchema = {
    ...BaseBulkDismissConfigurationSchema,
    summary: 'Dismiss Assessment Configurations for Oracle database',
    description: 'Dismiss Assessment Configurations for selected Oracle database.',
    tags: [RouteTags.ORACLE_ASSESSMENT]
};

const OracleUnregisteredAssessmentParams = Type.Intersect([
    CredentialsIdParams,
    Type.Object({
        ec2InstanceId: Type.String({ minLength: 1, description: 'EC2 instance ID hosting the Oracle instance.' }),
        instanceName: Type.String({ minLength: 1, description: 'Oracle SID, e.g. ORCL.' })
    })
]);

const TriggerOracleUnregisteredAssessmentSchema = {
    tags: [RouteTags.ORACLE_ASSESSMENT],
    summary: 'Trigger a one-time storage assessment for an unregistered Oracle instance',
    description:
        'Collects ONTAP volume/LUN storage drift where an EC2-FSx for ONTAP relationship exists, for an Oracle ' +
        'instance that is not registered with Workload Factory.',
    params: OracleUnregisteredAssessmentParams,
    response: {
        202: JobIdResponse
    }
};

export {
    DriftAssessmentDataCollection,
    DriftAssessmentDataCollectionV1,
    DriftAssessmentPerHost,
    DriftAssessmentPerAccount,
    DriftAssessmentPerAccountV1,
    OracleOptimizeStorageSchema,
    OracleOptimizeStorageConfigurationSchema,
    OracleOptimizeStorageLayoutSchema,
    OracleOptimizeSchema,
    FetchOraclePatchScanSchema,
    BulkDismissOracleConfigurationSchema,
    TriggerOracleUnregisteredAssessmentSchema
};
