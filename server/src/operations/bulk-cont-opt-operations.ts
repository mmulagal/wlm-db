import { isEmpty } from 'bullmq';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../utils/logger';
import { HttpErrorCodes } from '../utils/consts';
import {
    BulkOptimizeComputePerHostRequestBodyType,
    BulkOptimizeGeneralPerHostRequestBodyType
} from '../routes/types/continuous-optimization.types';
import { handleOptimizeJobCreation, JobMetadata } from './continuous-optimization/assessment-utils';
import {
    handleUpdateAwsBackup,
    optimizeMaxDop,
    optimizeOperatingSystemSettings,
    optimizeSizing,
    optimizeStorageTier
} from './cont-opt-optimize-operations';
import { updateParentJobStatus } from './database/job-operations';
import {
    OPTIMIZATION_CATEGORIES,
    OPTIMIZE_RESILIENCY_CONFIGS,
    OPTIMIZE_SIZING_CONFIGS,
    OptimizeComputeJobNames,
    OptimizeComputeParams
} from '../utils/continous-optimization-consts';
import optimizeCompute from './continuous-optimization/compute-optimize-operations';
import { listResources } from '../lib/database/db';
import { handleOptimizeRssOptimization } from './continuous-optimization/rssConfig-optimize-operations';

const logger = getLogger();

async function formatJobMetadata(hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[]) {
    return hostsToOptimize.flatMap(({ configurationName, databaseHosts }) =>
        databaseHosts.map(({ id, sqlServerInstances, fsxFileSystemId, backupRetentionDays, backupStartTime }) => ({
            resourceId: id,
            sqlServerInstances,
            optimizationType: configurationName,
            fsxFileSystemId,
            backupRetentionDays,
            backupStartTime
        }))
    );
}
async function bulkOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    optimizationCategory: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[]
) {
    logger.info(
        `Bulk optimization: ${accountId}, ${credentialsId}, ${region}, ${optimizationCategory}, ${hostsToOptimize}`
    );

    if (isEmpty(hostsToOptimize)) {
        const errorMessage = 'databaseHosts cannot be empty.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    // validate the account id, credentials id, region is valid details in the DB
    const isValid = await validateRequestDetails(accountId, credentialsId, region);

    if (!isValid) {
        const errorMessage = `Invalid input: The combination of accountId (${accountId}), credentialsId (${credentialsId}), and region (${region}) does not match any records in the database.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const jobMetadata: JobMetadata = {
        hostsToOptimize: await formatJobMetadata(hostsToOptimize)
    };

    const jobDescription =
        optimizationCategory === OPTIMIZATION_CATEGORIES.OPERATING_SYSTEM
            ? 'Optimize operating system configuration'
            : optimizationCategory === OPTIMIZATION_CATEGORIES.STORAGE_TIER
            ? 'Optimize storage tier'
            : optimizationCategory === OPTIMIZATION_CATEGORIES.MAXDOP
            ? 'Optimize maxdop configuration'
            : optimizationCategory === OPTIMIZE_RESILIENCY_CONFIGS.AWS_BACKUP
            ? 'Optimize AWS FSx for ONTAP automatic backup configuration'
            : 'Optimize storage sizing';

    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        accountId,
        JOBTYPE.OPTIMIZATION,
        jobDescription,
        jobDescription,
        undefined,
        jobMetadata
    );

    handleBulkOptimization(accountId, credentialsId, region, optimizationCategory, hostsToOptimize, parentJobId);
    return { jobId: parentJobId };
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
    credentialsId: string,
    region: string,
    optimizationCategory: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[],
    masterOptimizeParentId: string
) {
    logger.info(
        `Handle bulk optimizing : ${accountId}, ${credentialsId}, ${region}, ${optimizationCategory}, ${hostsToOptimize}, ${masterOptimizeParentId}`
    );
    let masterOptimizeParentStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    try {
        await Promise.all(
            hostsToOptimize.map(async ({ configurationName: optimizationSubcategory, databaseHosts }) => {
                if (optimizationSubcategory === OPTIMIZE_RESILIENCY_CONFIGS.AWS_BACKUP) {
                    await handleUpdateAwsBackup(
                        accountId,
                        credentialsId,
                        region,
                        databaseHosts,
                        masterOptimizeParentId
                    );
                } else {
                    await Promise.all(
                        databaseHosts.map(async ({ id: databaseHostId, sqlServerInstances }) => {
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
                        })
                    );
                }
            })
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
    credentialsId: string,
    region: string,
    hostsToOptimize: BulkOptimizeComputePerHostRequestBodyType[]
) {
    logger.info(`Bulk optimizing compute: ${accountId}, ${credentialsId}, ${region}, ${hostsToOptimize}`);

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
        credentialsId,
        region,
        accountId,
        JOBTYPE.OPTIMIZATION,
        'Optimize compute',
        'Optimize compute',
        undefined,
        jobMetadata
    );

    try {
        handleBulkComputeOptimization(accountId, credentialsId, region, hostsToOptimize, parentJobId);
        return { jobId: parentJobId };
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, (error as Error).message);
    }
}

async function handleBulkComputeOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    hostsToOptimize: BulkOptimizeComputePerHostRequestBodyType[],
    masterOptimizeParentId: string
) {
    logger.info(
        `Handle bulk optimizing compute: ${accountId}, ${credentialsId}, ${region}, ${hostsToOptimize}, ${masterOptimizeParentId}`
    );
    let masterOptimizeParentStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    try {
        await Promise.all(
            hostsToOptimize.map(async ({ databaseHosts, configurationName: optimizationCategory }) => {
                await Promise.all(
                    databaseHosts.map(
                        async ({ id: databaseHostId, sqlServerInstances, instanceType, networkAdapters }) => {
                            if (isEmpty(sqlServerInstances)) {
                                logger.error(`No instances given for resource ${databaseHostId}.`);
                            }
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
                                JOBTYPE.OPTIMIZATION,
                                `Optimize ${optimizationName}`,
                                `Optimize ${optimizationName}`,
                                masterOptimizeParentId,
                                jobMetadata
                            );
                            try {
                                switch (optimizationCategory) {
                                    case OptimizeComputeParams.RSS_CONFIG:
                                        handleOptimizeRssOptimization(
                                            accountId,
                                            credentialsId,
                                            region,
                                            databaseHostId,
                                            sqlServerInstances[0],
                                            networkAdapters!,
                                            parentJobId
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
                                logger.error(
                                    `Error occurred while optimizing compute for account ${accountId}, ${databaseHostId}. Error: ${error}`
                                );
                                masterOptimizeParentStatus = JOBSTATUS.FAILED;
                            }
                        }
                    )
                );
            })
        );
    } catch (error: any) {
        logger.error(`Error occurred while optimizing compute for account ${accountId}. Error: ${error}`);
        masterOptimizeParentStatus = JOBSTATUS.FAILED;
        throw error;
    } finally {
        if (masterOptimizeParentStatus !== JOBSTATUS.FAILED) {
            await updateParentJobStatus(accountId, masterOptimizeParentId);
        }
    }
}

async function validateRequestDetails(accountId: string, credentialsId: string, region: string) {
    logger.info(`Validating request details: ${accountId}, ${credentialsId}, ${region}`);

    const [resourceDetail] = await listResources(accountId, undefined, credentialsId, region);

    if (isEmpty(resourceDetail)) {
        return false;
    }

    return true;
}

export { bulkOptimization, bulkComputeOptimization };
