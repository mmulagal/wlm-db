import { isEmpty } from 'bullmq';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../utils/logger';
import { HttpErrorCodes } from '../utils/consts';
import { BulkOptimizeGeneralPerHostRequestBodyType } from '../routes/types/continuous-optimization.types';
import { handleOptimizeJobCreation, JobMetadata } from './continuous-optimization/assessment-utils';
import {
    optimizeMaxDop,
    optimizeOperatingSystemSettings,
    optimizeSizing,
    optimizeStorageTier
} from './cont-opt-optimize-operations';
import { updateParentJobStatus } from './database/job-operations';
import { OPTIMIZATION_CATEGORIES, OPTIMIZE_SIZING_CONFIGS } from '../utils/continous-optimization-consts';
import optimizeCompute from './continuous-optimization/compute-optimize-operations';

const logger = getLogger();

async function formatJobMetadata(hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[]) {
    return hostsToOptimize.flatMap(({ type, databaseHosts }) =>
        databaseHosts.map(({ id, sqlServerInstances }) => ({
            resourceId: id,
            sqlServerInstances,
            optimizationType: type
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
            hostsToOptimize.map(async ({ type: optimizationSubcategory, databaseHosts }) => {
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
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[]
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

    handleBulkComputeOptimization(accountId, credentialsId, region, hostsToOptimize, parentJobId);
    return { jobId: parentJobId };
}

async function handleBulkComputeOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[],
    masterOptimizeParentId: string
) {
    logger.info(
        `Handle bulk optimizing compute: ${accountId}, ${credentialsId}, ${region}, ${hostsToOptimize}, ${masterOptimizeParentId}`
    );
    let masterOptimizeParentStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    try {
        await Promise.all(
            hostsToOptimize.map(async ({ databaseHosts }) => {
                await Promise.all(
                    databaseHosts.map(async ({ id: databaseHostId, sqlServerInstances, instanceType }) => {
                        if (isEmpty(sqlServerInstances)) {
                            logger.error(`No instances given for resource ${databaseHostId}.`);
                        }
                        if (!instanceType) {
                            logger.error(`instanceType cannot be empty, ${databaseHostId}.`);
                        }
                        try {
                            await optimizeCompute(
                                accountId,
                                credentialsId,
                                region,
                                databaseHostId,
                                sqlServerInstances[0], // Since compute remediation is at host level. It is okay to pick one instance.
                                instanceType as string,
                                masterOptimizeParentId
                            );
                        } catch (error: any) {
                            logger.error(
                                `Error occurred while optimizing compute for account ${accountId}, ${databaseHostId}. Error: ${error}`
                            );
                            masterOptimizeParentStatus = JOBSTATUS.FAILED;
                        }
                    })
                );
            })
        );
    } catch (error: any) {
        logger.error(`Error occurred while optimizing compute for account ${accountId}. Error: ${error}`);
        masterOptimizeParentStatus = JOBSTATUS.FAILED;
    } finally {
        if (masterOptimizeParentStatus !== JOBSTATUS.FAILED) {
            await updateParentJobStatus(accountId, masterOptimizeParentId);
        }
    }
}

export { bulkOptimization, bulkComputeOptimization };
