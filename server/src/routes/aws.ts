import { FastifyInstance } from 'fastify/types/instance';
import { AdsSchema, GetVpcsListSchema } from './schemas/aws-schemas';
import { VpcResponseType,AwsParamType, AwsQueryStringType, AdsResponseType, AdsParamsType } from './types/aws.types';
import { getVpcsList } from '../operations/aws/ec2-operations';
import { getAdsList } from '../operations/aws/directory-service-operations';

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
    )
    .get<{ Reply: AdsResponseType, Params: AdsParamsType }>(
        '/accounts/:accountId/credentials/:credentialsId/regions/:region/vpcs/:vpcId/ads',
        { schema: AdsSchema },
        async (request, reply) => {
            const { 
                params: { credentialsId, region, vpcId }
            } = request;
            const response = await getAdsList(credentialsId, region, vpcId);
            return reply.send(response);
        }
    );
}
