import { RouteTags } from '../../utils/consts';
import { DatabaseHostOptionalInstanceSummaryParams, DatabaseHostSummaryParams } from '../types/database-hosts.types';

import {
    AssessmentQueryStringPerAccount,
    ContinuousOptimizationQueryString
} from '../types/continuous-optimization.types';
import {
    DriftAssessmentResponsePerAccount,
    DriftAssessmentResponsePerHost,
    OracleDriftAssessmentResponse
} from '../types/oracle-continuous-optimization.types';
import { resourceRequest } from './database-hosts-schemas';
import { CredentialsIdParams } from '../types/generic.types';

const DriftAssessmentDataCollection = {
    ...resourceRequest,
    summary: 'Get database instance parameters drift from recommended settings',
    description: 'Get database instance parameters drift from recommended settings',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        200: OracleDriftAssessmentResponse
    }
};

const DriftAssessmentPerHost = {
    ...resourceRequest,
    summary: 'Get database parameter drift from recommended settings for all instances on a host',
    description: 'Get database parameters drift from recommended settings for all instances on a host',
    params: DatabaseHostSummaryParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    querystring: ContinuousOptimizationQueryString,
    response: {
        200: DriftAssessmentResponsePerHost
    }
};

const DriftAssessmentPerAccount = {
    ...resourceRequest,
    summary: 'Get database parameter drift from recommended settings for all registered instances on an account',
    description: 'Get database parameter drift from recommended settings for all registered instances on an account',
    params: CredentialsIdParams,
    tags: [RouteTags.ORACLE_ASSESSMENT],
    querystring: AssessmentQueryStringPerAccount,
    response: {
        200: DriftAssessmentResponsePerAccount
    }
};

export { DriftAssessmentDataCollection, DriftAssessmentPerHost, DriftAssessmentPerAccount };
