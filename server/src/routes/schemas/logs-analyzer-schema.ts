import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';
import {
    LatestReports,
    LogsAnalysisPreRequisites,
    LogsAnalyzerBody,
    LogsAnalyzerParams,
    RemediationRecommendationObject,
    ReportIdentifier
} from '../types/logs-analyzer.types';
import { DatabaseHostSummaryParams } from '../types/database-hosts.types';
import { CredentialsIdParams } from '../types/generic.types';

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

const GetLogsAnalyzerSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    description: 'Get logs analysis for a specific database instance in a remote database host machine',
    params: LogsAnalyzerParams,
    querystring: Type.Object({
        jobId: Type.Optional(Type.String()),
        id: Type.Optional(Type.String())
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

const ListLogsAnalyzerReportsSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    description: 'List logs analysis reports for a specific database instance',
    params: LogsAnalyzerParams,
    querystring: Type.Object({
        pageSize: Type.Optional(Type.Number())
    }),
    summary: 'List logs analysis for a specific database instance',
    response: {
        200: Type.Object({
            reports: Type.Array(ReportIdentifier)
        }),
        404: Type.Object({
            message: Type.String()
        })
    }
};

const AnalyzePreRequisitesSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    description:
        'Check pre-requisites for logs analysis for a specific database instance in a remote database host machine',
    summary:
        'Logs analysis pre-requisites include checking if Bedrock model is available, if the networking configuration is correct, and if the required IAM policies are in place.',
    params: DatabaseHostSummaryParams,
    queryString: Type.Object({
        databaseType: Type.Optional(Type.String())
    }),
    response: {
        200: LogsAnalysisPreRequisites
    }
};

const LatestReportsSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    description: 'Logs analysis latest report at each database host level for an account, credentials and region',
    summary:
        'Logs analysis latest report at each database host level for an account, credentials and region, analyzes the logs analysis reports for all database instances for latest scan time and error count',
    params: CredentialsIdParams,
    queryString: Type.Object({
        databaseType: Type.Optional(Type.String())
    }),
    response: {
        200: LatestReports
    }
};

export {
    LogsAnalyzerSchema,
    GetLogsAnalyzerSchema,
    AnalyzePreRequisitesSchema,
    ListLogsAnalyzerReportsSchema,
    LatestReportsSchema
};
