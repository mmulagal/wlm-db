import { FastifyInstance } from 'fastify/types/instance';
import {
    FormConfigListParamsType,
    FormConfigListResponseType,
    FormConfigObjectParamsType,
    FormConfigObjectResponseType
} from './types/form-config.types';
import { FormConfigListSchema, FormConfigCreateSchema, FormConfigObjectSchema } from './schemas/form-config-schema';
import { getAllSavedConfig, getSavedConfig, saveConfig } from '../operations/database/database-operations';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

const API_PATH_CONFIG: string = '/v1/config';

export default function formConfigRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get<{
        Params: FormConfigListParamsType;
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
            return getAllSavedConfig(accountId);
        }
    );

    server.get<{
        Params: FormConfigObjectParamsType;
        Reply: FormConfigObjectResponseType;
    }>(
        `${API_PATH_CONFIG}`,
        {
            schema: FormConfigObjectSchema
        },
        async request => {
            const {
                params: { accountId, id }
            } = request;
            return getSavedConfig(accountId, id);
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
                body: { name, data }
            } = request;
            const { user } = request.headers;
            return saveConfig(accountId, user as string, name, data);
        }
    );
}
