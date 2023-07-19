import { FastifyInstance } from 'fastify/types/instance';
import { getVpcsListSchema } from './schemas/aws-schemas';
import { VpcResponseType, IParamType } from './types/aws.types';
import { getVpcsList } from '../operations/aws/aws-operations';

export default function awsRoutes(fastify: FastifyInstance) {
    fastify.get<{ Reply: VpcResponseType; Params: IParamType }>('/accounts/:accountId/credentials/:credentialsId/regions/:region/vpcs', { schema: getVpcsListSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region },
        } = request;
        const response = await getVpcsList(credentialsId, region);
        return reply.send(response);
    });
}
