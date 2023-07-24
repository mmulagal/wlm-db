import { FastifyInstance } from 'fastify/types/instance';
import { GetVpcsListSchema } from './schemas/aws-schemas';
import { VpcResponseType, AwsParamType, AwsQueryStringType } from './types/aws.types';
import { getVpcsList } from '../operations/aws/ec2-operations';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';

export default function awsRoutes(fastify: FastifyInstance) {
    fastify.get<{ Reply: VpcResponseType; Params: AwsParamType; Querystring: AwsQueryStringType }>(
        `${API_PREFIX_PATH}/vpcs`,
        { schema: GetVpcsListSchema },
        async (request, reply) => {
            const {
                params: { credentialsId, region },
                query: { fields }
            } = request;
            const response = await getVpcsList(credentialsId, region, fields);
            return reply.send(response);
        }
    );
}
