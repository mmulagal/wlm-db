import { FastifyInstance } from 'fastify/types/instance';
import { AdsResponseType, AdsParamsType } from './types/aws.types';
import { AdsSchema } from './schemas/aws-schemas';
import { getAdsList } from '../operations/aws/directory-service-operations';

const API_PATH: string = '/v1/accounts/:accountId';

export default function awsRoutes(fastify: FastifyInstance) {
    fastify
        .get<{
            Params: AdsParamsType;
            Reply: AdsResponseType; 
        }>(
            `${API_PATH}/credentials/:credentialsId/regions/:region/vpcs/:vpcId/ads`,
            {
                schema: AdsSchema
            },
            async request => {
                const {
                    params: {credentialsId, region, vpcId }
                } = request;
                return getAdsList(credentialsId, region, vpcId);
            }
        )
}
