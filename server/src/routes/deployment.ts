import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    deployPgSql,
    deployStackOrCreateTemplateURL,
    deploymentStatus,
    deploymentStatusByName,
    getCloudformationTemplate,
    getCollationDetailsForDeployment,
    getFSXAvailableRegionsForThrougput,
    getTerraformSetup
} from '../operations/deployment-operations';
import {
    CloudFormationTemplateSchema,
    DeploymentStatusListSchema,
    DeploymentStatusSchema,
    DeployTemplateSchema,
    DeploymentSummaryListSchema,
    FsxAvailableRegionsForThroughputSchema,
    CollationListSchema,
    PgSqlDeployTemplateSchema,
    TerraformSetupSchema
} from './schemas/deployment-schemas';
import { getDeploymentJobsSummary } from '../operations/jobs-operations';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';
const API_STATIC_TEMPLATE_PREFIX_PATH = '/v1/cloudformation/template';
const API_TERRAFORM_PREFIX_PATH = '/v1/terraform/setup';

export default function deploymentRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .post(
            `${API_STATIC_TEMPLATE_PREFIX_PATH}`,
            { schema: CloudFormationTemplateSchema },
            async (request, reply) => {
                const {
                    headers: { 'triggered-from': triggeredFrom },
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
                    triggeredFrom,
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
                headers: { 'triggered-from': triggeredFrom },
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
                triggeredFrom,
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
        .get('/v1/deployments', { schema: DeploymentSummaryListSchema }, async (request, reply) => {
            const {
                params: { accountId },
                query: { statuses, nextToken }
            } = request;
            const response = await getDeploymentJobsSummary(accountId, statuses, nextToken);
            return reply.send(response!);
        })
        .get(
            '/v1/fsx-4gbps-supported-regions',
            { schema: FsxAvailableRegionsForThroughputSchema },
            async (request, reply) => {
                const {
                    params: { accountId }
                } = request;
                const response = await getFSXAvailableRegionsForThrougput(accountId);
                return reply.send(response!);
            }
        )
        .get('/v1/collations', { schema: CollationListSchema }, async (request, reply) => {
            const {
                params: { accountId },
                query: { version: mssqlVersion }
            } = request;
            const response = getCollationDetailsForDeployment(accountId, mssqlVersion);
            return reply.send(response);
        })
        .post(
            `${API_PREFIX_PATH}/cloudformation/pgsql/deploy`,
            { schema: PgSqlDeployTemplateSchema },
            async (request, reply) => {
                const {
                    params: { credentialsId, region },
                    headers: { 'triggered-from': triggeredFrom },
                    body: { networkConfiguration, ec2Configuration, fsxConfiguration, sqlConfiguration, topicArn }
                } = request;
                const response = await deployPgSql(
                    credentialsId,
                    region,
                    networkConfiguration,
                    ec2Configuration,
                    fsxConfiguration,
                    sqlConfiguration,
                    triggeredFrom,
                    topicArn
                );
                return reply.code(202).send(response);
            }
        )
        .post(`${API_TERRAFORM_PREFIX_PATH}`, { schema: TerraformSetupSchema }, async (request, reply) => {
            const {
                headers: { 'triggered-from': triggeredFrom },
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
            const response = await getTerraformSetup(
                networkConfiguration,
                ec2Configuration,
                adConfiguration,
                fsxConfiguration,
                sqlConfiguration,
                topicArn,
                enableCloudWatch,
                triggeredFrom,
                tags,
                credentialsId,
                region
            );
            return reply.send(response);
        });
}
