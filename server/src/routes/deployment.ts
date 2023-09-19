import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    createCloudFormationTemplateForUserDeployment,
    deployCloudFormationTemplate,
    deploymentStatus,
    deploymentStatusById
} from '../operations/deployment-operations';
import {
    CreateCloudFormationTemplateSchema,
    DeploymentStatusListSchema,
    DeploymentStatusSchema,
    DeployTemplateSchema
} from './schemas/deployment-schemas';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';

export default function deploymentRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .post(
            `${API_PREFIX_PATH}/cloudformation/url`,
            { schema: CreateCloudFormationTemplateSchema },
            async (request, reply) => {
                const {
                    params: { credentialsId, region },
                    body: {
                        networkConfiguration,
                        ec2Configuration,
                        adConfiguration,
                        fsxConfiguration,
                        sqlConfiguration,
                        topicArn,
                        enableCloudWatch
                    }
                } = request;
                const response = await createCloudFormationTemplateForUserDeployment(
                    credentialsId,
                    region,
                    networkConfiguration,
                    ec2Configuration,
                    adConfiguration,
                    fsxConfiguration,
                    sqlConfiguration,
                    topicArn,
                    enableCloudWatch
                );
                return reply.send(response);
            }
        )
        .post(`${API_PREFIX_PATH}/cloudformation/stack`, { schema: DeployTemplateSchema }, async (request, reply) => {
            const {
                params: { credentialsId, region },
                body: {
                    networkConfiguration,
                    ec2Configuration,
                    adConfiguration,
                    fsxConfiguration,
                    sqlConfiguration,
                    topicArn,
                    enableCloudWatch
                }
            } = request;
            const response = await deployCloudFormationTemplate(
                credentialsId,
                region,
                networkConfiguration,
                ec2Configuration,
                adConfiguration,
                fsxConfiguration,
                sqlConfiguration,
                topicArn,
                enableCloudWatch
            );
            return reply.code(202).send(response);
        })
        .get(
            `${API_PREFIX_PATH}/cloudformation/status`,
            { schema: DeploymentStatusListSchema },
            async (request, reply) => {
                const {
                    params: { accountId }
                } = request;
                const response = await deploymentStatus(accountId);
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/cloudformation/stacks/:stackId/status`,
            { schema: DeploymentStatusSchema },
            async (request, reply) => {
                const {
                    params: { accountId, deploymentId }
                } = request;
                const response = await deploymentStatusById(accountId, deploymentId);
                return reply.send(response);
            }
        );
}
