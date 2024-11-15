import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';
import { CredentialsIdParams } from '../types/generic.types';
import {
    DatabaseHostInstanceSummaryParams,
    DatabaseHostOptionalInstanceSummaryParams,
    DatabaseQueryString
} from '../types/database-hosts.types';
import {
    OptimizeStorageRequestBody,
    OptimizeSizingRequestBody,
    DriftAssessmentResponse
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
    querystring: DatabaseQueryString,
    response: {
        200: DriftAssessmentResponse
    }
};

const TriggerDriftAssessmentSchema = {
    ...resourceRequest,
    summary: 'Trigger assessment',
    description: 'Trigger assessment for best practice misalignments on a managed database instance',
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ASSESSMENT],
    querystring: DatabaseQueryString,
    response: {
        202: {
            jobId: Type.String()
        }
    }
};

const OptimizeStorageSchemaDescription =
    'Optimize storage parameters as per the best practice for the selected database instance.';

const OptimizeStorageSchema = {
    ...resourceRequest,
    summary: 'Optimize storage',
    description: OptimizeStorageSchemaDescription,
    params: DatabaseHostOptionalInstanceSummaryParams,
    tags: [RouteTags.ASSESSMENT],
    body: OptimizeStorageRequestBody,
    response: {
        200: {
            jobId: Type.String()
        }
    }
};

const OptimizeSizingSchema = {
    ...resourceRequest,
    summary: 'Optimize storage sizing',
    description: 'Optimize sizing parameters as per the best practice for the selected database instance.',
    params: DatabaseHostInstanceSummaryParams,
    body: OptimizeSizingRequestBody,
    tags: [RouteTags.ASSESSMENT],
    response: {
        200: {
            jobId: Type.String()
        }
    }
};

export { DriftAssessmentDataCollection, TriggerDriftAssessmentSchema, OptimizeStorageSchema, OptimizeSizingSchema };
