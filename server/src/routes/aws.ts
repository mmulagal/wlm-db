import { FastifyInstance } from 'fastify/types/instance';
import { GetAmiSchema, GetVpcsListSchema, GetFSxRegionsSchema } from './schemas/aws-schemas';
import { VpcResponseType, AmiResponseType, AwsParamsType, AwsVpcQueryStringType, FSxRegionsResponseType } from './types/aws.types';
import { getAmiList, getVpcsList, getFSxAvailableRegionsList } from '../operations/aws/ec2-operations';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';

export default function awsRoutes(fastify: FastifyInstance) {
    fastify.get<{ Reply: VpcResponseType; Params: AwsParamsType; Querystring: AwsVpcQueryStringType }>(
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

    fastify.get<{ Reply: AmiResponseType; Params: AwsParamsType }>(
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

    fastify.get<{
            Params: AwsParamsType;
            Reply: FSxRegionsResponseType;
        }>(
            `${API_PREFIX_PATH}/fsxregions`,
            { schema: GetFSxRegionsSchema },
            async (request, reply) => {
                const {
                    params: { credentialsId, region }
                } = request;

                const response = await getFSxAvailableRegionsList(
                    credentialsId,
                    region
                );

                return reply.send(response);
            }
        );        
}
