import { FastifyInstance } from 'fastify/types/instance';
import { FormConfigParamsType, FormConfigListResponseType } from './types/form-config.types';
import { FormConfigListSchema, FormConfigCreateSchema } from './schemas/form-config-schema';
import { getSavedConfig, saveConfig } from '../operations/database/database-operations';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

const API_PATH_CONFIG: string = '/v1/config';

export default function formConfigRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get<{
        Params: FormConfigParamsType;
        Reply: FormConfigListResponseType;
    }>(
        `${API_PATH_CONFIG}`,
        {
            schema: FormConfigListSchema
        },
        async request => {
            const {
                params: { accountId }
            } = request;
            return getSavedConfig(accountId);
        }
    );

    server.post(
        `${API_PATH_CONFIG}`,
        {
            schema: FormConfigCreateSchema
        },
        async request => {
            const {
                params: { accountId },
                body: { data }
            } = request;
            const { user } = request.headers;
            return saveConfig(accountId, user as string, data);
        }
    );
}
