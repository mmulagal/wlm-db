import { isEmpty } from 'bullmq';
import throat from 'throat';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../utils/logger';
import { HttpErrorCodes } from '../utils/consts';
import {
    BulkOptimizeCloneInHostRequestBodyType,
    BulkOptimizeComputePerHostRequestBodyType,
    BulkOptimizeGeneralPerHostRequestBodyType,
    OptimizeClonesPerHostRequestBodyType,
    OptimizePerHostRequestBodyType,
    OptimizeHASharedStorageRequestBodyType,
    BulkOptimizeHASharedStorageRequestBodyType
} from '../routes/types/mssql-continuous-optimisation.types';
import { handleOptimizeJobCreation, JobMetadata } from './continuous-optimization/assessment-utils';
import {
    handleUpdateAwsBackup,
    optimizeMaxDop,
    optimizeOperatingSystemSettings,
    optimizeSizing,
    optimizeStorageTier
} from './cont-opt-optimize-operations';
import { updateJobDetails, updateParentJobStatus } from './database/job-operations';
import {
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
import { handleOptimizeMTUAlignment } from './continuous-optimization/mssql/mtu-optimize-operations';
import { handleBulkCloneOptimization } from './continuous-optimization/mssql/clone-optimization-operations';
import {
    handleSharedStorageOptimize,
    optimizeSqlServerService,
    optimizeHighAvailabilityConfiguration
} from './continuous-optimization/mssql/resilience-optimize-operations';

const logger = getLogger();

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

    // Check if all databaseHosts arrays are empty
    const allEmpty = hostsToOptimize.every(host => isEmpty(host.databaseHosts));
    if (allEmpty) {
        const errorMessage = 'No valid database hosts found after validation. Please provide at least one valid host.';
        logger.warn(errorMessage);
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }

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
            : optimizationCategory === OPTIMIZATION_CATEGORIES.MTU_ALIGNMENT
            ? 'Fix MTU alignment configuration'
            : optimizationCategory === OPTIMIZE_RESILIENCY_CONFIGS.AWS_BACKUP
            ? 'Fix AWS FSx for ONTAP automatic backup configuration'
            : optimizationCategory === OptimizeHighAvailabilityParams.HEARTBEAT_SETTINGS
            ? 'Fix heartbeat settings in cluster configuration'
            : optimizationCategory === OptimizeHighAvailabilityParams.CLUSTER_QUORUM
            ? 'Fix cluster quorum type in cluster configuration'
            : optimizationCategory === OptimizeHighAvailabilityParams.SQLSERVER_SERVICE
            ? 'Fix SQL server service status in cluster configuration'
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

async function bulkHostLevelOptimization(
    accountId: string,
    optimizationCategory: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[],
    masterOptimizeParentId: string
) {
    logger.info(
        `Handle bulk optimizing host level: ${accountId}, ${optimizationCategory}, hostsToOptimize: ${hostsToOptimize?.length}, ${masterOptimizeParentId}`
    );
    let masterOptimizeParentStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    const groupedHosts = hostsToOptimize.reduce((acc, { configurationName, databaseHosts }) => {
        databaseHosts.forEach(({ credentialsId, region, ...rest }) => {
            const key = `${credentialsId}-${region}-${configurationName}`;
            acc[key] ??= { credentialsId, region, optimizationSubcategory: configurationName, databaseHosts: [] };
            acc[key].databaseHosts.push({ ...rest });
        });
        return acc;
    }, {} as Record<string, { credentialsId: string; region: string; optimizationSubcategory: string; databaseHosts: any[] }>);

    try {
        await Promise.all(
            Object.entries(groupedHosts).map(async ([, { credentialsId, region, databaseHosts }]) => {
                if (optimizationCategory === OPTIMIZE_RESILIENCY_CONFIGS.AWS_BACKUP) {
                    return handleUpdateAwsBackup(
                        accountId,
                        credentialsId,
                        region,
                        databaseHosts,
                        masterOptimizeParentId
                    );
                }

                if (optimizationCategory === OPTIMIZATION_CATEGORIES.MTU_ALIGNMENT) {
                    return Promise.all(
                        databaseHosts.map(
                            async (host: { id: string; sqlServerInstances: string[]; interfaceNames?: string[] }) => {
                                const { id: databaseHostId, sqlServerInstances, interfaceNames } = host;

                                if (sqlServerInstances && sqlServerInstances.length > 0) {
                                    const interfaces = (interfaceNames || []).map((name: string) => ({
                                        interfaceName: name
                                    }));

                                    await handleOptimizeMTUAlignment(
                                        accountId,
                                        credentialsId,
                                        region,
                                        databaseHostId,
                                        sqlServerInstances[0],
                                        interfaces,
                                        masterOptimizeParentId
                                    );
                                }
                            }
                        )
                    );
                }

                if (
                    optimizationCategory === OptimizeHighAvailabilityParams.HEARTBEAT_SETTINGS ||
                    optimizationCategory === OptimizeHighAvailabilityParams.CLUSTER_QUORUM
                ) {
                    return Promise.all(
                        databaseHosts.map(async (host: { id: string; sqlServerInstances: string[] }) => {
                            const { id: databaseHostId, sqlServerInstances } = host;

                            if (sqlServerInstances && sqlServerInstances.length > 0) {
                                await optimizeHighAvailabilityConfiguration(
                                    accountId,
                                    credentialsId,
                                    region,
                                    databaseHostId,
                                    sqlServerInstances,
                                    optimizationCategory,
                                    masterOptimizeParentId
                                );
                            }
                        })
                    );
                }
            })
        );
    } catch (error: any) {
        logger.error(
            `Error occurred while optimizing for account ${accountId}, ${optimizationCategory}. Error: ${error}`
        );
        masterOptimizeParentStatus = JOBSTATUS.FAILED;
    } finally {
        if (masterOptimizeParentStatus !== JOBSTATUS.FAILED) {
            await updateParentJobStatus(accountId, masterOptimizeParentId);
        }
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

    if (
        optimizationCategory === OPTIMIZE_RESILIENCY_CONFIGS.AWS_BACKUP ||
        optimizationCategory === OPTIMIZATION_CATEGORIES.MTU_ALIGNMENT ||
        optimizationCategory === OptimizeHighAvailabilityParams.HEARTBEAT_SETTINGS ||
        optimizationCategory === OptimizeHighAvailabilityParams.CLUSTER_QUORUM
    ) {
        return bulkHostLevelOptimization(accountId, optimizationCategory, hostsToOptimize, masterOptimizeParentId);
    }
    let masterOptimizeParentStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    const flattenedHosts = hostsToOptimize.flatMap(({ configurationName: optimizationSubcategory, databaseHosts }) =>
        databaseHosts.map(databaseHost => ({
            ...databaseHost,
            optimizationSubcategory
        }))
    );

    try {
        await Promise.all(
            flattenedHosts.map(
                throat(
                    3,
                    async ({
                        id: databaseHostId,
                        sqlServerInstances,
                        credentialsId,
                        region,
                        optimizationSubcategory
                    }) => {
                        if (isEmpty(sqlServerInstances)) {
                            logger.error(`No instances given for resource ${databaseHostId}.`);
                        }

                        await Promise.all(
                            sqlServerInstances.map(async databaseInstanceId => {
                                switch (optimizationCategory) {
                                    case OPTIMIZATION_CATEGORIES.OPERATING_SYSTEM:
                                        await optimizeOperatingSystemSettings(
                                            accountId,
                                            credentialsId,
                                            region,
                                            databaseHostId,
                                            databaseInstanceId,
                                            optimizationSubcategory,
                                            masterOptimizeParentId
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
                                            masterOptimizeParentId
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
                                            masterOptimizeParentId
                                        );
                                        break;
                                    case OPTIMIZATION_CATEGORIES.MAXDOP:
                                        await optimizeMaxDop(
                                            accountId,
                                            credentialsId,
                                            region,
                                            databaseHostId,
                                            databaseInstanceId,
                                            masterOptimizeParentId
                                        );
                                        break;
                                    case OptimizeHighAvailabilityParams.SQLSERVER_SERVICE:
                                        await optimizeSqlServerService(
                                            accountId,
                                            credentialsId,
                                            region,
                                            databaseHostId,
                                            databaseInstanceId,
                                            masterOptimizeParentId
                                        );
                                        break;
                                    default:
                                        break;
                                }
                            })
                        );
                    }
                )
            )
        );
    } catch (error: any) {
        logger.error(
            `Error occurred while optimizing for account ${accountId}, ${optimizationCategory}. Error: ${error}`
        );
        masterOptimizeParentStatus = JOBSTATUS.FAILED;
    } finally {
        // Main Master job is updated here
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

async function bulkHASharedStorageOptimization(
    accountId: string,
    optimizationCategory: string,
    hostsToOptimize: BulkOptimizeHASharedStorageRequestBodyType[]
) {
    logger.info(
        `Starting bulkHASharedStorageOptimization for accountId: ${accountId}, optimizationCategory: ${optimizationCategory}, hostsToOptimize count: ${hostsToOptimize?.length}`
    );

    if (isEmpty(hostsToOptimize)) {
        const errorMessage =
            'No database hosts provided for shared storage optimization. Please provide at least one host.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }

    // Validate the account id, credentials id, region is valid details in the DB and filter databaseHosts for each host
    await Promise.all(
        hostsToOptimize.map(
            throat(3, async host => {
                host.databaseHosts = await validateAndFilterDatabaseHosts<OptimizeHASharedStorageRequestBodyType>(
                    accountId,
                    host.databaseHosts
                );
            })
        )
    );

    const jobMetadata: JobMetadata = {
        hostsToOptimize: await formatJobMetadata(hostsToOptimize)
    };

    const jobDescription = 'Fix shared storage for high availability cluster';
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

    handleSharedStorageOptimize(accountId, hostsToOptimize, parentJobId);

    return { jobId: parentJobId };
}

async function validateAndFilterDatabaseHosts<T extends { credentialsId: string; region: string; id: string }>(
    accountId: string,
    databaseHosts: T[]
): Promise<T[]> {
    const validationResults = await Promise.all(
        databaseHosts.map(async ({ id: databaseHostId, credentialsId, region }) => {
            if (!credentialsId || !region) {
                const errorMessage =
                    'Invalid input: credentialsId and region must be provided in all databaseHosts entries.';
                logger.error(errorMessage);
                throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
            }

            const isValid = await validateRequestDetails(accountId, credentialsId, region, databaseHostId);

            if (!isValid) {
                const errMsg = `Invalid input: The combination of accountId (${accountId}), credentialsId (${credentialsId}), and region (${region}) does not match any records in the database.`;
                logger.error(errMsg);
                throw new Error(errMsg);
            }

            return isValid;
        })
    );

    // Filter databaseHosts based on validation results
    return databaseHosts.filter((_, index) => validationResults[index]);
}

async function validateRequestDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string
) {
    logger.info(`Validating request details: ${accountId}, ${credentialsId}, ${region}`);

    const [resourceDetail] = await listResources({
        accountId,
        credentialIds: credentialsId,
        region,
        pageSize: 1,
        resourceId: databaseHostId
    });

    if (isEmpty(resourceDetail)) {
        return false;
    }

    return true;
}

export {
    bulkOptimization,
    bulkComputeOptimization,
    bulkCloneOptimization,
    bulkHASharedStorageOptimization,
    bulkHostLevelOptimization,
    validateAndFilterDatabaseHosts
};
