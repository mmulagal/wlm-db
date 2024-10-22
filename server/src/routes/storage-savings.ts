import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    internalUpdateRecommendationPreferenceSchema,
    getEbsStorageSavingsSchema,
    getFsxwStorageSavingsSchema,
    getEbsStorageSavingsCalculationMetricsSchema,
    getFsxwStorageSavingsCalculationMetricsSchema,
    getEbsManualStorageSavingsSchema,
    getFsxwManualStorageSavingsSchema,
    getEbsManualStorageSavingsCalculationMetricsSchema,
    getFsxwManualStorageSavingsCalculationMetricsSchema
} from './schemas/storage-savings-schema';
import {
    getStorageSavingsCalculationMetrics,
    performStorageSavingsCalculations,
    getManualModeStorageSavingsCalculationMetrics,
    performManualModeStorageSavingsCalculations
} from '../operations/storage-savings-operations';
import { updateManagedInstRecPrefs, updateTcoInstRecPrefs } from '../operations/cron-operations';

export default function storageSavingsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    const API_PATH_STORAGE_SAVINGS =
        '/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings';

    const API_PATH_MANUAL_STORAGE_SAVINGS = '/v1/mssql/regions/:region/manual-storage-savings';

    server.put(
        '/v1/internal/recommendation-preferences',
        { schema: internalUpdateRecommendationPreferenceSchema },
        async (request, reply) => {
            const { query } = request;
            if (query.fields?.includes('tco')) {
                updateTcoInstRecPrefs();
            }
            if (query.fields?.includes('continuous')) {
                updateManagedInstRecPrefs();
            }
            return reply.code(202).send({});
        }
    );

    server.post(`${API_PATH_STORAGE_SAVINGS}/ebs`, { schema: getEbsStorageSavingsSchema }, async (request, reply) => {
        const {
            params: { accountId, credentialsId, region, instanceId },
            body
        } = request;

        const response = await performStorageSavingsCalculations(accountId, credentialsId, region, instanceId, body);
        return reply.send(response);
    });

    server.post(`${API_PATH_STORAGE_SAVINGS}/fsxw`, { schema: getFsxwStorageSavingsSchema }, async (request, reply) => {
        const {
            params: { accountId, credentialsId, region, instanceId },
            body
        } = request;

        const response = await performStorageSavingsCalculations(accountId, credentialsId, region, instanceId, body);
        return reply.send(response);
    });

    server.post(
        `${API_PATH_STORAGE_SAVINGS}/ebs/calculations`,
        { schema: getEbsStorageSavingsCalculationMetricsSchema },
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
        `${API_PATH_STORAGE_SAVINGS}/fsxw/calculations`,
        { schema: getFsxwStorageSavingsCalculationMetricsSchema },
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
        `${API_PATH_MANUAL_STORAGE_SAVINGS}/ebs`,
        { schema: getEbsManualStorageSavingsSchema },
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
        `${API_PATH_MANUAL_STORAGE_SAVINGS}/fsxw`,
        { schema: getFsxwManualStorageSavingsSchema },
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
        `${API_PATH_MANUAL_STORAGE_SAVINGS}/ebs/calculations`,
        { schema: getEbsManualStorageSavingsCalculationMetricsSchema },
        async (request, reply) => {
            const {
                params: { accountId, region },
                body
            } = request;

            const response = await getManualModeStorageSavingsCalculationMetrics(accountId, region, body);
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_MANUAL_STORAGE_SAVINGS}/fsxw/calculations`,
        { schema: getFsxwManualStorageSavingsCalculationMetricsSchema },
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
