import { FastifyInstance } from 'fastify/types/instance';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
    FormConfigListSchema,
    FormConfigCreateSchema,
    FormConfigObjectSchema,
    FormConfigObjectDeleteSchema,
    FormConfigUpdateSchema
} from './schemas/form-config-schema';
import {
    deleteSavedConfig,
    getAllSavedConfig,
    getSavedConfig,
    modifyConfig,
    saveConfig
} from '../operations/database/database-operations';
import castRequest from './utils';

const API_PATH_CONFIG: string = '/v1/configs';

export default function formConfigRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(
        `${API_PATH_CONFIG}`,
        {
            schema: FormConfigListSchema
        },
        async request => {
            const {
                params: { accountId }
            } = castRequest(request);
            return getAllSavedConfig(accountId);
        }
    );

    server.get(
        `${API_PATH_CONFIG}/:id`,
        {
            schema: FormConfigObjectSchema
        },
        async request => {
            const {
                params: { accountId, id }
            } = castRequest(request);
            return getSavedConfig(accountId, id);
        }
    );

    server.delete(
        `${API_PATH_CONFIG}/:id`,
        {
            schema: FormConfigObjectDeleteSchema
        },
        async request => {
            const {
                params: { accountId, id }
            } = castRequest(request);
            return deleteSavedConfig(accountId, id);
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
                body: { name, data, databaseType }
            } = castRequest(request);
            const { user } = request.headers;
            return saveConfig(accountId, user as string, name, data, databaseType);
        }
    );

    server.patch(
        `${API_PATH_CONFIG}/:id`,
        {
            schema: FormConfigUpdateSchema
        },
        async request => {
            const {
                params: { accountId, id },
                body: { name, data }
            } = castRequest(request);
            return modifyConfig(accountId, id, name, data);
        }
    );
}
