import { FastifyInstance } from 'fastify/types/instance';
import { GetVpcsListSchema } from './schemas/aws-schemas';
import { VpcResponseType, AwsParamType, AwsQueryStringType } from './types/aws.types';
import { getVpcsList } from '../operations/aws/ec2-operations';

export default function awsRoutes(fastify: FastifyInstance) {
    fastify.get<{ Reply: VpcResponseType; Params: AwsParamType; Querystring: AwsQueryStringType }>(
        '/accounts/:accountId/credentials/:credentialsId/regions/:region/vpcs',
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
}
