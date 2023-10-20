import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    createCloudFormationTemplateForUserDeployment,
    deployCloudFormationTemplate,
    deploymentStatus,
    deploymentStatusByName,
    getCloudformationTemplate
} from '../operations/deployment-operations';
import {
    CloudFormationTemplateSchema,
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
                        enableCloudWatch,
                        tags
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
                    enableCloudWatch,
                    tags
                );
                return reply.send(response);
            }
        )
        .post(
            `${API_PREFIX_PATH}/cloudformation/template`,
            { schema: CloudFormationTemplateSchema },
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
                        enableCloudWatch,
                        tags
                    }
                } = request;
                const response = await getCloudformationTemplate(
                    credentialsId,
                    region,
                    networkConfiguration,
                    ec2Configuration,
                    adConfiguration,
                    fsxConfiguration,
                    sqlConfiguration,
                    topicArn,
                    enableCloudWatch,
                    tags
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
                    enableCloudWatch,
                    tags
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
                enableCloudWatch,
                tags
            );
            return reply.code(202).send(response);
        })
        .get(
            `${API_PREFIX_PATH}/cloudformation/stacks/status`,
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
            `${API_PREFIX_PATH}/cloudformation/stacks/:stackName/status`,
            { schema: DeploymentStatusSchema },
            async (request, reply) => {
                const {
                    params: { accountId, stackName }
                } = request;
                const response = await deploymentStatusByName(accountId, stackName);
                return reply.send(response);
            }
        );
}
