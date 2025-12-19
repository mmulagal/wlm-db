import { RouteTags } from '../../utils/consts';
import { DatabaseHostOptionalInstanceSummaryParams, DatabaseHostSummaryParams } from '../types/database-hosts.types';

import {
    AssessmentQueryStringPerAccount,
    ContinuousOptimizationQueryString
} from '../types/continuous-optimization.types';
import {
    DriftAssessmentResponsePerAccount,
    DriftAssessmentResponsePerHost,
    OptimizeRequestBody,
    OptimizeStorageRequestBody,
    OracleDriftAssessmentResponse
} from '../types/oracle-continuous-optimization.types';
import { resourceRequest } from './database-hosts-schemas';
import { AccountIdParams, CredentialsIdParams, OptimizationResponse } from '../types/generic.types';

const DriftAssessmentDataCollection = {
    ...resourceRequest,
    summary: 'Get Oracle database instance parameters drift from recommended settings',
    description: 'Get Oracle database instance parameters drift from recommended settings',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        200: OracleDriftAssessmentResponse
    }
};

const OracleOptimizeSchema = {
    ...resourceRequest,
    summary: 'Fix for an Oracle database',
    description:
        'Fix storage configuration / OS configuration / asm layout optimizations as per best practices for the selected Oracle database instances.',
    params: AccountIdParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    body: OptimizeRequestBody,
    response: OptimizationResponse
};

const OracleOptimizeStorageSchema = {
    ...resourceRequest,
    summary: 'Fix storage for an Oracle database instance',
    description: 'Fix storage parameters as per the best practice for the selected Oracle database instance.',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    body: OptimizeStorageRequestBody,
    response: OptimizationResponse
};

const OracleOptimizeStorageConfigurationSchema = {
    ...OracleOptimizeStorageSchema,
    summary: 'Fix storage configuration for an Oracle database instance'
};

const OracleOptimizeStorageLayoutSchema = {
    ...OracleOptimizeStorageSchema,
    summary: 'Fix storage layout for an Oracle database instance'
};

const DriftAssessmentPerHost = {
    ...resourceRequest,
    summary: 'Get Oracle database parameter drift from recommended settings for all instances on a host',
    description: 'Get Oracle database parameters drift from recommended settings for all instances on a host',
    params: DatabaseHostSummaryParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
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
    querystring: AssessmentQueryStringPerAccount,
    response: {
        200: DriftAssessmentResponsePerAccount
    }
};

export {
    DriftAssessmentDataCollection,
    DriftAssessmentPerHost,
    DriftAssessmentPerAccount,
    OracleOptimizeStorageSchema,
    OracleOptimizeStorageConfigurationSchema,
    OracleOptimizeStorageLayoutSchema,
    OracleOptimizeSchema
};
