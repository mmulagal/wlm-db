import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    deployStackOrCreateTemplateURL,
    deploymentStatus,
    deploymentStatusByName,
    getCloudformationTemplate
} from '../operations/deployment-operations';
import {
    CloudFormationTemplateSchema,
    DeploymentStatusListSchema,
    DeploymentStatusSchema,
    DeployTemplateSchema,
    DeploymentSummaryListSchema
} from './schemas/deployment-schemas';
import { getDeploymentJobsSummary } from '../operations/jobs-operations';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';
const API_STATIC_TEMPLATE_PREFIX_PATH = '/v1/cloudformation/template';

export default function deploymentRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .post(
            `${API_STATIC_TEMPLATE_PREFIX_PATH}`,
            { schema: CloudFormationTemplateSchema },
            async (request, reply) => {
                const {
                    body: {
                        networkConfiguration,
                        ec2Configuration,
                        adConfiguration,
                        fsxConfiguration,
                        sqlConfiguration,
                        topicArn,
                        enableCloudWatch,
                        tags,
                        credentialsId,
                        region
                    }
                } = request;
                const response = await getCloudformationTemplate(
                    networkConfiguration,
                    ec2Configuration,
                    adConfiguration,
                    fsxConfiguration,
                    sqlConfiguration,
                    topicArn,
                    enableCloudWatch,
                    tags,
                    credentialsId,
                    region
                );
                return reply.send(response);
            }
        )
        .post(`${API_PREFIX_PATH}/cloudformation/deploy`, { schema: DeployTemplateSchema }, async (request, reply) => {
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
            const response = await deployStackOrCreateTemplateURL(
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
        )
        .get(`/v1/deployments`, { schema: DeploymentSummaryListSchema }, async (request, reply) => {
            const {
                params: { accountId },
                query: { statuses, nextToken }
            } = request;
            const response = await getDeploymentJobsSummary(accountId, statuses, nextToken);
            return reply.send(response!);
        });
}
