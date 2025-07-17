import { FastifyInstance } from 'fastify/types/instance';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
    GetLogsAnalyzerSchema,
    ListLogsAnalyzerReportsSchema,
    LogsAnalyzerSchema
} from './schemas/logs-analyzer-schema';
import castRequest from './utils';
import {
    getLogsAnalysisReport,
    listLogsAnalysisReportsIdentifiers,
    triggerLogsAnalysis
} from '../operations/logs-analyzer/logs-analyzer-operations';

const MSSQL_API_PREFIX_PATH = '/v1/mssql/credentials/:credentialsId/regions/:region';

export default function logsAnalyzerRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post(
        `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis`,
        { schema: LogsAnalyzerSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                body: {
                    inferenceConfig,
                    logsAnalyzerS3SignedUrl,
                    logsCountToConsider,
                    logsAnalyzerFromTimestamp,
                    logLevel,
                    logsWindowDuration
                }
            } = castRequest(request);

            const response = await triggerLogsAnalysis(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                logsCountToConsider,
                logsAnalyzerFromTimestamp,
                inferenceConfig,
                logsAnalyzerS3SignedUrl,
                logLevel,
                logsWindowDuration
            );
            return reply.send(response);
        }
    );

    server.get(
        `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis`,
        { schema: GetLogsAnalyzerSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                query: { jobId, reportId }
            } = castRequest(request);

            const response = await getLogsAnalysisReport(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                jobId,
                reportId
            );

            return reply.send(response);
        }
    );

    server.get(
        `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis/reports`,
        { schema: ListLogsAnalyzerReportsSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                query: { pageSize }
            } = castRequest(request);

            const response = await listLogsAnalysisReportsIdentifiers(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                pageSize
            );

            return reply.send(response);
        }
    );
}
