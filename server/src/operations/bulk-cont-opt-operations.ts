import { isEmpty } from 'bullmq';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import throat from 'throat';
import getLogger from '../utils/logger';
import { AuditStatus, HttpErrorCodes, SSM_COMMAND_CACHE_TYPE } from '../utils/consts';
import {
    BulkOptimizeCloneInHostRequestBodyType,
    BulkOptimizeComputePerHostRequestBodyType,
    BulkOptimizeGeneralPerHostRequestBodyType,
    BulkOptimizeHASharedStorageBodyType,
    CloneDetailType,
    OptimizeClonesPerHostRequestBodyType,
    OptimizePerHostRequestBodyType
} from '../routes/types/continuous-optimization.types';
import { handleOptimizeJobCreation, JobMetadata } from './continuous-optimization/assessment-utils';
import {
    handleUpdateAwsBackup,
    optimizeClone,
    optimizeMaxDop,
    optimizeOperatingSystemSettings,
    optimizeSizing,
    optimizeStorageTier,
    triggerAssessmentAfterOptimization
} from './cont-opt-optimize-operations';
import { updateJobDetails, updateParentJobStatus } from './database/job-operations';
import {
    AssessmentCategories,
    OPTIMIZATION_CATEGORIES,
    OPTIMIZE_RESILIENCY_CONFIGS,
    OPTIMIZE_SIZING_CONFIGS,
    OptimizeComputeJobNames,
    OptimizeComputeParams,
    OptimizeHighAvailabilityParams
} from '../utils/continous-optimization-consts';
import optimizeCompute from './continuous-optimization/compute-optimize-operations';
import { listResources } from '../lib/database/db';
import { handleOptimizeRssOptimization } from './continuous-optimization/mssql/rssConfig-optimize-operations';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import { resetCache } from '../utils/cache';
import { getServerNameWithHostname, isDemo } from '../utils/utils';
import { listInstanceConfigIncludingResourceAndInstance } from './database/instance-config-operations';
import {
    CloneAssessment,
    CloneDetail,
    DatabaseInstance,
    DatabaseInstanceMetadata,
    MappedVolumeResponseForClone
} from '../utils/common-types';
import { getMappedVolumeDetailForInstance } from './continuous-optimization/mssql/clone-optimization-operations';
import { getInstanceInfo } from './database/database-operations';
import { updateOptimizedConfigMetaData } from './demo-operations';
import { handleSharedStorageOptimize } from './continuous-optimization/mssql/resilience-optimize-operations';

const logger = getLogger();
const isDemoFlow = isDemo();

async function formatJobMetadata<T extends { configurationName: string; databaseHosts: any[] }>(hostsToOptimize: T[]) {
    return hostsToOptimize.flatMap(({ configurationName, databaseHosts }) =>
        databaseHosts.map(
            ({ id, sqlServerInstances, fsxFileSystemId, backupRetentionDays, backupStartTime, clones }) => ({
                resourceId: id,
                sqlServerInstances,
                optimizationType: configurationName,
                fsxFileSystemId: fsxFileSystemId || null,
                backupRetentionDays: backupRetentionDays || null,
                backupStartTime: backupStartTime || null,
                clones: clones || null
            })
        )
    );
}

async function bulkOptimization(
    accountId: string,
    optimizationCategory: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[]
) {
    logger.info(
        `Bulk optimization: ${accountId},  ${optimizationCategory}, hostsToOptimize: ${hostsToOptimize?.length}`
    );

    if (isEmpty(hostsToOptimize)) {
        const errorMessage = 'databaseHosts cannot be empty.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }

    // Validate the account id, credentials id, region is valid details in the DB and filter databaseHosts for each host
    await Promise.all(
        hostsToOptimize.map(async host => {
            host.databaseHosts = await validateAndFilterDatabaseHosts<OptimizePerHostRequestBodyType>(
                accountId,
                host.databaseHosts
            );
        })
    );

    const jobMetadata: JobMetadata = {
        hostsToOptimize: await formatJobMetadata(hostsToOptimize)
    };

    const jobDescription =
        optimizationCategory === OPTIMIZATION_CATEGORIES.OPERATING_SYSTEM
            ? 'Fix operating system configuration'
            : optimizationCategory === OPTIMIZATION_CATEGORIES.STORAGE_TIER
            ? 'Fix storage tier'
            : optimizationCategory === OPTIMIZATION_CATEGORIES.MAXDOP
            ? 'Fix maxdop configuration'
            : optimizationCategory === OPTIMIZE_RESILIENCY_CONFIGS.AWS_BACKUP
            ? 'Fix AWS FSx for ONTAP automatic backup configuration'
            : 'Fix storage sizing';

    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        '',
        '',
        accountId,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        undefined,
        jobMetadata
    );

    handleBulkOptimization(accountId, optimizationCategory, hostsToOptimize, parentJobId);
    return { jobId: parentJobId };
}

async function bulkCloneOptimization(accountId: string, hostsToOptimize: BulkOptimizeCloneInHostRequestBodyType[]) {
    logger.info(`Bulk clone optimization: ${accountId}, hostsToOptimize: ${hostsToOptimize?.length}`);

    if (isEmpty(hostsToOptimize)) {
        const errorMessage = 'databaseHosts cannot be empty.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }

    // Validate the account id, credentials id, region is valid details in the DB and filter databaseHosts for each host
    await Promise.all(
        hostsToOptimize.map(async host => {
            host.databaseHosts = await validateAndFilterDatabaseHosts<OptimizeClonesPerHostRequestBodyType>(
                accountId,
                host.databaseHosts
            );
        })
    );

    const jobMetadata: JobMetadata = {
        hostsToOptimize: await formatJobMetadata(hostsToOptimize)
    };

    const jobDescription = 'Fix clones';

    // First Job Created
    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        '',
        '',
        accountId,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        undefined,
        jobMetadata
    );

    handleBulkCloneOptimization(accountId, hostsToOptimize, parentJobId);
    return { jobId: parentJobId };
}

async function handleBulkCloneOptimization(
    accountId: string,
    hostsToOptimize: BulkOptimizeCloneInHostRequestBodyType[],
    parentJobId: string
) {
    logger.info(
        `Handle bulk optimizing clone: ${accountId}, hostsToOptimize: ${hostsToOptimize?.length}, parentJobId: ${parentJobId}`
    );

    const flattenedInstances = extractInstancesToOptimize(hostsToOptimize);
    // Process all instances and their clones with a concurrency limit of 3
    await Promise.all(
        flattenedInstances.map(
            throat(3, async instance => {
                const { instanceId, clones, region, credentialsId, databaseHostId } = instance;
                if (isEmpty(clones)) {
                    logger.warn(`No clones found for instance ${instanceId} in databaseHost ${databaseHostId}.`);
                    return;
                }

                try {
                    // Fetch configuration data once for the databaseHostId and databaseInstanceId
                    const { configData, instanceName, sqlServerName, serverNameWithHostName, volumeMapping } =
                        await fetchInstanceConfigurationAndVolumeMapping(
                            accountId,
                            credentialsId,
                            region,
                            databaseHostId,
                            instanceId,
                            clones
                        );

                    await Promise.all(
                        clones?.map(
                            throat(3, async clone => {
                                try {
                                    await optimizeClone(
                                        accountId,
                                        credentialsId,
                                        region,
                                        databaseHostId,
                                        instanceId,
                                        clone,
                                        configData as unknown as CloneAssessment,
                                        sqlServerName,
                                        instanceName,
                                        parentJobId,
                                        volumeMapping
                                    );
                                    logger.info(
                                        `Successfully optimized clone ${clone.cloneDatabaseName} for instance ${instanceId} in databaseHost ${databaseHostId}.`
                                    );
                                } catch (error: any) {
                                    logger.error(
                                        `Error occurred while optimizing clone ${clone.cloneDatabaseName} for host ${databaseHostId}, instance ${instanceId}. Error: ${error}`
                                    );
                                }
                            })
                        )
                    );
                    if (isDemoFlow) {
                        await updateAllOptimizedClonesDemoFlow(
                            accountId,
                            credentialsId,
                            databaseHostId,
                            instanceId,
                            configData,
                            clones
                        );
                    }
                    // once the optimize done for the specific instance id in a host, Run the assessment for that
                    resetCache(SSM_COMMAND_CACHE_TYPE);
                    await triggerAssessmentAfterOptimization(
                        credentialsId,
                        region,
                        accountId,
                        databaseHostId,
                        serverNameWithHostName,
                        parentJobId,
                        { id: instanceId },
                        AssessmentCategories.CLONE
                    );
                } catch (err: any) {
                    logger.error(
                        `Error occurred while optimizing clone configuration for account ${accountId}. Error: ${err}`
                    );
                }
            })
        )
    );
    const status = await updateParentJobStatus(accountId, parentJobId);
    if (status === JOBSTATUS.COMPLETED) {
        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } else if (status === JOBSTATUS.FAILED) {
        updateLongRunningAuditGroup(AuditStatus.FAILED, `Error occurred while fixing clone for account ${accountId}`);
    }
}

async function updateAllOptimizedClonesDemoFlow(
    accountId: string,
    credentialsId: string,
    databaseHostId: string,
    databaseInstanceId: string,
    configData: CloneAssessment,
    clones: CloneDetailType[]
) {
    logger.info('Updating all optimized clones for demo flow', {
        accountId,
        credentialsId,
        databaseHostId,
        databaseInstanceId
    });

    // Filter only the clones that were optimized
    const { oldCloneDetails } = configData as unknown as CloneAssessment;
    const matchingClones: CloneDetail[] = Array.isArray(oldCloneDetails)
        ? oldCloneDetails.filter(({ cloneDatabaseName, clonedBy }) =>
              clones.some(c => c.cloneDatabaseName === cloneDatabaseName && c.clonedBy?.toLowerCase() === clonedBy)
          )
        : [];

    // Fetch instance metadata once
    const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
    const { metadata: instanceMetadata } = instanceDetail as unknown as DatabaseInstance;

    // Update all matching clones in one DB call
    await updateOptimizedConfigMetaData(
        accountId,
        databaseInstanceId,
        matchingClones,
        'CLONE',
        instanceMetadata as DatabaseInstanceMetadata
    );
}

async function handleOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    optimizationCategory: string,
    optimizationSubcategory: string,
    databaseHostId: string,
    databaseInstanceId: string,
    parentJobId: string
) {
    try {
        switch (optimizationCategory) {
            case OPTIMIZATION_CATEGORIES.OPERATING_SYSTEM:
                await optimizeOperatingSystemSettings(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    optimizationSubcategory,
                    parentJobId
                );
                break;
            case OPTIMIZATION_CATEGORIES.STORAGE_TIER:
                await optimizeStorageTier(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    undefined,
                    parentJobId
                );
                break;
            case OPTIMIZATION_CATEGORIES.STORAGE_SIZING:
                await optimizeSizing(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    [optimizationSubcategory as unknown as OPTIMIZE_SIZING_CONFIGS],
                    parentJobId
                );
                break;
            case OPTIMIZATION_CATEGORIES.MAXDOP:
                await optimizeMaxDop(accountId, credentialsId, region, databaseHostId, databaseInstanceId, parentJobId);
                break;
            default:
                break;
        }
    } catch (error: any) {
        logger.error(
            `Error occurred while optimizing storage tier for host ${databaseHostId}, instance ${databaseInstanceId}, configuration category ${optimizationCategory}. Error: ${error}`
        );
    }
}

async function handleBulkOptimization(
    accountId: string,
    optimizationCategory: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[],
    masterOptimizeParentId: string
) {
    logger.info(
        `Handle bulk optimizing : ${accountId}, ${optimizationCategory}, hostsToOptimize: ${hostsToOptimize?.length}, ${masterOptimizeParentId}`
    );
    let masterOptimizeParentStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    try {
        await Promise.all(
            hostsToOptimize.map(async ({ configurationName: optimizationSubcategory, databaseHosts }) =>
                Promise.all(
                    databaseHosts.map(
                        throat(3, async ({ id: databaseHostId, sqlServerInstances, credentialsId, region }) => {
                            if (optimizationSubcategory === OPTIMIZE_RESILIENCY_CONFIGS.AWS_BACKUP) {
                                await handleUpdateAwsBackup(
                                    accountId,
                                    credentialsId,
                                    region,
                                    databaseHosts,
                                    masterOptimizeParentId
                                );
                            } else {
                                if (isEmpty(sqlServerInstances)) {
                                    logger.error(`No instances given for resource ${databaseHostId}.`);
                                }
                                await Promise.all(
                                    sqlServerInstances.map(async instance => {
                                        await handleOptimization(
                                            accountId,
                                            credentialsId,
                                            region,
                                            optimizationCategory,
                                            optimizationSubcategory,
                                            databaseHostId,
                                            instance,
                                            masterOptimizeParentId
                                        );
                                    })
                                );
                            }
                        })
                    )
                )
            )
        );
    } catch (error: any) {
        logger.error(
            `Error occurred while optimizing operating system configuration for account ${accountId}. Error: ${error}`
        );
        masterOptimizeParentStatus = JOBSTATUS.FAILED;
    } finally {
        if (masterOptimizeParentStatus !== JOBSTATUS.FAILED) {
            await updateParentJobStatus(accountId, masterOptimizeParentId);
        }
    }
}

async function bulkComputeOptimization(
    accountId: string,
    hostsToOptimize: BulkOptimizeComputePerHostRequestBodyType[]
) {
    logger.info(`Bulk optimizing compute: ${accountId}, hostsToOptimize: ${hostsToOptimize?.length}`);

    if (isEmpty(hostsToOptimize)) {
        const errorMessage = 'databaseHosts cannot be empty.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const jobMetadata: JobMetadata = {
        hostsToOptimize: await formatJobMetadata(hostsToOptimize)
    };

    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        '',
        '',
        accountId,
        JOBTYPE.WELL_ARCHITECTED,
        'Fix compute',
        'Fix compute',
        undefined,
        jobMetadata
    );

    try {
        handleBulkComputeOptimization(accountId, hostsToOptimize, parentJobId);
        return { jobId: parentJobId };
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, (error as Error).message);
    }
}

async function handleBulkComputeOptimization(
    accountId: string,
    hostsToOptimize: BulkOptimizeComputePerHostRequestBodyType[],
    masterOptimizeJobParentId: string
) {
    logger.info(
        `Handle bulk optimizing compute: ${accountId},  hostsToOptimize: ${hostsToOptimize?.length}, ${masterOptimizeJobParentId}`
    );
    let masterOptimizeParentStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';
    try {
        await Promise.all(
            hostsToOptimize.map(async ({ databaseHosts, configurationName: optimizationCategory }) => {
                await Promise.all(
                    databaseHosts.map(
                        async ({
                            id: databaseHostId,
                            sqlServerInstances,
                            instanceType,
                            networkAdapters,
                            region,
                            credentialsId
                        }) => {
                            if (isEmpty(sqlServerInstances)) {
                                logger.error(`No instances given for resource ${databaseHostId}.`);
                            }
                            const [{ resource_name: resourceName }] = await listResources({
                                accountId,
                                resourceId: databaseHostId,
                                credentialIds: credentialsId,
                                selectKeys: ['resource_name']
                            });
                            const jobMetadata: JobMetadata = {
                                hostsToOptimize: await formatJobMetadata(hostsToOptimize)
                            };
                            const optimizationName =
                                OptimizeComputeJobNames[optimizationCategory as keyof typeof OptimizeComputeJobNames];
                            const parentJobId = await handleOptimizeJobCreation(
                                accountId,
                                credentialsId,
                                region,
                                accountId,
                                JOBTYPE.WELL_ARCHITECTED,
                                `Fix ${optimizationName} for ${resourceName}`,
                                `Fix ${optimizationName} for ${resourceName}`,
                                masterOptimizeJobParentId,
                                jobMetadata
                            );
                            try {
                                switch (optimizationCategory) {
                                    case OptimizeComputeParams.RSS_CONFIG:
                                        await handleOptimizeRssOptimization(
                                            accountId,
                                            credentialsId,
                                            region,
                                            databaseHostId,
                                            sqlServerInstances[0],
                                            networkAdapters!,
                                            parentJobId,
                                            masterOptimizeJobParentId
                                        );
                                        break;
                                    case OptimizeComputeParams.COMPUTE:
                                    default:
                                        if (!instanceType) {
                                            logger.error(`instanceType cannot be empty, ${databaseHostId}.`);
                                        }
                                        await optimizeCompute(
                                            accountId,
                                            credentialsId,
                                            region,
                                            databaseHostId,
                                            sqlServerInstances[0], // Since compute remediation is at host level. It is okay to pick one instance.
                                            instanceType as string,
                                            parentJobId
                                        );
                                }
                                masterOptimizeParentStatus = JOBSTATUS.COMPLETED;
                            } catch (error: any) {
                                errorMessage = `Error occurred while fixing compute for account ${accountId}, ${databaseHostId}. Error: ${error}`;
                                logger.error(errorMessage);
                                masterOptimizeParentStatus = JOBSTATUS.FAILED;
                                throw Error(errorMessage);
                            }
                        }
                    )
                );
            })
        );
    } catch (error: any) {
        logger.error(error.message);
        masterOptimizeParentStatus = JOBSTATUS.FAILED;
        errorMessage = error.message;
        throw error;
    } finally {
        await updateJobDetails(accountId, masterOptimizeJobParentId, {
            status: masterOptimizeParentStatus,
            error: errorMessage,
            endTime: Date.now()
        });
    }
}

async function handleHASharedStorageOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    optimizationCategory: string,
    databaseHostId: string,
    databaseInstanceId: string,
    body: BulkOptimizeHASharedStorageBodyType
) {
    const jobMetadata: JobMetadata = {
        hostsToOptimize: await formatJobMetadata(body.hostsToOptimize)
    };

    const jobDescription = 'Fix shared storage for High Availability Cluster';
    logger.info(
        `Starting shared storage optimization for High Availability Cluster. Account: ${accountId}, Credentials: ${credentialsId}, Region: ${region}, Category: ${optimizationCategory}, Host: ${databaseHostId}, Instance: ${databaseInstanceId}`
    );
    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        '',
        '',
        accountId,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        undefined,
        jobMetadata
    );

    try {
        const ontapLunUuids = body.hostsToOptimize?.[0]?.databaseHosts?.[0]?.sqlServerInstances?.[0]?.ontapLunUuids;

        logger.info(`ONTAP LUN UUIDs extracted for optimization: ${JSON.stringify(ontapLunUuids)}`);

        if (!ontapLunUuids) {
            logger.warn(
                `No ONTAP LUN UUIDs found. Skipping shared storage optimization for host ${databaseHostId}, instance ${databaseInstanceId}.`
            );
            return;
        }

        switch (optimizationCategory) {
            case OptimizeHighAvailabilityParams.SHARED_STORAGE:
                logger.info(
                    `Initiating shared storage optimization for host ${databaseHostId}, instance ${databaseInstanceId}.`
                );
                await handleSharedStorageOptimize(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    ontapLunUuids,
                    parentJobId
                );
                break;
            default:
                logger.warn(
                    `Optimization category "${optimizationCategory}" is not supported for host ${databaseHostId}, instance ${databaseInstanceId}.`
                );
                break;
        }
    } catch (error: unknown) {
        logger.error(
            `Failed to optimize shared storage for host ${databaseHostId}, instance ${databaseInstanceId}. Reason: ${
                (error as Error)?.message || error
            }`,
            { stack: (error as Error)?.stack }
        );
    }
    return { jobId: parentJobId };
}

async function fetchInstanceConfigurationAndVolumeMapping(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceId: string,
    clones: CloneDetailType[]
): Promise<{
    configData: CloneAssessment;
    instanceName: string;
    sqlServerName: string;
    serverNameWithHostName: string;
    volumeMapping?: MappedVolumeResponseForClone;
}> {
    // Fetch configuration data for the databaseHostId and databaseInstanceId
    const [persistedConfigurationData] = await listInstanceConfigIncludingResourceAndInstance({
        accountId,
        region,
        credentialsId,
        resourceId: databaseHostId,
        databaseInstanceId: instanceId,
        configDataType: AssessmentCategories.CLONE,
        pageSize: 1
    });

    const {
        config_data: configData,
        database_instances: { database_instance_name: instanceName = '' } = {},
        resource: { resource_name: sqlServerName = '' } = {}
    } = persistedConfigurationData || {};

    if (!instanceName || !sqlServerName) {
        logger.error('Instance name or SQL server name is missing');
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Instance name or SQL server name is missing');
    }

    const serverNameWithHostName = getServerNameWithHostname(sqlServerName, instanceName);

    // Check if any clone requires volume mapping
    const requiresVolumeMapping = clones.some(clone => clone.action === 'delete' && clone.clonedBy === 'other');

    let volumeMapping: MappedVolumeResponseForClone | undefined;
    if (requiresVolumeMapping) {
        // Fetch the mapped volume details for the instance
        volumeMapping = await getMappedVolumeDetailForInstance(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceId
        );
    }

    return {
        configData: configData as unknown as CloneAssessment,
        instanceName,
        sqlServerName,
        serverNameWithHostName,
        volumeMapping
    };
}

// Flattens hostsToOptimize to extract SQL Server instances and their metadata.
function extractInstancesToOptimize(hostsToOptimize: BulkOptimizeCloneInHostRequestBodyType[]) {
    return hostsToOptimize.flatMap(({ databaseHosts }) =>
        databaseHosts.flatMap(({ sqlServerInstances, region, credentialsId, id: databaseHostId }) =>
            sqlServerInstances.map(({ instanceId, clones }) => ({
                instanceId,
                clones,
                region,
                credentialsId,
                databaseHostId
            }))
        )
    );
}

async function validateAndFilterDatabaseHosts<T extends { credentialsId: string; region: string }>(
    accountId: string,
    databaseHosts: T[]
): Promise<T[]> {
    const validationResults = await Promise.all(
        databaseHosts.map(async ({ credentialsId, region }) => {
            if (!credentialsId || !region) {
                const errorMessage =
                    'Invalid input: credentialsId and region must be provided in all databaseHosts entries.';
                logger.error(errorMessage);
                throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
            }

            const isValid = await validateRequestDetails(accountId, credentialsId, region);

            if (!isValid) {
                logger.error(
                    `Invalid input: The combination of accountId (${accountId}), credentialsId (${credentialsId}), and region (${region}) does not match any records in the database.`
                );
            }

            return isValid;
        })
    );

    // Filter databaseHosts based on validation results
    return databaseHosts.filter((_, index) => validationResults[index]);
}

async function validateRequestDetails(accountId: string, credentialsId: string, region: string) {
    logger.info(`Validating request details: ${accountId}, ${credentialsId}, ${region}`);

    const [resourceDetail] = await listResources({
        accountId,
        credentialIds: credentialsId,
        region,
        pageSize: 1
    });

    if (isEmpty(resourceDetail)) {
        return false;
    }

    return true;
}

export { bulkOptimization, bulkComputeOptimization, bulkCloneOptimization, handleHASharedStorageOptimization };
