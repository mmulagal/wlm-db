import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import throat from 'throat';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import {
    BackupOptimizePerHostRequestBodyType,
    HostsToOptimizeType,
    OptimizeRequestBodyType
} from '../../../routes/types/oracle-continuous-optimization.types';
import {
    AssessmentCategoriesOracle,
    OptimizeOracleTypes,
    OracleOptimizeJobDescriptions
} from '../../../utils/continous-optimization-consts';
import getLogger from '../../../utils/logger';
import { oracleOptimizeStorageOS } from './storage-os-optimize-operations';
import { HttpErrorCodes } from '../../../utils/consts';
import { handleOptimizeJobCreation } from '../assessment-utils';
import { updateParentJobStatus } from '../../database/job-operations';
import { validateAndFilterDatabaseHosts } from '../../bulk-cont-opt-operations';
import { OracleJobMetadata } from './consts';
import { oracleOptimizeStorageSizing } from './storage-optimize-operations';
import { triggerOracleAssessmentAfterOptimization } from './assessment-operations';
import { handleFsxBackupOptimizeJob } from '../resilience-awsBackup-optimize-operations';

const logger = getLogger();

function formatJobMetadata(hostsToOptimize: HostsToOptimizeType) {
    return hostsToOptimize.flatMap(({ configurationName, databaseHosts }) =>
        databaseHosts.map(({ id, databases }) => ({
            resourceId: id,
            databases,
            optimizationType: configurationName
        }))
    );
}

async function optimizeOracleDatabase(accountId: string, params: OptimizeRequestBodyType) {
    const { type: optimizationType, hostsToOptimize } = params;
    if (!hostsToOptimize || hostsToOptimize?.length === 0) {
        const errorMessage = 'hostsToOptimize cannot be empty.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }

    logger.info(
        `Starting optimization of type ${optimizationType} for account ${accountId} on ${hostsToOptimize.length} hosts`
    );

    try {
        await Promise.all(
            hostsToOptimize.map(async host => {
                host.databaseHosts = await validateAndFilterDatabaseHosts(accountId, host.databaseHosts);
            })
        );
    } catch (error) {
        logger.error(error);
        throw createError(HttpErrorCodes.BAD_REQUEST, String(error));
    }

    const allEmpty = hostsToOptimize.every(host => isEmpty(host.databaseHosts));
    if (allEmpty) {
        const errorMessage = 'No valid database hosts found. Please provide at least one valid host.';
        logger.warn(errorMessage);
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }

    const jobMetadata: OracleJobMetadata = { hostsToOptimize: formatJobMetadata(hostsToOptimize) };
    const jobDescription = OracleOptimizeJobDescriptions[optimizationType as OptimizeOracleTypes];

    const masterJobId = await handleOptimizeJobCreation(
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

    if (optimizationType === OptimizeOracleTypes.AWS_BACKUP) {
        handleOracleAwsBackupOptimization(accountId, hostsToOptimize, masterJobId);
    } else {
        handleBulkOptimization(accountId, optimizationType, hostsToOptimize, masterJobId);
    }

    return masterJobId;
}

async function handleBulkOptimization(
    accountId: string,
    optimizationCategory: string,
    hostsToOptimize: HostsToOptimizeType,
    masterOptimizeParentId: string
) {
    logger.info(
        `Handle bulk optimizing : ${accountId}, ${optimizationCategory}, hostsToOptimize: ${hostsToOptimize?.length}, ${masterOptimizeParentId}`
    );

    const flattenedTasks = hostsToOptimize.flatMap(({ configurationName: optimizationSubcategory, databaseHosts }) =>
        databaseHosts.flatMap(({ id: databaseHostId, databases, credentialsId, region }) =>
            databases.map(databaseInstanceId => ({
                databaseHostId,
                databaseInstanceId,
                credentialsId,
                region,
                optimizationSubcategory
            }))
        )
    );
    let jobError = '';
    try {
        await Promise.all(
            flattenedTasks.map(
                throat(
                    3,
                    async ({ databaseHostId, databaseInstanceId, credentialsId, region, optimizationSubcategory }) => {
                        try {
                            switch (optimizationCategory) {
                                case OptimizeOracleTypes.STORAGE_OPERATING_SYSTEM: {
                                    await oracleOptimizeStorageOS(
                                        accountId,
                                        credentialsId,
                                        region,
                                        databaseHostId,
                                        databaseInstanceId,
                                        optimizationSubcategory,
                                        masterOptimizeParentId
                                    );
                                    break;
                                }

                                case OptimizeOracleTypes.STORAGE_SIZING: {
                                    await oracleOptimizeStorageSizing(
                                        accountId,
                                        credentialsId,
                                        region,
                                        databaseHostId,
                                        databaseInstanceId,
                                        optimizationSubcategory,
                                        masterOptimizeParentId
                                    );
                                    break;
                                }

                                default:
                            }
                        } catch (error: any) {
                            logger.error(
                                `Error optimizing database ${databaseInstanceId} on host ${databaseHostId}: ${error.message}`
                            );
                        }
                    }
                )
            )
        );
    } catch (error: any) {
        jobError = String(error);
        logger.error(
            `Error occurred while optimizing for account ${accountId}, ${optimizationCategory}. Error: ${error}`
        );
    } finally {
        await updateParentJobStatus(accountId, masterOptimizeParentId, false, jobError);
    }
}

async function handleOracleAwsBackupOptimization(
    accountId: string,
    hostsToOptimize: HostsToOptimizeType,
    masterOptimizeParentId: string
) {
    logger.info(
        `Handle Oracle AWS backup optimization: ${accountId}, hostsToOptimize: ${hostsToOptimize?.length}, ${masterOptimizeParentId}`
    );

    const groupedHosts = hostsToOptimize.reduce(
        (acc, { databaseHosts }) => {
            databaseHosts.forEach(({ credentialsId, region, ...rest }) => {
                const key = `${credentialsId}-${region}`;
                acc[key] ??= { credentialsId, region, databaseHosts: [] };
                acc[key].databaseHosts.push({ credentialsId, region, ...rest });
            });
            return acc;
        },
        {} as Record<string, { credentialsId: string; region: string; databaseHosts: BackupOptimizePerHostRequestBodyType[] }>
    );

    let jobError = '';
    try {
        await Promise.all(
            Object.entries(groupedHosts).map(async ([, { credentialsId, region, databaseHosts }]) =>
                handleOracleUpdateAwsBackup(accountId, credentialsId, region, databaseHosts, masterOptimizeParentId)
            )
        );
    } catch (error: unknown) {
        jobError = String(error);
        logger.error('Error occurred while optimizing AWS backup', { accountId, error });
    } finally {
        await updateParentJobStatus(accountId, masterOptimizeParentId, false, jobError);
    }
}

async function handleOracleUpdateAwsBackup(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHosts: BackupOptimizePerHostRequestBodyType[],
    masterOptimizeParentId: string
) {
    const { jobId, jobStatus } = await handleFsxBackupOptimizeJob(
        accountId,
        credentialsId,
        region,
        databaseHosts,
        masterOptimizeParentId,
        {
            hostsToOptimize: databaseHosts.map(({ id, databases }) => ({
                optimizationType: 'aws-backup',
                resourceId: id,
                databases
            }))
        }
    );

    if (jobStatus === JOBSTATUS.COMPLETED) {
        await Promise.all(
            databaseHosts.flatMap(({ id: databaseHostId, databases }) =>
                databases.map(databaseInstanceId =>
                    triggerOracleAssessmentAfterOptimization(
                        credentialsId,
                        region,
                        accountId,
                        databaseHostId,
                        databaseHostId,
                        jobId,
                        { id: databaseInstanceId },
                        AssessmentCategoriesOracle.AWS_BACKUP
                    )
                )
            )
        );
    }
}

export { optimizeOracleDatabase };
