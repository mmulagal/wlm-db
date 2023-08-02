import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { CreateCloudFormationTemplateSchema } from './schemas/deployment-schemas';
import { createCloudFormationTemplateForUserDeployment } from '../operations/aws/cloud-formation-operations';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region/vpcs/:vpcId';

export default function deploymentRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server.post(
        `${API_PREFIX_PATH}/template/create`,
        { schema: CreateCloudFormationTemplateSchema },
        async (request, reply) => {
            const {
                params: { credentialsId, region, vpcId },
                body: { networkConfiguration, ec2Configuration, adConfiguration, fsxConfiguration, sqlConfiguration }
            } = request;
            const response = await createCloudFormationTemplateForUserDeployment(
                credentialsId,
                region,
                vpcId,
                networkConfiguration,
                ec2Configuration,
                adConfiguration,
                fsxConfiguration,
                sqlConfiguration
            );
            return reply.send(response);
        }
    );
}
