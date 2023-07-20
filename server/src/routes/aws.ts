import { FastifyInstance } from 'fastify/types/instance';
import { GetAmiSchema, getVpcsListSchema } from './schemas/aws-schemas';
import { VpcResponseType, IParamType, AmiResponseType } from './types/aws.types';
import { getAmiList, getVpcsList } from '../operations/aws/aws-operations';

const API_PATH_AWS = '/v1/credentials/:credentialsId/regions/:region';

export default function awsRoutes(fastify: FastifyInstance) {
    fastify.get<{ Reply: VpcResponseType; Params: IParamType }>(`${API_PATH_AWS}/vpcs`, { schema: getVpcsListSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region },
        } = request;
        const response = await getVpcsList(credentialsId, region);
        return reply.send(response);
    });

    fastify.get<{ Reply: AmiResponseType; Params: IParamType }>(`${API_PATH_AWS}/amis`, { schema: GetAmiSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region },
        } = request;
        const response = await getAmiList(credentialsId, region);
        return reply.send(response);
    });
}
