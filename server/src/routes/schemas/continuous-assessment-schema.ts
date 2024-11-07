import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';
import { CredentialsIdParams } from '../types/generic.types';
import { DatabaseHostInstanceSummaryParams } from '../types/database-hosts.types';
import { OptimizeSizingQueryParams } from '../types/continuous-assessment.types';

const resourceRequest = {
    tags: [RouteTags.RESOURCE],
    params: CredentialsIdParams
};

const OptimizeSizingSchema = {
    ...resourceRequest,
    summary: 'Optimize storage sizing',
    description: 'Optimize sizing parameters as per the best practice for the selected database instance.',
    params: DatabaseHostInstanceSummaryParams,
    querystring: OptimizeSizingQueryParams,
    tags: [RouteTags.ASSESSMENT],
    response: {
        200: {
            jobId: Type.String()
        }
    }
};

export { OptimizeSizingSchema };
