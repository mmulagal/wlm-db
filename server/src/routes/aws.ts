import { FastifyInstance } from 'fastify/types/instance';
import { GetAmiSchema, GetVpcsListSchema } from './schemas/aws-schemas';
import { VpcResponseType, AmiResponseType, AwsParamType, AwsQueryStringType } from './types/aws.types';
import { getAmiList, getVpcsList } from '../operations/aws/ec2-operations';

const API_PATH_AWS = '/v1/credentials/:credentialsId/regions/:region';

export default function awsRoutes(fastify: FastifyInstance) {
    fastify.get<{ Reply: VpcResponseType; Params: AwsParamType; Querystring: AwsQueryStringType }>(
        `${API_PATH_AWS}/vpcs`,
        { schema: GetVpcsListSchema },
        async (request, reply) => {
            const {
                params: { credentialsId, region },
                query: { fields },
            } = request;
            const response = await getVpcsList(credentialsId, region, fields);
            return reply.send(response);
        }
    );

    fastify.get<{ Reply: AmiResponseType; Params: AwsParamType }>(`${API_PATH_AWS}/amis`, { schema: GetAmiSchema }, async (request, reply) => {
        const {
            params: { credentialsId, region },
        } = request;
        const response = await getAmiList(credentialsId, region);
        return reply.send(response);
    });
}
