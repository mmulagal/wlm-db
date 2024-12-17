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
    DriftAssessmentResponsePerAccount
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
    summary: 'Trigger assessment',
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
    summary: 'Optimize storage',
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
    summary: 'Optimize storage sizing',
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
    summary: 'Optimize compute',
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
    summary: 'Optimize MPIO settings',
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
    summary: 'Optimize storage-tier settings',
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

export {
    DriftAssessmentDataCollection,
    TriggerDriftAssessmentSchema,
    OptimizeStorageSchema,
    OptimizeSizingSchema,
    OptimizeComputeSchema,
    OptimizeOperatingSystemSchema,
    DriftAssessmentPerHost,
    OptimizeStorageTierSchema,
    DriftAssessmentPerAccount
};
