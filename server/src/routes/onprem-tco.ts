import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { FastifyRequest } from 'fastify';
import castRequest from './utils';
import {
    DownloadOnPremTcoCollectorScriptSchema,
    UploadOnPremTcoDataSchema,
    ListOnPremDatabaseResourcesSchema
} from './schemas/onprem-tco-schema';
import {
    downloadOnpremTcoCollectorScript,
    uploadOnpremTcoData,
    getOnPremDatabaseResources
} from '../operations/onprem-tco-operations';
import { MSSQL } from '../utils/consts';

export default function onPremTcoRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    const API_PATH_ON_PREM_TCO = '/v1/mssql/onprem-tco';

    server.get(
        `${API_PATH_ON_PREM_TCO}/collector`,
        { schema: DownloadOnPremTcoCollectorScriptSchema },
        async (request: FastifyRequest, reply) => {
            const {
                params: { accountId }
            } = castRequest(request);

            const response = await downloadOnpremTcoCollectorScript(accountId, MSSQL);
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
}
