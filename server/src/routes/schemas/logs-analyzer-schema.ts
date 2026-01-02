import { Type } from '@fastify/type-provider-typebox';
import { RouteTags } from '../../utils/consts';
import {
    AnalyzePreRequisitesQuery,
    LatestReports,
    LogsAnalysisPreRequisites,
    LogsAnalyzerBody,
    LogsAnalyzerParams,
    RemediationRecommendationObject,
    ReportIdentifier,
    OraclePreRequisitesRequestBody
} from '../types/logs-analyzer.types';
import { CredentialsIdParams, JobIdResponse } from '../types/generic.types';

const LogsAnalyzerSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    params: LogsAnalyzerParams,
    body: LogsAnalyzerBody,
    response: {
        200: JobIdResponse
    }
};

const MssqlLogsAnalyzerSchema = {
    ...LogsAnalyzerSchema,
    summary: 'Trigger MSSQL logs analysis for a specific database instance',
    description: 'Trigger logs analysis for a specific MSSQL database instance in a remote database host machine'
};

const OracleLogsAnalyzerSchema = {
    ...LogsAnalyzerSchema,
    summary: 'Trigger Oracle logs analysis for a specific database instance',
    description: 'Trigger logs analysis for a specific Oracle database instance in a remote database host machine'
};

const GetLogsAnalyzerSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    params: LogsAnalyzerParams,
    querystring: Type.Object({
        jobId: Type.Optional(Type.String()),
        id: Type.Optional(Type.String())
    }),
    response: {
        200: Type.Object({
            remediationRecommendation: Type.Array(RemediationRecommendationObject)
        }),
        404: Type.Object({
            message: Type.String()
        })
    }
};

const MssqlGetLogsAnalyzerSchema = {
    ...GetLogsAnalyzerSchema,
    summary: 'Get MSSQL logs analysis for a specific database instance',
    description: 'Get logs analysis for a specific MSSQL database instance in a remote database host machine'
};

const OracleGetLogsAnalyzerSchema = {
    ...GetLogsAnalyzerSchema,
    summary: 'Get Oracle logs analysis for a specific database instance',
    description: 'Get logs analysis for a specific Oracle database instance in a remote database host machine'
};

const ListLogsAnalyzerReportsSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    params: LogsAnalyzerParams,
    querystring: Type.Object({
        pageSize: Type.Optional(Type.Number())
    }),
    response: {
        200: Type.Object({
            reports: Type.Array(ReportIdentifier)
        }),
        404: Type.Object({
            message: Type.String()
        })
    }
};

const MssqlListLogsAnalyzerReportsSchema = {
    ...ListLogsAnalyzerReportsSchema,
    summary: 'List MSSQL logs analysis reports for a specific database instance',
    description: 'List logs analysis reports for a specific MSSQL database instance'
};

const OracleListLogsAnalyzerReportsSchema = {
    ...ListLogsAnalyzerReportsSchema,
    summary: 'List Oracle logs analysis reports for a specific database instance',
    description: 'List logs analysis reports for a specific Oracle database instance'
};

const AnalyzePreRequisitesSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    summary:
        'Check pre-requisites for logs analysis for a specific MSSQL database instance in a remote database host machine',
    description:
        'Logs analysis pre-requisites include checking if Bedrock model is available, if the networking configuration is correct, and if the required IAM policies are in place.',
    params: { ...CredentialsIdParams },
    querystring: AnalyzePreRequisitesQuery,
    response: {
        200: LogsAnalysisPreRequisites
    }
};

const OracleAnalyzePreRequisitesSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    summary:
        'Check pre-requisites for logs analysis for a specific Oracle database instance in a remote database host machine',
    description:
        'Logs analysis pre-requisites include checking if Bedrock model is available, if the networking configuration is correct, and if the required IAM policies are in place.',
    params: { ...CredentialsIdParams },
    body: OraclePreRequisitesRequestBody,
    response: {
        200: LogsAnalysisPreRequisites
    }
};

const LatestReportsSchema = {
    tags: [RouteTags.LOGS_ANALYSIS],
    params: CredentialsIdParams,
    response: {
        200: LatestReports
    }
};

const MssqlLatestReportsSchema = {
    ...LatestReportsSchema,
    summary: 'Get MSSQL logs analysis latest reports summary',
    description:
        'Logs analysis latest report at each MSSQL database host level for an account, credentials and region, analyzes the logs analysis reports for all database instances for latest scan time and error count'
};

const OracleLatestReportsSchema = {
    ...LatestReportsSchema,
    summary: 'Get Oracle logs analysis latest reports summary',
    description:
        'Logs analysis latest report at each Oracle database host level for an account, credentials and region, analyzes the logs analysis reports for all database instances for latest scan time and error count'
};

export {
    MssqlLogsAnalyzerSchema,
    OracleLogsAnalyzerSchema,
    MssqlGetLogsAnalyzerSchema,
    OracleGetLogsAnalyzerSchema,
    AnalyzePreRequisitesSchema,
    MssqlListLogsAnalyzerReportsSchema,
    OracleListLogsAnalyzerReportsSchema,
    MssqlLatestReportsSchema,
    OracleLatestReportsSchema,
    OracleAnalyzePreRequisitesSchema
};
