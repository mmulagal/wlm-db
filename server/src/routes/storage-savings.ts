import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { FastifyRequest } from 'fastify';
import {
    internalUpdateRecommendationPreferenceSchema,
    getEbsStorageSavingsSchema,
    getFsxwStorageSavingsSchema,
    getEbsStorageSavingsCalculationMetricsSchema,
    getFsxwStorageSavingsCalculationMetricsSchema,
    getEbsManualStorageSavingsSchema,
    getFsxwManualStorageSavingsSchema,
    getEbsManualStorageSavingsCalculationMetricsSchema,
    getFsxwManualStorageSavingsCalculationMetricsSchema,
    getEbsBulkStorageSavingsSchema,
    getEbsBulkStorageSavingsCalculationMetricsSchema,
    getOracleEbsBulkStorageSavingsSchema,
    getOracleEbsBulkStorageSavingsCalculationMetricsSchema
} from './schemas/storage-savings-schema';
import {
    getManualModeStorageSavingsCalculationMetrics,
    getStorageSavingsCalculationMetrics,
    performManualModeStorageSavingsCalculations,
    performStorageSavingsCalculations
} from '../operations/workloads/mssql/mssql-storage-savings-operations';
import { updateManagedInstRecPrefs, updateTcoInstRecPrefs } from '../operations/cron-operations';
import castRequest from './utils';
import {
    BulkStorageSavingsRequestBodyType,
    ManualStorageSavingsRequestBodyType,
    OracleBulkStorageSavingsRequestBodyType,
    StorageSavingsRequestBodyType
} from './types/storage-savings.types';
import {
    getOracleBulkStorageSavingsCalculationMetrics,
    performOracleBulkStorageSavingsCalculations
} from '../operations/workloads/oracle/oracle-storage-savings-operations';

export default function storageSavingsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
    const API_PATH_STORAGE_SAVINGS =
        '/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings';
    const API_PATH_BULK_STORAGE_SAVINGS = '/v1/mssql/credentials/:credentialsId/regions/:region/storage-savings';
    const API_PATH_ORACLE_BULK_STORAGE_SAVINGS =
        '/v1/oracle/credentials/:credentialsId/regions/:region/storage-savings';

    const API_PATH_MANUAL_STORAGE_SAVINGS = '/v1/mssql/regions/:region/manual-storage-savings';

    server.put(
        '/v1/internal/recommendation-preferences',
        { schema: internalUpdateRecommendationPreferenceSchema },
        async (request: FastifyRequest, reply) => {
            const { query } = castRequest(request);
            if (query.fields?.includes('tco')) {
                updateTcoInstRecPrefs();
            }
            if (query.fields?.includes('continuous')) {
                updateManagedInstRecPrefs();
            }
            return reply.code(202).send({});
        }
    );

    server.post(
        `${API_PATH_STORAGE_SAVINGS}/ebs`,
        { schema: getEbsStorageSavingsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, credentialsId, region, instanceId },
                body
            } = castRequest(request);

            const response = await performStorageSavingsCalculations(
                accountId,
                credentialsId,
                region,
                [instanceId],
                body as StorageSavingsRequestBodyType
            );
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_STORAGE_SAVINGS}/fsxw`,
        { schema: getFsxwStorageSavingsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, credentialsId, region, instanceId },
                body
            } = castRequest(request);

            const response = await performStorageSavingsCalculations(
                accountId,
                credentialsId,
                region,
                [instanceId],
                body as StorageSavingsRequestBodyType
            );
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_STORAGE_SAVINGS}/ebs/calculations`,
        { schema: getEbsStorageSavingsCalculationMetricsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, credentialsId, region, instanceId },
                body
            } = castRequest(request);

            const response = await getStorageSavingsCalculationMetrics(
                accountId,
                credentialsId,
                region,
                [instanceId],
                body as StorageSavingsRequestBodyType
            );
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_STORAGE_SAVINGS}/fsxw/calculations`,
        { schema: getFsxwStorageSavingsCalculationMetricsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, credentialsId, region, instanceId },
                body
            } = castRequest(request);

            const response = await getStorageSavingsCalculationMetrics(
                accountId,
                credentialsId,
                region,
                [instanceId],
                body as StorageSavingsRequestBodyType
            );
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_MANUAL_STORAGE_SAVINGS}/ebs`,
        { schema: getEbsManualStorageSavingsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, region },
                body
            } = castRequest(request);

            const response = await performManualModeStorageSavingsCalculations(
                accountId,
                region,
                body as ManualStorageSavingsRequestBodyType
            );
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_MANUAL_STORAGE_SAVINGS}/fsxw`,
        { schema: getFsxwManualStorageSavingsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, region },
                body
            } = castRequest(request);

            const response = await performManualModeStorageSavingsCalculations(
                accountId,
                region,
                body as ManualStorageSavingsRequestBodyType
            );
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_MANUAL_STORAGE_SAVINGS}/ebs/calculations`,
        { schema: getEbsManualStorageSavingsCalculationMetricsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, region },
                body
            } = castRequest(request);

            const response = await getManualModeStorageSavingsCalculationMetrics(
                accountId,
                region,
                body as ManualStorageSavingsRequestBodyType
            );
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_MANUAL_STORAGE_SAVINGS}/fsxw/calculations`,
        { schema: getFsxwManualStorageSavingsCalculationMetricsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, region },
                body
            } = castRequest(request);

            const response = await getManualModeStorageSavingsCalculationMetrics(
                accountId,
                region,
                body as ManualStorageSavingsRequestBodyType
            );
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_BULK_STORAGE_SAVINGS}/ebs`,
        { schema: getEbsBulkStorageSavingsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, credentialsId, region },
                body,
                body: { hosts }
            } = castRequest(request);

            const instanceIds = hosts.map(({ ec2InstanceId }: { ec2InstanceId: string }) => ec2InstanceId);
            const response = await performStorageSavingsCalculations(accountId, credentialsId, region, instanceIds, {
                ...body,
                bulk: true
            } as BulkStorageSavingsRequestBodyType);
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_BULK_STORAGE_SAVINGS}/ebs/calculations`,
        { schema: getEbsBulkStorageSavingsCalculationMetricsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, credentialsId, region },
                body,
                body: { hosts }
            } = castRequest(request);

            const instanceIds = hosts.map(({ ec2InstanceId }: { ec2InstanceId: string }) => ec2InstanceId);
            const response = await getStorageSavingsCalculationMetrics(accountId, credentialsId, region, instanceIds, {
                ...body,
                bulk: true
            } as BulkStorageSavingsRequestBodyType);
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_ORACLE_BULK_STORAGE_SAVINGS}/ebs`,
        { schema: getOracleEbsBulkStorageSavingsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, credentialsId, region },
                body,
                body: { hosts }
            } = castRequest(request);
            const instanceIds = hosts.map(({ ec2InstanceId }: { ec2InstanceId: string }) => ec2InstanceId);
            const response = await performOracleBulkStorageSavingsCalculations(
                accountId,
                credentialsId,
                region,
                instanceIds,
                { ...body, bulk: true } as OracleBulkStorageSavingsRequestBodyType
            );
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_ORACLE_BULK_STORAGE_SAVINGS}/ebs/calculations`,
        { schema: getOracleEbsBulkStorageSavingsCalculationMetricsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, credentialsId, region },
                body,
                body: { hosts }
            } = castRequest(request);
            const instanceIds = hosts.map(({ ec2InstanceId }: { ec2InstanceId: string }) => ec2InstanceId);
            const response = await getOracleBulkStorageSavingsCalculationMetrics(
                accountId,
                credentialsId,
                region,
                instanceIds,
                { ...body, bulk: true } as OracleBulkStorageSavingsRequestBodyType
            );
            return reply.send(response);
        }
    );
}
