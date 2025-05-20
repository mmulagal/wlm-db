import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';
import { LogsAnalyzerBody, LogsAnalyzerParams } from '../types/logs-analyzer.types';

const LogsAnalyzerSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    description: 'Trigger logs analysis for a specific database instance in a remote database host machine',
    params: LogsAnalyzerParams,
    body: LogsAnalyzerBody,
    summary: 'Trigger logs analysis for a specific database instance in a remote database host machine',
    response: {
        200: Type.Object({
            jobId: Type.String()
        })
    }
};

export { LogsAnalyzerSchema };
