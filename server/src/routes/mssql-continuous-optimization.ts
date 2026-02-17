import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { FastifyInstance } from 'fastify/types/instance';
import {
    AssessmentTriggeredBy,
    OPTIMIZATION_CATEGORIES,
    OPTIMIZE_RESILIENCY_CONFIGS,
    OptimizeHighAvailabilityParams,
    OptimizeStorageParams
} from '../utils/continous-optimization-consts';
import {
    DriftAssessmentDataCollection,
    TriggerDriftAssessmentSchema,
    OptimizeStorageSchema,
    OptimizeSizingSchema,
    OptimizeOperatingSystemSchema,
    OptimizeComputeSchema,
    DriftAssessmentPerHost,
    OptimizeStorageTierSchema,
    DriftAssessmentPerAccount,
    BulkOptimizeStorageSizingSchema,
    BulkOptimizeOperatingSystemSchema,
    BulkOptimizeStorageTierSchema,
    BulkOptimizeComputeSchema,
    AvailableSnapshotPolicies,
    BulkOptimizeMaxDopSchema,
    OptimizeResilienceSchema,
    BulkOptimizeAwsBackupSchema,
    BulkOptimizeCloneSchema,
    BulkDismissConfigurationSchema,
    BulkOptimizeSharedStorageSchema,
    BulkOptimizeSQLServerServiceSchema,
    BulkOptimizeClusterQuorumSchema,
    BulkOptimizeHeartbeatSchema,
    BulkOptimizeMTUAlignmentSchema
} from './schemas/mssql-continuous-optimization-schema';
import {
    optimizeStorage,
    optimizeSizing,
    optimizeOperatingSystemSettings,
    optimizeStorageTier
} from '../operations/cont-opt-optimize-operations';
import optimizeCompute from '../operations/continuous-optimization/compute-optimize-operations';
import castRequest from './utils';
import {
    bulkCloneOptimization,
    bulkComputeOptimization,
    bulkOptimization,
    bulkHASharedStorageOptimization
} from '../operations/bulk-cont-opt-operations';
import {
    getAvailableSnapshotPolicyList,
    handleResiliecyOptimize
} from '../operations/continuous-optimization/mssql/resilience-optimize-operations';
import {
    OptimizeResiliencyBodyType,
    BulkOptimizeCloneInHostRequestBodyType
} from './types/mssql-continuous-optimisation.types';
import { updateDismissConfigurations } from '../operations/continuous-optimization/assessment-dismiss-operations';
import { DatabaseTypes } from '../utils/consts';
import {
    fetchMssqlDriftAssessment,
    fetchMssqlDriftAssessmentPerAccount,
    fetchMssqlDriftAssessmentPerHost,
    onDemandTriggerMssqlDriftAssessment
} from '../operations/continuous-optimization/mssql/assessment-operations';
import {
    SSM_RUN_POWERSHELL_SCRIPT_DOC,
    SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION
} from '../operations/workloads/mssql/const';
import { SSMDocument } from '../utils/common-types';
import {
    fetchMssqlOfflineAssessmentPerAccount,
    fetchMssqlOfflineAssessment,
    deleteOfflineAssessmentRecord
} from '../operations/continuous-optimization/mssql/offline-assessment-operations';
import { uploadOfflineAssessment, downloadOfflineAssessmentScript } from '../operations/offline-assessment-operations';
import {
    OfflineAssessmentListSchema,
    OfflineAssessmentUploadSchema,
    OfflineAssessmentGetByIdSchema,
    OfflineAssessmentDownloadSchema,
    DeleteOfflineAssessment
} from './schemas/offline-assessment-schema';

const MSSQL_API_PREFIX_PATH = '/v1/mssql/credentials/:credentialsId/regions/:region';
const MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH = '/v1/mssql';

export default function mssqlContinuousOptimizationRoutes(fastify: FastifyInstance) {
    const server = fastify.withTypeProvider<TypeBoxTypeProvider>();

    server
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
            { schema: DriftAssessmentDataCollection },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { fields }
                } = castRequest(request);
                const response = await fetchMssqlDriftAssessment(
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
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/assessment`,
            { schema: TriggerDriftAssessmentSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    query: { fields }
                } = castRequest(request);
                const response = await onDemandTriggerMssqlDriftAssessment(
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
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-configuration`,
            { schema: OptimizeStorageSchema },
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
                    documentName: SSM_RUN_POWERSHELL_SCRIPT_DOC,
                    documentVersion: SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION
                } as OptimizeStorageParams & SSMDocument);
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-sizing`,
            { schema: OptimizeSizingSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    body: { configurationName, objectsToOptimize }
                } = castRequest(request);

                const response = await optimizeSizing(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    [configurationName],
                    undefined,
                    objectsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-operating-system`,
            { schema: OptimizeOperatingSystemSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    body: { configurationName }
                } = castRequest(request);

                const response = await optimizeOperatingSystemSettings(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    configurationName
                );

                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/compute`,
            { schema: OptimizeComputeSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    body: { instanceType }
                } = castRequest(request);

                const response = await optimizeCompute(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    instanceType
                );
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/assessment`,
            { schema: DriftAssessmentPerHost },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId },
                    query: { fields }
                } = castRequest(request);

                const response = await fetchMssqlDriftAssessmentPerHost(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    fields
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/storage-tier`,
            { schema: OptimizeStorageTierSchema },
            async (request, reply) => {
                const {
                    params: { accountId, credentialsId, region, databaseHostId, databaseInstanceId },
                    body: { objectsToOptimize }
                } = castRequest(request);

                const response = await optimizeStorageTier(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    objectsToOptimize
                );
                return reply.send(response);
            }
        )
        .get(`${MSSQL_API_PREFIX_PATH}/assessment`, { schema: DriftAssessmentPerAccount }, async (request, reply) => {
            const {
                params: { accountId, credentialsId, region },
                query: { fields, nextToken, pageSize }
            } = castRequest(request);

            const response = await fetchMssqlDriftAssessmentPerAccount(
                accountId,
                credentialsId,
                region,
                fields,
                nextToken,
                pageSize
            );
            return reply.send(response);
        })
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/storage-sizing`,
            { schema: BulkOptimizeStorageSizingSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    OPTIMIZATION_CATEGORIES.STORAGE_SIZING,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/storage-operating-system`,
            { schema: BulkOptimizeOperatingSystemSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    OPTIMIZATION_CATEGORIES.OPERATING_SYSTEM,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/storage-tier`,
            { schema: BulkOptimizeStorageTierSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    OPTIMIZATION_CATEGORIES.STORAGE_TIER,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/compute`,
            { schema: BulkOptimizeComputeSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkComputeOptimization(accountId, hostsToOptimize);
                return reply.send(response);
            }
        )
        .get(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/snapshot-policies`,
            { schema: AvailableSnapshotPolicies },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId }
                } = castRequest(request);
                const response = await getAvailableSnapshotPolicyList(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_API_PREFIX_PATH}/database-hosts/:databaseHostId/database-instances/:databaseInstanceId/optimize/resiliency`,
            { schema: OptimizeResilienceSchema },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostId, credentialsId, region, databaseInstanceId },
                    body
                } = castRequest(request);
                const response = await handleResiliecyOptimize(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    body as OptimizeResiliencyBodyType
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/max-dop`,
            { schema: BulkOptimizeMaxDopSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(accountId, OPTIMIZATION_CATEGORIES.MAXDOP, hostsToOptimize);
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/resiliency/aws-backup`,
            { schema: BulkOptimizeAwsBackupSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    OPTIMIZE_RESILIENCY_CONFIGS.AWS_BACKUP,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/assessment/dismiss`,
            { schema: BulkDismissConfigurationSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { configurationsToDismiss }
                } = castRequest(request);
                const response = await updateDismissConfigurations(
                    accountId,
                    configurationsToDismiss,
                    DatabaseTypes.MS_SQL_SERVER
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/clone`,
            { schema: BulkOptimizeCloneSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);
                const response = await bulkCloneOptimization(
                    accountId,
                    hostsToOptimize as BulkOptimizeCloneInHostRequestBodyType[]
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/shared-storage`,
            { schema: BulkOptimizeSharedStorageSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkHASharedStorageOptimization(
                    accountId,
                    OptimizeHighAvailabilityParams.SHARED_STORAGE,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/heartbeat`,
            { schema: BulkOptimizeHeartbeatSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    OptimizeHighAvailabilityParams.HEARTBEAT_SETTINGS,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/cluster-quorum`,
            { schema: BulkOptimizeClusterQuorumSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    OptimizeHighAvailabilityParams.CLUSTER_QUORUM,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/sqlserver-service`,
            { schema: BulkOptimizeSQLServerServiceSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    OptimizeHighAvailabilityParams.SQLSERVER_SERVICE,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .post(
            `${MSSQL_BULK_OPTIMIZATION_API_PREFIX_PATH}/database-hosts/optimize/mtu-alignment`,
            { schema: BulkOptimizeMTUAlignmentSchema },
            async (request, reply) => {
                const {
                    params: { accountId },
                    body: { hostsToOptimize }
                } = castRequest(request);

                const response = await bulkOptimization(
                    accountId,
                    OPTIMIZATION_CATEGORIES.MTU_ALIGNMENT,
                    hostsToOptimize
                );
                return reply.send(response);
            }
        )
        .get(
            '/v1/mssql/offline-assessment',
            { schema: OfflineAssessmentListSchema(DatabaseTypes.MS_SQL_SERVER) },
            async (request, reply) => {
                const {
                    params: { accountId },
                    query: { pageSize, nextToken, credentialsId, region }
                } = castRequest(request);

                const response = await fetchMssqlOfflineAssessmentPerAccount(
                    accountId,
                    pageSize,
                    nextToken,
                    credentialsId,
                    region
                );
                return reply.send(response);
            }
        )
        // Upload offline assessment data from JSON file (supports multiple database instances)
        .post(
            '/v1/mssql/offline-assessment/upload',
            { schema: OfflineAssessmentUploadSchema(DatabaseTypes.MS_SQL_SERVER) },
            async (request, reply) => {
                const {
                    params: { accountId },
                    query: { credentialsId, region },
                    body: { fileName, fileContent }
                } = castRequest(request);

                // Validate file extension
                if (!fileName.toLowerCase().endsWith('.json')) {
                    return reply.status(400).send({ message: 'Only JSON files are accepted' });
                }

                const response = await uploadOfflineAssessment(
                    accountId,
                    fileContent,
                    fileName,
                    'mssql',
                    credentialsId,
                    region
                );
                return reply.send(response);
            }
        )
        // Get specific offline assessment by resource ID and database instance ID
        .get(
            '/v1/mssql/database-hosts/:resourceId/database-instances/:databaseInstanceId/offline-assessment',
            { schema: OfflineAssessmentGetByIdSchema(DatabaseTypes.MS_SQL_SERVER) },
            async (request, reply) => {
                const {
                    params: { accountId, resourceId, databaseInstanceId },
                    query: { fields, credentialsId, region }
                } = castRequest(request);

                const response = await fetchMssqlOfflineAssessment(
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
        // Download offline assessment script as zip
        .get(
            '/v1/mssql/offline-assessment/collector',
            { schema: OfflineAssessmentDownloadSchema(DatabaseTypes.MS_SQL_SERVER) },
            async (request, reply) => {
                const {
                    params: { accountId }
                } = castRequest(request);

                const { zipBuffer, filename } = await downloadOfflineAssessmentScript(accountId, 'mssql');

                return reply
                    .header('Content-Type', 'application/zip')
                    .header('Content-Disposition', `attachment; filename="${filename}"`)
                    .send(zipBuffer);
            }
        )
        .delete(
            '/v1/mssql/offline-assessment/database-hosts/:databaseHostIds',
            { schema: DeleteOfflineAssessment },
            async (request, reply) => {
                const {
                    params: { accountId, databaseHostIds }
                } = castRequest(request);

                const response = await deleteOfflineAssessmentRecord(accountId, databaseHostIds);
                return reply.send(response);
            }
        );
}
