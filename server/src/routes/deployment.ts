import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { createCloudFormationTemplateForUserDeployment, deploySqlTemplate } from '../operations/deployment-operations';
import { CreateCloudFormationTemplateSchema, DeployTemplateSchema } from './schemas/deployment-schemas';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';

export default function deploymentRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .post(
            `${API_PREFIX_PATH}/template/create`,
            { schema: CreateCloudFormationTemplateSchema },
            async (request, reply) => {
                const {
                    params: { credentialsId, region },
                    body: {
                        networkConfiguration,
                        ec2Configuration,
                        adConfiguration,
                        fsxConfiguration,
                        sqlConfiguration
                    }
                } = request;
                const response = await createCloudFormationTemplateForUserDeployment(
                    credentialsId,
                    region,
                    networkConfiguration,
                    ec2Configuration,
                    adConfiguration,
                    fsxConfiguration,
                    sqlConfiguration
                );
                return reply.send(response);
            }
        )
        .post(`${API_PREFIX_PATH}/template/deploy`, { schema: DeployTemplateSchema }, async (request, reply) => {
            const {
                params: { credentialsId, region },
                body: {
                    networkConfiguration,
                    ec2Configuration,
                    adConfiguration,
                    fsxConfiguration,
                    sqlConfiguration,
                    topicArn
                }
            } = request;
            const response = await deploySqlTemplate(
                credentialsId,
                region,
                networkConfiguration,
                ec2Configuration,
                adConfiguration,
                fsxConfiguration,
                sqlConfiguration,
                topicArn
            );
            return reply.send(response);
        });
}
