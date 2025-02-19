import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    fetchDriftAssessment,
    fetchDriftAssessmentPerAccount,
    fetchDriftAssessmentPerHost,
    onDemandTriggerDriftAssessmentDataCollection
} from '../operations/cont-opt-assessment-operations';
import {
    AssessmentTriggeredBy,
    OPTIMIZATION_CATEGORIES,
    OptimizeStorageParams
} from '../utils/continous-optimization-consts';
import {
    DriftAssessmentDataCollection,
    TriggerDriftAssessmentSchema,
    OptimizeStorageSchema,
    OptimizeSizingSchema,
    OptimizeOperatingSystemSchema,
    OptimizeComputeSchema,
    DriftAssessmentPerHost,
    OptimizeStorageTierSchema,
    DriftAssessmentPerAccount,
    BulkOptimizeStorageSizingSchema,
    BulkOptimizeOperatingSystemSchema,
    BulkOptimizeStorageTierSchema,
    BulkOptimizeComputeSchema,
    BulkOptimizeMaxDopSchema
} from './schemas/continuous-optimization-schema';
import {
    optimizeStorage,
    optimizeSizing,
    optimizeOperatingSystemSettings,
    optimizeStorageTier
} from '../operations/cont-opt-optimize-operations';
import optimizeCompute from '../operations/continuous-optimization/compute-optimize-operations';
import castRequest from './utils';
import { bulkComputeOptimization, bulkOptimization } from '../operations/bulk-cont-opt-operations';

const MSSQL_API_PREFIX_PATH = '/v1/mssql/credentials/:credentialsId/regions/:region';

export default function continuousOptimizationRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
            { schema: DriftAssessmentDataCollection },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { fields }
                } = castRequest(request);
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
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
            { schema: TriggerDriftAssessmentSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { fields }
                } = castRequest(request);
                const response = await onDemandTriggerDriftAssessmentDataCollection(
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
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-configuration`,
            { schema: OptimizeStorageSchema },
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
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-sizing`,
            { schema: OptimizeSizingSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    body: { type }
                } = castRequest(request);

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
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-operating-system`,
            { schema: OptimizeOperatingSystemSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    body: { configurationName }
                } = castRequest(request);

                const response = await optimizeOperatingSystemSettings(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    configurationName
                );

                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/compute`,
            { schema: OptimizeComputeSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    body: { instanceType }
                } = castRequest(request);

                const response = await optimizeCompute(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    instanceType
                );
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/assessment`,
            { schema: DriftAssessmentPerHost },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId },
                    query: { fields }
                } = castRequest(request);

                const response = await fetchDriftAssessmentPerHost(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    fields
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-tier`,
            { schema: OptimizeStorageTierSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId }
                } = castRequest(request);

                const response = await optimizeStorageTier(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId
                );
                return reply.send(response);
            }
        )
        .get(`${MSSQL_API_PREFIX_PATH}/assessment`, { schema: DriftAssessmentPerAccount }, async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                query: { fields, nextToken, pageSize }
            } = castRequest(request);

            const response = await fetchDriftAssessmentPerAccount(
                accountId,
                credentialsId,
                region,
                fields,
                nextToken,
                pageSize
            );
            return reply.send(response);
        })
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/optimize/storage-sizing`,
            { schema: BulkOptimizeStorageSizingSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    credentialsId,
                    region,
                    OPTIMIZATION_CATEGORIES.STORAGE_SIZING,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/optimize/storage-operating-system`,
            { schema: BulkOptimizeOperatingSystemSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    credentialsId,
                    region,
                    OPTIMIZATION_CATEGORIES.OPERATING_SYSTEM,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/optimize/storage-tier`,
            { schema: BulkOptimizeStorageTierSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    credentialsId,
                    region,
                    OPTIMIZATION_CATEGORIES.STORAGE_TIER,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/optimize/compute`,
            { schema: BulkOptimizeComputeSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkComputeOptimization(accountId, credentialsId, region, hostsToOptimize);
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/optimize/max-dop`,
            { schema: BulkOptimizeMaxDopSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    credentialsId,
                    region,
                    OPTIMIZATION_CATEGORIES.MAXDOP,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        );
}
