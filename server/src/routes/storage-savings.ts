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
    emailCalculationsSchema
} from './schemas/storage-savings-schema';
import {
    getStorageSavingsCalculationMetrics,
    performStorageSavingsCalculations,
    getManualModeStorageSavingsCalculationMetrics,
    performManualModeStorageSavingsCalculations,
    emailCalculations
} from '../operations/storage-savings-operations';
import { updateManagedInstRecPrefs, updateTcoInstRecPrefs } from '../operations/cron-operations';
import castRequest from './utils';
import { ManualStorageSavingsRequestBodyType, StorageSavingsRequestBodyType } from './types/storage-savings.types';
import { HttpErrorCodes, MAX_ATTACHMENT_FILE_SIZE_KB } from '../utils/consts';
import { isValidEmail } from '../utils/utils';
import { MultipartFile } from '@fastify/multipart';

export default function storageSavingsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
    const API_PATH_STORAGE_SAVINGS =
        '/v1/mssql/credentials/:credentialsId/regions/:region/instances/:instanceId/storage-savings';

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
                instanceId,
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
                instanceId,
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
                instanceId,
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
                instanceId,
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
        `${API_PATH_STORAGE_SAVINGS}/email/calculations`,
        { schema: emailCalculationsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId }
            } = castRequest(request);

            if (!request.isMultipart()) {
                return reply.status(400).send({ message: 'No calculations file attached' });
            }

            let fileBuffer: Buffer | undefined;
            let fileName = '';
            let userEmail = '';
            let storageType = '';

            const parts = request.parts();
            for await (const part of parts) {
                if (part.type === 'file') {
                    const file = part as MultipartFile;
                    fileName = file.filename;
                    fileBuffer = await file.toBuffer();
                    // fileName = part.filename;
                    // fileBuffer = await new Promise<Buffer>((resolve, reject) => {
                    //     const chunks: Buffer[] = [];
                    //     fileBuffer = await file.toBuffer();
                    // part.file.on('data', chunk => chunks.push(chunk));
                    // part.file.on('end', () => resolve(Buffer.concat(chunks)));
                    // part.file.on('error', reject);
                    // });
                } else if (part.type === 'field' && part.fieldname === 'userEmail') {
                    userEmail = part.value as string;
                } else if (part.type === 'field' && part.fieldname === 'storageType') {
                    storageType = part.value as string;
                }
            }

            switch (true) {
                case !fileBuffer || !fileName:
                    return reply.status(HttpErrorCodes.BAD_REQUEST).send({ message: 'Missing file' });
                case userEmail && !isValidEmail(userEmail):
                    return reply.status(HttpErrorCodes.BAD_REQUEST).send({ message: 'Invalid user email' });
                case storageType && !['ebs', 'fsxw', 'onprem'].includes(storageType):
                    return reply.status(HttpErrorCodes.BAD_REQUEST).send({ message: 'Invalid storage type' });
                case fileBuffer && fileBuffer.length / 1024 > MAX_ATTACHMENT_FILE_SIZE_KB:
                    return reply.status(HttpErrorCodes.BAD_REQUEST).send({ message: 'File size exceeds the limit' });
                case !fileName?.endsWith('.pdf'):
                    return reply
                        .status(HttpErrorCodes.BAD_REQUEST)
                        .send({ message: 'Invalid file format, only PDF files are allowed' });
            }

            const response = await emailCalculations(accountId, fileBuffer, fileName, userEmail, storageType);
            return reply.send(response);
        }
    );
}
