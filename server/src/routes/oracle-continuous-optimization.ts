import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import { AssessmentTriggeredBy, OptimizeStorageParams } from '../utils/continous-optimization-consts';
import {
    BulkDismissOracleConfigurationSchema,
    TriggerOracleDriftAssessmentSchema
} from './schemas/mssql-continuous-optimization-schema';
import castRequest from './utils';
import {
    fetchOracleDriftAssessment,
    fetchOracleDriftAssessmentPerAccount,
    fetchOracleDriftAssessmentPerHost,
    onDemandTriggerOracleDriftAssessment
} from '../operations/continuous-optimization/oracle/assessment-operations';
import {
    DriftAssessmentDataCollection,
    DriftAssessmentPerAccount,
    DriftAssessmentPerHost,
    OracleOptimizeSchema,
    OracleOptimizeStorageConfigurationSchema,
    OracleOptimizeStorageLayoutSchema
} from './schemas/oracle-continuous-optimization-schema';
import { optimizeStorage } from '../operations/cont-opt-optimize-operations';
import { updateDismissConfigurations } from '../operations/continuous-optimization/assessment-dismiss-operations';
import { DatabaseTypes } from '../utils/consts';
import { optimizeOracleStorageLayout } from '../operations/continuous-optimization/oracle/storage-optimize-operations';
import { optimizeOracleDatabase } from '../operations/continuous-optimization/oracle/optimization-operations';
import { OptimizeRequestBodyType } from './types/oracle-continuous-optimization.types';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../operations/workloads/oracle/consts';
import { SSMDocument } from '../utils/common-types';
import { downloadOfflineAssessmentScript, uploadOfflineAssessment } from '../operations/offline-assessment-operations';
import {
    fetchOracleOfflineAssessment,
    fetchOracleOfflineAssessmentPerAccount,
    deleteOracleOfflineAssessmentRecord
} from '../operations/continuous-optimization/oracle/offline-assessment-operations';
import {
    OfflineAssessmentDownloadSchema,
    OfflineAssessmentUploadSchema,
    OfflineAssessmentListSchema,
    OfflineAssessmentGetByIdSchema,
    DeleteOfflineAssessment
} from './schemas/offline-assessment-schema';
import getLogger from '../utils/logger';

const logger = getLogger();

const API_PREFIX_PATH = '/v1/oracle/credentials/:credentialsId/regions/:region';
const ORACLE_BULK_OPTIMIZATION_API_PREFIX_PATH = '/v1/oracle';

export default function oracleContinuousOptimizationRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .post(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
            { schema: TriggerOracleDriftAssessmentSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { fields }
                } = castRequest(request);
                const response = await onDemandTriggerOracleDriftAssessment(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    AssessmentTriggeredBy.USER,
                    fields
                );
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
            { schema: DriftAssessmentDataCollection },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { fields }
                } = castRequest(request);
                const response = await fetchOracleDriftAssessment(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    fields
                );
                return reply.send(response);
            }
        )
        .post(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-configuration`,
            { schema: OracleOptimizeStorageConfigurationSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    body: { assessments }
                } = castRequest(request);

                const response = await optimizeStorage({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    optimizationTargets: assessments,
                    documentName: SSM_RUN_SHELL_SCRIPT_DOC,
                    documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
                } as OptimizeStorageParams & SSMDocument);
                return reply.send(response);
            }
        )
        .get(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/assessment`,
            { schema: DriftAssessmentPerHost },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId }
                } = castRequest(request);

                const response = await fetchOracleDriftAssessmentPerHost(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId
                );
                return reply.send(response);
            }
        )
        .get(`${API_PREFIX_PATH}/assessment`, { schema: DriftAssessmentPerAccount }, async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                query: { nextToken, pageSize }
            } = castRequest(request);

            const response = await fetchOracleDriftAssessmentPerAccount(
                accountId,
                credentialsId,
                region,
                nextToken,
                pageSize
            );
            return reply.send(response);
        })
        .post(
            `${ORACLE_BULK_OPTIMIZATION_API_PREFIX_PATH}/assessment/dismiss`,
            { schema: BulkDismissOracleConfigurationSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { configurationsToDismiss }
                } = castRequest(request);
                const response = await updateDismissConfigurations(
                    accountId,
                    configurationsToDismiss,
                    DatabaseTypes.ORACLE
                );
                return reply.send(response);
            }
        )
        .post(
            `${API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-layout`,
            { schema: OracleOptimizeStorageLayoutSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    body: { assessments }
                } = castRequest(request);

                const jobId = await optimizeOracleStorageLayout({
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    optimizationTargets: assessments
                } as OptimizeStorageParams);
                return reply.send({ jobId: jobId as string });
            }
        )
        .post(
            `${ORACLE_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize`,
            { schema: OracleOptimizeSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { type, hostsToOptimize }
                } = castRequest(request);

                const jobId = await optimizeOracleDatabase(accountId, {
                    type,
                    hostsToOptimize
                } as OptimizeRequestBodyType);
                return reply.send({ jobId });
            }
        )
        // Upload offline assessment data from JSON file
        .post(
            '/v1/oracle/offline-assessment/upload',
            { schema: OfflineAssessmentUploadSchema(DatabaseTypes.ORACLE) },
            async (request, reply) => {
                const {
                    params: { accountId },
                    query: { credentialsId, region },
                    body: { fileName, fileContent }
                } = castRequest(request);

                if (!fileName.toLowerCase().endsWith('.json')) {
                    return reply.status(400).send({ message: 'Only JSON files are accepted' });
                }

                const response = await uploadOfflineAssessment(
                    accountId,
                    fileContent,
                    fileName,
                    'oracle',
                    credentialsId,
                    region
                );
                return reply.status(201).send(response);
            }
        )
        // Download offline assessment script as zip
        .get(
            '/v1/oracle/offline-assessment/collector',
            { schema: OfflineAssessmentDownloadSchema(DatabaseTypes.ORACLE) },
            async (request, reply) => {
                const {
                    params: { accountId }
                } = castRequest(request);

                const { archive, filename } = await downloadOfflineAssessmentScript(accountId, 'oracle');

                archive.on('error', err => {
                    if (!reply.sent) {
                        logger.error('Error creating assessment script package stream', {
                            accountId,
                            error: err instanceof Error ? err.message : String(err)
                        });
                        reply.code(500).send({
                            error: 'Failed to create assessment script package. Please try again or contact support if the issue persists.'
                        });
                    }
                });

                return reply
                    .header('Content-Type', 'application/zip')
                    .header('Content-Disposition', `attachment; filename="${filename}"`)
                    .send(archive);
            }
        )
        .get(
            '/v1/oracle/offline-assessment',
            { schema: OfflineAssessmentListSchema(DatabaseTypes.ORACLE) },
            async (request, reply) => {
                const {
                    params: { accountId },
                    query: { pageSize, nextToken, credentialsId, region }
                } = castRequest(request);

                const response = await fetchOracleOfflineAssessmentPerAccount(
                    accountId,
                    pageSize,
                    credentialsId,
                    region,
                    nextToken
                );
                return reply.send(response);
            }
        )
        .get(
            '/v1/oracle/database-hosts/:resourceId/database-instances/:databaseInstanceId/offline-assessment',
            { schema: OfflineAssessmentGetByIdSchema(DatabaseTypes.ORACLE) },
            async (request, reply) => {
                const {
                    params: { accountId, resourceId, databaseInstanceId },
                    query: { fields, credentialsId, region }
                } = castRequest(request);

                const response = await fetchOracleOfflineAssessment(
                    accountId,
                    resourceId,
                    databaseInstanceId,
                    credentialsId,
                    region,
                    fields
                );
                return reply.send(response);
            }
        )
        .delete(
            '/v1/oracle/offline-assessment/database-hosts/:databaseHostIds',
            { schema: DeleteOfflineAssessment(DatabaseTypes.ORACLE) },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostIds }
                } = castRequest(request);

                const response = await deleteOracleOfflineAssessmentRecord(accountId, databaseHostIds);
                return reply.send(response);
            }
        );
}
