import { FastifyInstance } from 'fastify/types/instance';
import { CredentialsResponseType, CredentialsListParamsType } from './types/credentials.types';
import { CredentialsSchema } from './schemas/generic-schemas';
import { getCredentials } from '../operations/cloud-manager/credentials-operations';

const API_PATH_ACCOUNTS: string = '/v1/credentials/:credentialsType';

export default function credentialsRoutes(fastify: FastifyInstance) {
    fastify.get<{
        Params: CredentialsListParamsType;
        Reply: CredentialsResponseType;
    }>(
        `${API_PATH_ACCOUNTS}`,
        {
            schema: CredentialsSchema
        },
        async request => {
            const {
                params: { credentialsType }
            } = request;
            return getCredentials(credentialsType);
        }
    );
}
