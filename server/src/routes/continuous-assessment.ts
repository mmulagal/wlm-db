import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    fetchDriftAssessment,
    triggerDriftAssessmentDataCollection
} from '../operations/continuous-assessment-operations';
import { AssessmentTriggeredBy, OptimizeStorageParams } from '../utils/continous-optimization-consts';
import {
    DriftAssessmentDataCollection,
    TriggerDriftAssessmentSchema,
    OptimizeStorageSchema,
    OptimizeSizingSchema
} from './schemas/continuous-assessment-schema';
import { optimizeStorage, optimizeSizing } from '../operations/continuous-assessment-optimize-operations';

const MSSQL_API_PREFIX_PATH = '/v1/mssql/credentials/:credentialsId/regions/:region';

export default function continuousAssessmentRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/continuous-assessment`,
            { schema: DriftAssessmentDataCollection },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { fields }
                } = request;
                const response = await fetchDriftAssessment(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    fields
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/continuous-assessment`,
            { schema: TriggerDriftAssessmentSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { fields }
                } = request;
                const response = await triggerDriftAssessmentDataCollection(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    [databaseInstanceId],
                    AssessmentTriggeredBy.USER,
                    fields
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/continuous-assessment/optimize/storage`,
            { schema: OptimizeStorageSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId }
                } = request;

                const response = await optimizeStorage({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    optimizationTargets: request.body.assessments
                } as OptimizeStorageParams);
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/continuous-assessment/optimize/sizing`,
            { schema: OptimizeSizingSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    query: { type }
                } = request;

                const response = await optimizeSizing(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    type
                );
                return reply.send(response);
            }
        );
}
