import { FastifyInstance } from 'fastify/types/instance';
import { CredentialsResponseType } from './types/credentials.types';
import { CredentialsSchema } from './schemas/generic-schemas';
import { AccountIdParamsType } from './types/generic.types';
import { getAwsCredentials } from '../operations/cloud-manager/credentials';

const API_PATH_ACCOUNTS: string = '/v1/wlm-db/accounts/:accountId'

export default function credentialsRoutes(fastify: FastifyInstance) {
    fastify
        .get<{
            Params: AccountIdParamsType;
            Reply: CredentialsResponseType; }>(
            `${API_PATH_ACCOUNTS}/credentials`,
            {
                schema: CredentialsSchema
            },
            async request => {
                const {
                    params: { accountId }
                } = request;
                return getAwsCredentials(accountId);
            }
        )}