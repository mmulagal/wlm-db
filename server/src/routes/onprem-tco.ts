import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { MultipartFile } from '@fastify/multipart';
import { FastifyInstance } from 'fastify/types/instance';
import { FastifyRequest } from 'fastify';
import castRequest from './utils';
import {
    DownloadSqlServerDataCollectorScriptSchema,
    UploadOnPremTcoDataSchema,
    ListOnPremDatabaseResourcesSchema,
    GeneratePayloadInternal,
    DeleteOnPremReport,
    OnpremTcoExploreSavingsSchema,
    GetOnPremDatabaseResourceSchema,
    BulkOnpremTcoExploreSavingsSchema
} from './schemas/onprem-tco-schema';
import {
    downloadSqlServerDataCollectorScript,
    uploadOnpremTcoData,
    getOnPremDatabaseResources,
    generatePayload,
    deleteOnPremTcoReportResourceRecord,
    getOnPremResourceExploreSavings,
    getOnPremBulkResourceExploreSavings,
    getIndividualOnPremDatabaseResource
} from '../operations/onprem-tco-operations';
import { MSSQL } from '../utils/consts';

export default function onPremTcoRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();
    const API_PATH_ON_PREM_TCO = '/v1/mssql/onprem-tco';

    if (process.env.NODE_ENV !== 'production') {
        server.post(
            `${API_PATH_ON_PREM_TCO}/internal/payload`,
            { schema: GeneratePayloadInternal },
            async (request: FastifyRequest, reply) => {
                const {
                    params: { accountId }
                } = castRequest(request);

                const parts = request.parts();
                let fileName = '';
                let fileContent: Buffer | null = null;
                for await (const part of parts) {
                    if (part.type === 'file') {
                        const file = part as MultipartFile;
                        fileName = file.filename;
                        fileContent = await file.toBuffer();
                    }
                }

                if (!fileContent) {
                    return reply.status(400).send({ message: 'No file found in the request' });
                }

                const response = await generatePayload(accountId, fileName, fileContent);
                return reply.send(response);
            }
        );
    }

    server.get(
        `${API_PATH_ON_PREM_TCO}/collector`,
        { schema: DownloadSqlServerDataCollectorScriptSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId }
            } = castRequest(request);

            const response = await downloadSqlServerDataCollectorScript(accountId, MSSQL);
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_ON_PREM_TCO}/upload`,
        { schema: UploadOnPremTcoDataSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId },
                body: { fileName, fileContent }
            } = castRequest(request);

            const response = await uploadOnpremTcoData(accountId, MSSQL, fileName, fileContent);
            return reply.send(response);
        }
    );

    server.get(
        `${API_PATH_ON_PREM_TCO}/resources`,
        { schema: ListOnPremDatabaseResourcesSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId },
                query: { nextToken, pageSize }
            } = castRequest(request);

            const response = await getOnPremDatabaseResources(accountId, MSSQL, pageSize, nextToken);
            return reply.send(response);
        }
    );

    server.get(
        `${API_PATH_ON_PREM_TCO}/resources/:resourceId`,
        { schema: GetOnPremDatabaseResourceSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, resourceId }
            } = castRequest(request);

            const response = await getIndividualOnPremDatabaseResource(accountId, resourceId, MSSQL);
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_ON_PREM_TCO}/resources/:resourceId/explore-savings`,
        { schema: OnpremTcoExploreSavingsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, resourceId },
                body: { regionCode, sqlInstanceData, snapshotInfo }
            } = castRequest(request);

            const response = await getOnPremResourceExploreSavings(
                accountId,
                resourceId,
                regionCode,
                sqlInstanceData,
                snapshotInfo
            );
            return reply.send(response);
        }
    );

    server.post(
        `${API_PATH_ON_PREM_TCO}/explore-savings`,
        { schema: BulkOnpremTcoExploreSavingsSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId },
                body: { regionCode, resources, snapshotInfo }
            } = castRequest(request);

            const response = await getOnPremBulkResourceExploreSavings(accountId, regionCode, resources, snapshotInfo);
            return reply.send(response);
        }
    );

    server.delete(
        `${API_PATH_ON_PREM_TCO}/resources/:resourceId`,
        { schema: DeleteOnPremReport },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId, resourceId }
            } = castRequest(request);

            const response = await deleteOnPremTcoReportResourceRecord(accountId, resourceId, MSSQL);
            return reply.send(response);
        }
    );
}
