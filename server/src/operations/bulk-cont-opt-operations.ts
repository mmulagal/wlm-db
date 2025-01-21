import { isEmpty } from 'bullmq';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../utils/logger';
import { HttpErrorCodes } from '../utils/consts';
import { BulkOptimizeGeneralPerHostRequestBodyType } from '../routes/types/continuous-optimization.types';
import { handleOptimizeJobCreation, JobMetadata } from './continuous-optimization/assessment-utils';
import { optimizeOperatingSystemSettings, optimizeSizing, optimizeStorageTier } from './cont-opt-optimize-operations';
import { updateParentJobStatus } from './database/job-operations';
import { OPTIMIZE_SIZING_CONFIGS } from '../utils/continous-optimization-consts';
import optimizeCompute from './continuous-optimization/compute-optimize-operations';

const logger = getLogger();

async function bulkStorageSizingConfigurationOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[]
) {
    logger.info(`Bulk optimizing storage sizing: ${accountId}, ${credentialsId}, ${region}, ${hostsToOptimize}`);

    if (isEmpty(hostsToOptimize)) {
        const errorMessage = 'databaseHosts cannot be empty.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const jobMetaData: JobMetadata = {
        hostsToOptimize: hostsToOptimize.map(each => ({
            resourceId: each.databaseHosts[0].id,
            sqlInstances: each.databaseHosts[0].sqlServerInstances,
            optimizationType: each.type
        }))
    };

    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        accountId,
        JOBTYPE.OPTIMIZATION,
        'Optimize storage sizing',
        'Optimize storage sizing',
        undefined,
        jobMetaData
    );

    handleBulkStorageSizingConfigurationOptimization(accountId, credentialsId, region, hostsToOptimize, parentJobId);
    return { jobId: parentJobId };
}

async function handleBulkStorageSizingConfigurationOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[],
    masterOptimizeParentId: string
) {
    logger.info(
        `Handle bulk optimizing storage sizing: ${accountId}, ${credentialsId}, ${region}, ${hostsToOptimize}, ${masterOptimizeParentId}`
    );
    let masterOptimizeParentStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    try {
        await Promise.all(
            hostsToOptimize.map(async each => {
                const optimizationType = each.type;
                const { databaseHosts } = each;
                await Promise.all(
                    databaseHosts.map(async host => {
                        const databaseHostId = host.id;
                        const instances = host.sqlServerInstances;
                        if (isEmpty(instances)) {
                            const errorMessage = `No instances given for resource ${databaseHostId}.`;
                            logger.error(errorMessage);
                        }
                        await Promise.all(
                            instances.map(async instance => {
                                try {
                                    await optimizeSizing(
                                        accountId,
                                        credentialsId,
                                        region,
                                        databaseHostId,
                                        instance,
                                        [optimizationType as OPTIMIZE_SIZING_CONFIGS],
                                        masterOptimizeParentId
                                    );
                                } catch (error: any) {
                                    logger.error(
                                        `Error occurred while optimizing storage configuration for host ${databaseHostId} and instance ${instance}. Error: ${error}`
                                    );
                                }
                            })
                        );
                    })
                );
            })
        );
    } catch (error: any) {
        logger.error(`Error occurred while optimizing storage sizing for account ${accountId}. Error: ${error}`);
        masterOptimizeParentStatus = JOBSTATUS.FAILED;
    } finally {
        if (masterOptimizeParentStatus !== JOBSTATUS.FAILED) {
            await updateParentJobStatus(accountId, masterOptimizeParentId);
        }
    }
}

async function bulkStorageTierConfigurationOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[]
) {
    logger.info(`Bulk optimizing storage tier: ${accountId}, ${credentialsId}, ${region}, ${hostsToOptimize}`);
    if (isEmpty(hostsToOptimize)) {
        const errorMessage = 'databaseHosts cannot be empty.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const jobMetaData: JobMetadata = {
        hostsToOptimize: hostsToOptimize.map(each => ({
            resourceId: each.databaseHosts[0].id,
            sqlInstances: each.databaseHosts[0].sqlServerInstances,
            optimizationType: each.type
        }))
    };

    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        accountId,
        JOBTYPE.OPTIMIZATION,
        'Optimize storage tier',
        'Optimize storage tier',
        undefined,
        jobMetaData
    );

    handleBulkStorageTierOptimization(accountId, credentialsId, region, hostsToOptimize, parentJobId);

    return { jobId: parentJobId };
}

async function handleBulkStorageTierOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[],
    masterOptimizeParentId: string
) {
    logger.info(
        `Handle bulk optimizing storage sizing: ${accountId}, ${credentialsId}, ${region}, ${hostsToOptimize}, ${masterOptimizeParentId}`
    );
    let masterOptimizeParentStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    try {
        await Promise.all(
            hostsToOptimize.map(async each => {
                const { databaseHosts } = each;
                await Promise.all(
                    databaseHosts.map(async host => {
                        const databaseHostId = host.id;
                        const instances = host.sqlServerInstances;
                        if (isEmpty(instances)) {
                            const errorMessage = `No instances given for resource ${databaseHostId}.`;
                            logger.error(errorMessage);
                        }
                        await Promise.all(
                            instances.map(async instance => {
                                try {
                                    await optimizeStorageTier(
                                        accountId,
                                        credentialsId,
                                        region,
                                        databaseHostId,
                                        instance,
                                        masterOptimizeParentId
                                    );
                                } catch (error: any) {
                                    logger.error(
                                        `Error occurred while optimizing storage tier for host ${databaseHostId} and instance ${instance}. Error: ${error}`
                                    );
                                }
                            })
                        );
                    })
                );
            })
        );
    } catch (error: any) {
        logger.error(`Error occurred while optimizing storage tier for account ${accountId}. Error: ${error}`);
        masterOptimizeParentStatus = JOBSTATUS.FAILED;
    } finally {
        if (masterOptimizeParentStatus !== JOBSTATUS.FAILED) {
            await updateParentJobStatus(accountId, masterOptimizeParentId);
        }
    }
}

async function bulkOperatingSystemConfigurationOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[]
) {
    logger.info(
        `Bulk optimizing operating system configuration: ${accountId}, ${credentialsId}, ${region}, ${hostsToOptimize}`
    );

    if (isEmpty(hostsToOptimize)) {
        const errorMessage = 'databaseHosts cannot be empty.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const jobMetaData: JobMetadata = {
        hostsToOptimize: hostsToOptimize.map(each => ({
            resourceId: each.databaseHosts[0].id,
            sqlInstances: each.databaseHosts[0].sqlServerInstances,
            optimizationType: each.type
        }))
    };

    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        accountId,
        JOBTYPE.OPTIMIZATION,
        'Optimize operating system configuration',
        'Optimize operating system configuration',
        undefined,
        jobMetaData
    );

    handleBulkOperatingSystemConfigurationOptimization(accountId, credentialsId, region, hostsToOptimize, parentJobId);
    return { jobId: parentJobId };
}

async function handleBulkOperatingSystemConfigurationOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    hostsToOptimize: BulkOptimizeGeneralPerHostRequestBodyType[],
    masterOptimizeParentId: string
) {
    logger.info(
        `Handle bulk optimizing operating system configuration: ${accountId}, ${credentialsId}, ${region}, ${hostsToOptimize}, ${masterOptimizeParentId}`
    );
    let masterOptimizeParentStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    try {
        await Promise.all(
            hostsToOptimize.map(async each => {
                const { databaseHosts } = each;
                await Promise.all(
                    databaseHosts.map(async host => {
                        const optimizationType = each.type;
                        const databaseHostId = host.id;
                        const instances = host.sqlServerInstances;
                        if (isEmpty(instances)) {
                            const errorMessage = `No instances given for resource ${databaseHostId}.`;
                            logger.error(errorMessage);
                        }
                        await Promise.all(
                            instances.map(async instance => {
                                try {
                                    await optimizeOperatingSystemSettings(
                                        accountId,
                                        credentialsId,
                                        region,
                                        databaseHostId,
                                        instance,
                                        optimizationType,
                                        masterOptimizeParentId
                                    );
                                } catch (error: any) {
                                    logger.error(
                                        `Error occurred while optimizing operating system configuration for host ${databaseHostId} and instance ${instance}. Error: ${error}`
                                    );
                                }
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

    const jobMetaData: JobMetadata = {
        hostsToOptimize: hostsToOptimize.map(each => ({
            resourceId: each.databaseHosts[0].id,
            sqlInstances: each.databaseHosts[0].sqlServerInstances,
            optimizationType: each.type
        }))
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
        jobMetaData
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
            hostsToOptimize.map(async each => {
                const { databaseHosts } = each;
                await Promise.all(
                    databaseHosts.map(async host => {
                        const databaseHostId = host.id;
                        const { instanceType } = host;
                        const instances = host.sqlServerInstances;
                        if (isEmpty(instances)) {
                            const errorMessage = `No instances given for resource ${databaseHostId}.`;
                            logger.error(errorMessage);
                        }
                        try {
                            await optimizeCompute(
                                accountId,
                                credentialsId,
                                region,
                                databaseHostId,
                                instanceType!,
                                instances[0],
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

export {
    bulkStorageSizingConfigurationOptimization,
    bulkStorageTierConfigurationOptimization,
    bulkOperatingSystemConfigurationOptimization,
    bulkComputeOptimization
};
