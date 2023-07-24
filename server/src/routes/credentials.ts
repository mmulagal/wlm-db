import { FastifyInstance } from 'fastify/types/instance';
import { CredentialsResponseType, CredentialsListParamsType } from './types/credentials.types';
import { CredentialsSchema } from './schemas/generic-schemas';
import { getAwsCredentials } from '../operations/cloud-manager/credentials-operations';

const API_PATH_ACCOUNTS: string = '/accounts/:accountId/v1'

export default function credentialsRoutes(fastify: FastifyInstance) {
    fastify
        .get<{
            Params: CredentialsListParamsType;
            Reply: CredentialsResponseType; }>(
            `${API_PATH_ACCOUNTS}/credentials/:credentialsType`,
            {
                schema: CredentialsSchema
            },
            async (request) => {
                const {
                    params:{ credentialsType }
                } = request;
                return getAwsCredentials(credentialsType);
            }
        )}