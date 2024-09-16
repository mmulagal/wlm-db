import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    getStorageSavingsSchema,
    getManualStorageSavingsSchema,
    getStorageSavingsCalculationMetricsSchema,
    getManualStorageSavingsCalculationMetricsSchema,
    internalUpdateRecommendationPreferenceSchema
} from './schemas/storage-savings-schema';
import {
    getStorageSavingsCalculationMetrics,
    performStorageSavingsCalculations,
    getManualModeStorageSavingsCalculationMetrics,
    performManualModeStorageSavingsCalculations
} from '../operations/storage-savings-operations';
import { updatePreferences } from '../operations/cron-operations';

export default function storageSavingsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    const API_PATH_STORAGE_SAVINGS =
        '/v1/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings';

    server.put(
        '/v1/internal/recommendation-preferences',
        { schema: internalUpdateRecommendationPreferenceSchema },
        async (_, reply) => {
            updatePreferences();
            return reply.code(202).send({});
        }
    );

    server.post(API_PATH_STORAGE_SAVINGS, { schema: getStorageSavingsSchema }, async (request, reply) => {
        const {
            params: { accountId, credentialsId, region, instanceId },
            body
        } = request;

        const response = await performStorageSavingsCalculations(accountId, credentialsId, region, instanceId, body);
        return reply.send(response);
    });

    server.post(
        `${API_PATH_STORAGE_SAVINGS}/calculations`,
        { schema: getStorageSavingsCalculationMetricsSchema },
        async (request, reply) => {
            const {
                params: { accountId, credentialsId, region, instanceId },
                body
            } = request;

            const response = await getStorageSavingsCalculationMetrics(
                accountId,
                credentialsId,
                region,
                instanceId,
                body
            );
            return reply.send(response);
        }
    );

    server.post(
        '/v1/regions/:region/manual-storage-savings',
        { schema: getManualStorageSavingsSchema },
        async (request, reply) => {
            const {
                params: { accountId, region },
                body
            } = request;

            const response = await performManualModeStorageSavingsCalculations(accountId, region, body);
            return reply.send(response);
        }
    );

    server.post(
        '/v1/regions/:region/manual-storage-savings/calculations',
        { schema: getManualStorageSavingsCalculationMetricsSchema },
        async (request, reply) => {
            const {
                params: { accountId, region },
                body
            } = request;

            const response = await getManualModeStorageSavingsCalculationMetrics(accountId, region, body);
            return reply.send(response);
        }
    );
}
