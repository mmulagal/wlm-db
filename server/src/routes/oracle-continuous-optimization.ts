import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { AssessmentTriggeredBy, OptimizeStorageParams } from '../utils/continous-optimization-consts';
import { TriggerDriftAssessmentSchema } from './schemas/mssql-continuous-optimization-schema';
import castRequest from './utils';
import {
    fetchOracleDriftAssessment,
    fetchOracleDriftAssessmentPerAccount,
    fetchOracleDriftAssessmentPerHost,
    onDemandTriggerOracleDriftAssessment
} from '../operations/continuous-optimization/oracle/assessment-operations';
import {
    DriftAssessmentDataCollection,
    DriftAssessmentPerAccount,
    DriftAssessmentPerHost,
    OracleOptimizeStorageSchema
} from './schemas/oracle-continuous-optimization-schema';
import { optimizeStorage } from '../operations/cont-opt-optimize-operations';

const API_PREFIX_PATH = '/v1/oracle/credentials/:credentialsId/regions/:region';

export default function oracleContinuousOptimizationRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .post(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
            { schema: TriggerDriftAssessmentSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { fields }
                } = castRequest(request);
                const response = await onDemandTriggerOracleDriftAssessment(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    AssessmentTriggeredBy.USER,
                    fields
                );
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
            { schema: DriftAssessmentDataCollection },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { fields }
                } = castRequest(request);
                const response = await fetchOracleDriftAssessment(
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
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-configuration`,
            { schema: OracleOptimizeStorageSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    body: { assessments }
                } = castRequest(request);

                const response = await optimizeStorage({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    optimizationTargets: assessments
                } as OptimizeStorageParams);
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/assessment`,
            { schema: DriftAssessmentPerHost },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId }
                } = castRequest(request);

                const response = await fetchOracleDriftAssessmentPerHost(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId
                );
                return reply.send(response);
            }
        )
        .get(`${API_PREFIX_PATH}/assessment`, { schema: DriftAssessmentPerAccount }, async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                query: { nextToken, pageSize }
            } = castRequest(request);

            const response = await fetchOracleDriftAssessmentPerAccount(
                accountId,
                credentialsId,
                region,
                nextToken,
                pageSize
            );
            return reply.send(response);
        });
}
