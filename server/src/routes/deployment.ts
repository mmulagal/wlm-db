import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { FastifyRequest } from 'fastify/types/request';
import { FastifyReply } from 'fastify/types/reply';
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

// FSX Throughput Constants
const FSX_GEN1_THROUGHPUT = [128, 256, 512, 1024, 2048, 4096];
const FSX_GEN2_MULTI_AZ_THROUGHPUT = [384, 768, 1536, 3072, 4608, 6144];

// SAZ Gen2 validation using mathematical pattern instead of 26 hardcoded values
const validateSAZGen2Throughput = (value: number): boolean => {
    const baseUnit = 384;
    const min = 384;
    const max = 73728;
    if (value < min || value > max || value % baseUnit !== 0) {
        return false;
    }
    const multiplier = value / baseUnit;
    return (
        [1, 2, 4, 8].includes(multiplier) || // Powers of 2
        (multiplier >= 12 && multiplier <= 48 && multiplier % 4 === 0) || // 12-48 in steps of 4
        (multiplier >= 56 && multiplier <= 96 && multiplier % 8 === 0) || // 56-96 in steps of 8
        (multiplier >= 112 && multiplier <= 192 && multiplier % 16 === 0) // 112-192 in steps of 16
    );
};

const fsxValidationHook = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const config = body?.fsxConfiguration;

    if (config) {
        const isGen1 = ['SINGLE_AZ_1', 'MULTI_AZ_1'].includes(config.fsxDeploymentMode);
        const isMAZGen2 = ['MULTI_AZ_2'].includes(config.fsxDeploymentMode);
        const isSAZGen2 = ['SINGLE_AZ_2'].includes(config.fsxDeploymentMode);

        if (isGen1) {
            if (!FSX_GEN1_THROUGHPUT.includes(config.fsxVolThroughput)) {
                return reply.code(400).send({
                    error: 'Invalid FSX Configuration',
                    message: `Invalid throughput ${config.fsxVolThroughput} for ${config.fsxDeploymentMode}. Valid values: ${FSX_GEN1_THROUGHPUT.join(', ')}`
                });
            }
            if (!config.fsxIOPS) {
                return reply.code(400).send({
                    error: 'Invalid FSX Configuration',
                    message: `fsxIOPS is required for ${config.fsxDeploymentMode}`
                });
            }
        } else if (isMAZGen2) {
            if (!FSX_GEN2_MULTI_AZ_THROUGHPUT.includes(config.fsxVolThroughput)) {
                return reply.code(400).send({
                    error: 'Invalid FSX Configuration',
                    message: `Invalid throughput ${config.fsxVolThroughput} for ${config.fsxDeploymentMode}. Valid values: ${FSX_GEN2_MULTI_AZ_THROUGHPUT.join(', ')}`
                });
            }
        } else if (isSAZGen2) {
            if (!validateSAZGen2Throughput(config.fsxVolThroughput)) {
                return reply.code(400).send({
                    error: 'Invalid FSX Configuration',
                    message: `Invalid throughput ${config.fsxVolThroughput} for ${config.fsxDeploymentMode}. Must be a valid multiple of 384 (range: 384-73728)`
                });
            }
        }
    }
};

export default function deploymentRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .post(
            `${API_MSSQL_STATIC_TEMPLATE_PREFIX_PATH}`,
            { schema: CloudFormationTemplateSchema, preHandler: fsxValidationHook },
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
            { schema: DeployTemplateSchema, preHandler: fsxValidationHook },
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
            return reply.code(202).send(response);
        });
}
