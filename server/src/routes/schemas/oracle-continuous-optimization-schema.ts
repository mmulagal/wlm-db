import { RouteTags } from '../../utils/consts';
import { DatabaseHostOptionalInstanceSummaryParams } from '../types/database-hosts.types';

import { ContinuousOptimizationQueryString } from '../types/continuous-optimization.types';
import { OracleDriftAssessmentResponse } from '../types/oracle-continuous-optimization.types';
import { resourceRequest } from './database-hosts-schemas';

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

export { DriftAssessmentDataCollection };
