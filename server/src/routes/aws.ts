import { FastifyInstance } from 'fastify/types/instance';
import { GetAmiSchema, GetVpcsListSchema, GetAdsSchema } from './schemas/aws-schemas';
import {
    VpcResponseType,
    AmiResponseType,
    AwsParamType,
    AwsVpcQueryStringType,
    AdsResponseType,
    AdsParamsType
} from './types/aws.types';
import { getAmiList, getVpcsList } from '../operations/aws/ec2-operations';
import { getAdsList } from '../operations/aws/directory-service-operations';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';

export default function awsRoutes(fastify: FastifyInstance) {
    fastify
        .get<{ Reply: VpcResponseType; Params: AwsParamType; Querystring: AwsVpcQueryStringType }>(
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
        )
        .get<{ Reply: AdsResponseType; Params: AdsParamsType }>(
            `${API_PREFIX_PATH}/vpcs/:vpcId/ads`,
            { schema: GetAdsSchema },
            async (request, reply) => {
                const {
                    params: { credentialsId, region, vpcId }
                } = request;
                const response = await getAdsList(credentialsId, region, vpcId);
                return reply.send(response);
            }
        )
        .get<{ Reply: AmiResponseType; Params: AwsParamType }>(
            `${API_PREFIX_PATH}/amis`,
            { schema: GetAmiSchema },
            async (request, reply) => {
                const {
                    params: { credentialsId, region }
                } = request;
                const response = await getAmiList(credentialsId, region);
                return reply.send(response);
            }
        );
}
