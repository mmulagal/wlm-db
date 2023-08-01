import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { FastifyInstance } from 'fastify/types/instance';
import {
    GetAmiSchema,
    GetVpcsListSchema,
    GetAdsSchema,
    GetKmsKeysListSchema,
    GetSnsTopics,
    GetFSxRegionsSchema,
    GetKeyPairsSchema
} from './schemas/aws-schemas';
import { getAmiList, getVpcsList, getFSxAvailableRegionsList, getKeyPairsList } from '../operations/aws/ec2-operations';
import { getSnsTopics } from '../operations/aws/sns-operations';
import { getAdsList } from '../operations/aws/directory-service-operations';
import { getKmsKeysList } from '../operations/aws/kms-operations';
import { createTemplate } from '../operations/aws/cloud-formation-operations';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';

export default function awsRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.get(`${API_PREFIX_PATH}/vpcs`, { schema: GetVpcsListSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region },
            query: { fields }
        } = request;
        const response = await getVpcsList(credentialsId, region, fields);
        return reply.send(response);
    });

    server.get(`${API_PREFIX_PATH}/amis`, { schema: GetAmiSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region },
            query: { osType, databaseType, osVersion, databaseEdition, databaseVersion }
        } = request;
        const response = await getAmiList(
            credentialsId,
            region,
            osType,
            databaseType,
            osVersion,
            databaseVersion,
            databaseEdition
        );
        return reply.send(response);
    });

    server.get(`${API_PREFIX_PATH}/snsTopics`, { schema: GetSnsTopics }, async (request, reply) => {
        const {
            params: { credentialsId, region }
        } = request;
        const response = await getSnsTopics(credentialsId, region);
        return reply.send(response);
    });

    server.get(`${API_PREFIX_PATH}/ads`, { schema: GetAdsSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region }
        } = request;
        const response = await getAdsList(credentialsId, region);
        return reply.send(response);
    });

    server.get(
        '/v1/credentials/:credentialsId/aws/fsx/regions',
        { schema: GetFSxRegionsSchema },
        async (request, reply) => {
            const {
                params: { credentialsId }
            } = request;

            const response = await getFSxAvailableRegionsList(credentialsId);

            return reply.send(response);
        }
    );

    server.get(`${API_PREFIX_PATH}/kmsKeys`, { schema: GetKmsKeysListSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region }
        } = request;
        const response = await getKmsKeysList(credentialsId, region);
        return reply.send(response);
    });

    server.get(`${API_PREFIX_PATH}/keypairs`, { schema: GetKeyPairsSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region }
        } = request;

        const response = await getKeyPairsList(credentialsId, region);
        return reply.send(response);
    });

    server.post(
        `${API_PREFIX_PATH}/vpcs/:vpcId/template/create`,
        { schema: CreateTemplateSchema },
        async (request, reply) => {
            const {
                params: { credentialsId, region, vpcId }
            } = request;
            const response = await createTemplate(credentialsId, region, vpcId);
            return reply.send(response);
        }
    );
}
