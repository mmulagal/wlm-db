import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';
import { LogsAnalyzerBody, LogsAnalyzerParams, RemediationRecommendationObject } from '../types/logs-analyzer.types';

const LogsAnalyzerSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    description: 'Trigger logs analysis for a specific database instance in a remote database host machine',
    params: LogsAnalyzerParams,
    hide: process.env.NODE_ENV === 'production',
    body: LogsAnalyzerBody,
    summary: 'Trigger logs analysis for a specific database instance in a remote database host machine',
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

const GetLogsAnalyzerSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    description: 'Get logs analysis for a specific database instance in a remote database host machine',
    hide: process.env.NODE_ENV === 'production',
    params: LogsAnalyzerParams,
    querystring: Type.Object({
        jobId: Type.Optional(Type.String()),
        reportId: Type.Optional(Type.String())
    }),
    summary: 'Get logs analysis for a specific database instance in a remote database host machine',
    response: {
        200: Type.Object({
            remediationRecommendation: Type.Array(RemediationRecommendationObject)
        }),
        404: Type.Object({
            message: Type.String()
        })
    }
};

export { LogsAnalyzerSchema, GetLogsAnalyzerSchema };
