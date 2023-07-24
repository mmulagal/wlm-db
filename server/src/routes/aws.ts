import { FastifyInstance } from 'fastify/types/instance';
import { GetFSxRegionsSchema, GetVpcsListSchema } from './schemas/aws-schemas';
import { FSxSupportedRegions } from '../../src/utils/consts';
import {
    VpcResponseType,
    AwsParamsType,
    AwsQueryStringType,
    FSxRegionsResponseType
} from './types/aws.types';
import {
    getVpcsList,
    getFSxAvailableRegionsList
} from '../operations/aws/ec2-operations';

export default function awsRoutes(fastify: FastifyInstance) {
    fastify
        .get<{
            Reply: VpcResponseType;
            Params: AwsParamsType;
            Querystring: AwsQueryStringType;
        }>(
            '/accounts/:accountId/credentials/:credentialsId/regions/:region/vpcs',
            { schema: GetVpcsListSchema },
            async (request, reply) => {
                const {
                    params: { credentialsId, region },
                    query: { fields }
                } = request;
                const response = await getVpcsList(
                    credentialsId,
                    region,
                    fields
                );
                return reply.send(response);
            }
        )
        .get<{
            Params: AwsParamsType;
            Reply: FSxRegionsResponseType;
        }>(
            '/accounts/:accountId/credentials/:credentialsId/regions/:region/fsxregions',
            { schema: GetFSxRegionsSchema },
            async (request, reply) => {
                const {
                    params: { credentialsId, region }
                } = request;

                const input = { 
                    AllRegions: false,      // Describe only the regions enabled for the account
                    DryRun: false,
                    Filter: {
                        RegionNames: Array.from(FSxSupportedRegions.keys())     // Limit describe to known FSx regions only
                    }
                 };
                
                const response = await getFSxAvailableRegionsList(
                    credentialsId,
                    region,
                    input
                );

                return reply.send(response);
            }
        );
}
