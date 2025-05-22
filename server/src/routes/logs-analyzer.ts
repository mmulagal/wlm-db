import { FastifyInstance } from 'fastify/types/instance';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { LogsAnalyzerSchema } from './schemas/logs-analyzer-schema';
import castRequest from './utils';
import { triggerLogsAnalysis } from '../operations/logs-analyzer/logs-analyzer-operations';

const MSSQL_API_PREFIX_PATH = '/v1/mssql/credentials/:credentialsId/regions/:region';

export default function logsAnalyzerRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post(
        `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/logs-analysis`,
        { schema: LogsAnalyzerSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                body: { inferenceConfig, logsAnalyzerS3SignedUrl }
            } = castRequest(request);

            const response = await triggerLogsAnalysis(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                inferenceConfig,
                logsAnalyzerS3SignedUrl
            );
            return reply.send(response);
        }
    );
}
