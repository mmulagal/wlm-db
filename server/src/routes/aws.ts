import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { FastifyInstance } from 'fastify/types/instance';
import { GetAmiSchema, GetAdsSchema, GetVpcsListSchema, GetSnsTopics } from './schemas/aws-schemas';
import { getAmiList, getVpcsList } from '../operations/aws/ec2-operations';
import { getSnsTopics } from '../operations/aws/sns-operations';
import { getAdsList } from '../operations/aws/directory-service-operations';

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
}
