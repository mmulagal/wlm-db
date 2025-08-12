import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { AssessmentTriggeredBy } from '../utils/continous-optimization-consts';
import { TriggerDriftAssessmentSchema } from './schemas/continuous-optimization-schema';
import castRequest from './utils';
import {
    fetchOracleDriftAssessment,
    onDemandTriggerOracleDriftAssessment
} from '../operations/continuous-optimization/oracle/assessment-operations';
import { DriftAssessmentDataCollection } from './schemas/oracle-continuous-optimization-schema';

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
        );
}
