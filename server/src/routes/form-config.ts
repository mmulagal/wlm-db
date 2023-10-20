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

const API_PATH_CONFIG: string = '/v1/config';

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
            } = request;
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
            } = request;
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
            } = request;
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
                body: { name, data }
            } = request;
            const { user } = request.headers;
            return saveConfig(accountId, user as string, name, data);
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
            } = request;
            return modifyConfig(accountId, id, name, data);
        }
    );
}
