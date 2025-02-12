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
    getPGSQLTerraformSetup,
    getPgSqlCfTemplate,
    getTerraformSetup
} from '../operations/deployment-operations';
import {
    CloudFormationTemplateSchema,
    DeploymentStatusListSchema,
    DeploymentStatusSchema,
    DeployTemplateSchema,
    FsxAvailableRegionsForThroughputSchema,
    CollationListSchema,
    PgSqlDeployTemplateSchema,
    TerraformSetupSchema,
    PgSqlCloudFormationTemplateSchema,
    PgSqlTerraformSetupSchema
} from './schemas/deployment-schemas';
import castRequest from './utils';

const API_PREFIX_PATH = '/v1/credentials/:credentialsId/regions/:region';
const API_MSSQL_PREFIX_PATH = '/v1/mssql/credentials/:credentialsId/regions/:region';
const API_MSSQL_STATIC_TEMPLATE_PREFIX_PATH = '/v1/mssql/cloudformation/template';
const API_MSSQL_TERRAFORM_PREFIX_PATH = '/v1/mssql/terraform/setup';
const API_PGSQL_PREFIX_PATH = '/v1/pgsql/credentials/:credentialsId/regions/:region';
const API_PGSQL_TERRAFORM_PREFIX_PATH = '/v1/pgsql/terraform/setup';

export default function deploymentRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .post(
            `${API_MSSQL_STATIC_TEMPLATE_PREFIX_PATH}`,
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
                } = castRequest(request);
                const response = await getCloudformationTemplate(
                    networkConfiguration,
                    ec2Configuration,
                    adConfiguration,
                    fsxConfiguration,
                    sqlConfiguration,
                    topicArn,
                    enableCloudWatch,
                    triggeredFrom as string,
                    tags,
                    credentialsId,
                    region
                );
                return reply.send(response);
            }
        )
        .post(
            `${API_MSSQL_PREFIX_PATH}/cloudformation/deploy`,
            { schema: DeployTemplateSchema },
            async (request, reply) => {
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
                } = castRequest(request);
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
                    triggeredFrom as string,
                    tags
                );
                return reply.code(202).send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/cloudformation/stacks/status`,
            { schema: DeploymentStatusListSchema },
            async (request, reply) => {
                const {
                    params: { accountId }
                } = castRequest(request);
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
                } = castRequest(request);
                const response = await deploymentStatusByName(accountId, stackName);
                return reply.send(response);
            }
        )
        .get(
            '/v1/fsx-4gbps-supported-regions',
            { schema: FsxAvailableRegionsForThroughputSchema },
            async (request, reply) => {
                const {
                    params: { accountId }
                } = castRequest(request);
                const response = await getFSXAvailableRegionsForThrougput(accountId);
                return reply.send(response!);
            }
        )
        .get('/v1/mssql/collations', { schema: CollationListSchema }, async (request, reply) => {
            const {
                params: { accountId },
                query: { version: mssqlVersion }
            } = castRequest(request);
            const response = getCollationDetailsForDeployment(accountId, mssqlVersion);
            return reply.send(response);
        })
        .post(
            `${API_PGSQL_PREFIX_PATH}/cloudformation/deploy`,
            { schema: PgSqlDeployTemplateSchema },
            async (request, reply) => {
                const {
                    params: { credentialsId, region },
                    headers: { 'triggered-from': triggeredFrom },
                    body: {
                        networkConfiguration,
                        ec2Configuration,
                        fsxConfiguration,
                        sqlConfiguration,
                        topicArn,
                        enableCloudWatch,
                        tags
                    }
                } = castRequest(request);
                const response = await deployPgSql(
                    credentialsId,
                    region,
                    networkConfiguration,
                    ec2Configuration,
                    fsxConfiguration,
                    sqlConfiguration,
                    topicArn,
                    enableCloudWatch,
                    triggeredFrom as string,
                    tags
                );
                return reply.code(202).send(response);
            }
        )
        .post(
            `${'/v1/pgsql/cloudformation/template'}`,
            { schema: PgSqlCloudFormationTemplateSchema },
            async (request, reply) => {
                const {
                    headers: { 'triggered-from': triggeredFrom },
                    body: {
                        networkConfiguration,
                        ec2Configuration,
                        fsxConfiguration,
                        sqlConfiguration,
                        topicArn,
                        enableCloudWatch,
                        tags,
                        credentialsId,
                        region
                    }
                } = castRequest(request);
                const response = await getPgSqlCfTemplate(
                    networkConfiguration,
                    ec2Configuration,
                    fsxConfiguration,
                    sqlConfiguration,
                    topicArn,
                    enableCloudWatch,
                    triggeredFrom as string,
                    tags,
                    credentialsId,
                    region
                );
                return reply.send(response);
            }
        )
        .post(`${API_MSSQL_TERRAFORM_PREFIX_PATH}`, { schema: TerraformSetupSchema }, async (request, reply) => {
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
            } = castRequest(request);
            const response = await getTerraformSetup(
                networkConfiguration,
                ec2Configuration,
                adConfiguration,
                fsxConfiguration,
                sqlConfiguration,
                topicArn,
                enableCloudWatch,
                triggeredFrom as string,
                tags,
                credentialsId,
                region
            );
            return reply.send(response);
        })
        .post(`${API_PGSQL_TERRAFORM_PREFIX_PATH}`, { schema: PgSqlTerraformSetupSchema }, async (request, reply) => {
            const {
                headers: { 'triggered-from': triggeredFrom },
                body: {
                    networkConfiguration,
                    ec2Configuration,
                    fsxConfiguration,
                    sqlConfiguration,
                    topicArn,
                    enableCloudWatch,
                    tags,
                    credentialsId,
                    region
                }
            } = castRequest(request);
            const response = await getPGSQLTerraformSetup(
                credentialsId,
                region,
                networkConfiguration,
                ec2Configuration,
                fsxConfiguration,
                sqlConfiguration,
                topicArn,
                enableCloudWatch,
                triggeredFrom as string,
                tags
            );
            return reply.code(202).send(response);
        });
}
