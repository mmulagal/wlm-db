import { FastifyInstance } from 'fastify/types/instance';
import { getVpcsListSchema } from '../validation/routes-schema-validation';
import { VpcResponseType } from '../types/route-types';
import { getVpcsList } from '../operations/aws/aws';

interface IParam {
    accountId: string,
    credentialsId: string,
    region: string
}

export default function awsRoutes(fastify: FastifyInstance) {
    fastify
        .get<{ Reply: VpcResponseType, Params: IParam }>(
            '/accounts/:accountId/credentials/:credentialsId/regions/:region/vpcs',
            { schema: getVpcsListSchema },
            async (request, reply) => {
                const { params: { credentialsId, region }} = request;
                const response = await getVpcsList(credentialsId, region);
                return reply.send(response);
            }
        );
}
