import { FastifyInstance } from 'fastify/types/instance';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { DATABASE_TYPE } from '@prisma/client';
import {
    AnalyzePreRequisitesSchema,
    GetLogsAnalyzerSchema,
    LatestReportsSchema,
    ListLogsAnalyzerReportsSchema,
    LogsAnalyzerSchema,
    OracleAnalyzePreRequisitesSchema
} from './schemas/logs-analyzer-schema';
import castRequest from './utils';
import {
    getLogsAnalysisReport,
    listLogsAnalysisReportsIdentifiers,
    triggerLogsAnalysis,
    analyzePreRequisites,
    getLatestLogsAnalysisReports,
    analyzeOracleHostsPreRequisites
} from '../operations/logs-analyzer/logs-analyzer-operations';

const MSSQL_API_PREFIX_PATH = '/v1/mssql/credentials/:credentialsId/regions/:region';
const ORACLE_API_PREFIX_PATH = '/v1/oracle/credentials/:credentialsId/regions/:region';

export default function logsAnalyzerRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(
        `${MSSQL_API_PREFIX_PATH}/logs-analysis/pre-requisites`,
        { schema: AnalyzePreRequisitesSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                query: { ec2InstanceId, databaseHostId }
            } = castRequest(request);

            const response = await analyzePreRequisites(
                accountId,
                credentialsId,
                region,
                DATABASE_TYPE.mssql,
                ec2InstanceId,
                databaseHostId
            );

            return reply.send(response);
        }
    );

    server.post(
        `${ORACLE_API_PREFIX_PATH}/logs-analysis/pre-requisites`,
        { schema: OracleAnalyzePreRequisitesSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                body: { items }
            } = castRequest(request);

            const response = await analyzeOracleHostsPreRequisites(accountId, credentialsId, region, items);
            return reply.send(response);
        }
    );

    server.get(
        `${MSSQL_API_PREFIX_PATH}/logs-analysis/summary`,
        { schema: LatestReportsSchema },
        async (request, reply) => {
            const {
                params: { accountId, region, credentialsId }
            } = castRequest(request);

            const response = await getLatestLogsAnalysisReports(accountId, region, credentialsId, DATABASE_TYPE.mssql);

            return reply.send(response);
        }
    );
    server.post(
        `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis`,
        { schema: LogsAnalyzerSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                body: scanParams
            } = castRequest(request);

            const response = await triggerLogsAnalysis(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                scanParams
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
                query: { jobId, id }
            } = castRequest(request);

            const response = await getLogsAnalysisReport(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                jobId,
                id
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

    server.post(
        `${ORACLE_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis`,
        { schema: LogsAnalyzerSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                body: scanParams
            } = castRequest(request);

            const response = await triggerLogsAnalysis(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                scanParams
            );
            return reply.send(response);
        }
    );

    server.get(
        `${ORACLE_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis/reports`,
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

    server.get(
        `${ORACLE_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis`,
        { schema: GetLogsAnalyzerSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                query: { jobId, id }
            } = castRequest(request);

            const response = await getLogsAnalysisReport(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                jobId,
                id
            );

            return reply.send(response);
        }
    );

    server.get(
        `${ORACLE_API_PREFIX_PATH}/logs-analysis/summary`,
        { schema: LatestReportsSchema },
        async (request, reply) => {
            const {
                params: { accountId, region, credentialsId }
            } = castRequest(request);

            const response = await getLatestLogsAnalysisReports(accountId, region, credentialsId, DATABASE_TYPE.oracle);

            return reply.send(response);
        }
    );
}
