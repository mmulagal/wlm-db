import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';
import { LogsAnalyzerBody, LogsAnalyzerParams } from '../types/logs-analyzer.types';

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
        jobId: Type.Optional(Type.String())
    }),
    summary: 'Get logs analysis for a specific database instance in a remote database host machine',
    response: {
        200: Type.Object({
            remediationRecommendation: Type.Array(
                Type.Object({
                    error: Type.String(),
                    cause: Type.String(),
                    count: Type.Number(),
                    severity: Type.String(),
                    remediation: Type.Array(Type.String())
                })
            )
        }),
        404: Type.Object({
            message: Type.String()
        })
    }
};

export { LogsAnalyzerSchema, GetLogsAnalyzerSchema };
