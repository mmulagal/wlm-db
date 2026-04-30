import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import throat from 'throat';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';

import {
    BackupOptimizePerHostRequestBodyType,
    CloneOptimizePerHostRequestBodyType,
    HostsToOptimizeType,
    OracleCloneActionType,
    OptimizeRequestBodyType
} from '../../../routes/types/oracle-continuous-optimization.types';
import {
    AssessmentCategoriesOracle,
    AssessmentTriggeredBy,
    OptimizeOracleComputeHostOs,
    OptimizeOracleTypes,
    OracleOptimizeJobDescriptions
} from '../../../utils/continous-optimization-consts';
import getLogger from '../../../utils/logger';
import { HttpErrorCodes } from '../../../utils/consts';
import { handleOptimizeJobCreation } from '../assessment-utils';
import { updateParentJobStatus } from '../../database/job-operations';
import { validateAndFilterDatabaseHosts } from '../../bulk-cont-opt-operations';
import { OracleJobMetadata } from './consts';
import { oracleOptimizeStorageOS } from './storage-os-optimize-operations';
import { oracleOptimizeStorageSizing } from './storage-optimize-operations';
import { onDemandTriggerOracleDriftAssessment } from './assessment-operations';
import { handleFsxBackupOptimizeJob } from '../resilience-awsBackup-optimize-operations';
import { handleCloneOptimizationForInstance } from './clone-optimization-operations';

const logger = getLogger();

const ORACLE_COMPUTE_HOST_OS_OPTIMIZE_NAMES = new Set<string>(Object.values(OptimizeOracleComputeHostOs));

interface FlattenedTask {
    databaseHostId: string;
    databaseInstanceId: string;
    credentialsId: string;
    region: string;
    optimizationSubcategory: string;
    clones?: OracleCloneActionType[];
}

function formatJobMetadata(hostsToOptimize: HostsToOptimizeType) {
    return hostsToOptimize.flatMap(({ configurationName, databaseHosts }) =>
        databaseHosts.map(host => {
            if ('oracleInstances' in host) {
                const cloneHost = host as CloneOptimizePerHostRequestBodyType;
                return {
                    resourceId: cloneHost.id,
                    databases: cloneHost.oracleInstances.map(i => i.instanceId),
                    optimizationType: configurationName
                };
            }
            const dbHost = host as BackupOptimizePerHostRequestBodyType;
            return {
                resourceId: dbHost.id,
                databases: dbHost.databases,
                optimizationType: configurationName
            };
        })
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

    if (optimizationType === OptimizeOracleTypes.COMPUTE_HOST_OS) {
        const invalid = hostsToOptimize.some(
            host => !ORACLE_COMPUTE_HOST_OS_OPTIMIZE_NAMES.has(host.configurationName)
        );
        if (invalid) {
            const errorMessage =
                'Invalid configurationName for compute-host-os. Allowed: transparent-hugepages, tcp-advanced-options, filesystems-io-options, multiblock-readcount.';
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }
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

function flattenHostsToTasks(hostsToOptimize: HostsToOptimizeType): FlattenedTask[] {
    return hostsToOptimize.flatMap(({ configurationName: optimizationSubcategory, databaseHosts }) =>
        databaseHosts.flatMap(host => {
            if ('oracleInstances' in host) {
                const cloneHost = host as CloneOptimizePerHostRequestBodyType;
                return cloneHost.oracleInstances.map(({ instanceId, clones }) => ({
                    databaseHostId: cloneHost.id,
                    databaseInstanceId: instanceId,
                    credentialsId: cloneHost.credentialsId,
                    region: cloneHost.region,
                    optimizationSubcategory,
                    clones
                }));
            }
            const dbHost = host as BackupOptimizePerHostRequestBodyType;
            return dbHost.databases.map(databaseInstanceId => ({
                databaseHostId: dbHost.id,
                databaseInstanceId,
                credentialsId: dbHost.credentialsId,
                region: dbHost.region,
                optimizationSubcategory
            }));
        })
    );
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

    const flattenedTasks = flattenHostsToTasks(hostsToOptimize);

    let jobError = '';
    try {
        await Promise.all(
            flattenedTasks.map(
                throat(
                    3,
                    async ({
                        databaseHostId,
                        databaseInstanceId,
                        credentialsId,
                        region,
                        optimizationSubcategory,
                        clones
                    }) => {
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

                                case OptimizeOracleTypes.COMPUTE_HOST_OS: {
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

                                case OptimizeOracleTypes.CLONE: {
                                    await handleCloneOptimizationForInstance(
                                        accountId,
                                        credentialsId,
                                        region,
                                        databaseHostId,
                                        databaseInstanceId,
                                        clones || [],
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

    const groupedHosts = hostsToOptimize.reduce((acc, { databaseHosts }) => {
        databaseHosts
            .filter((host): host is BackupOptimizePerHostRequestBodyType => 'databases' in host)
            .forEach(({ credentialsId, region, ...rest }) => {
                const key = `${credentialsId}-${region}`;
                acc[key] ??= { credentialsId, region, databaseHosts: [] };
                acc[key].databaseHosts.push({ credentialsId, region, ...rest });
            });
        return acc;
    }, {} as Record<string, { credentialsId: string; region: string; databaseHosts: BackupOptimizePerHostRequestBodyType[] }>);

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
    const {
        jobId: awsBackupFixJobId,
        jobStatus,
        errors: errMsg
    } = await handleFsxBackupOptimizeJob(accountId, credentialsId, region, databaseHosts, masterOptimizeParentId, {
        hostsToOptimize: databaseHosts.map(({ id, databases }) => ({
            optimizationType: 'aws-backup',
            resourceId: id,
            databases
        }))
    });

    if (jobStatus === JOBSTATUS.COMPLETED) {
        // Schedule the post-remediation assessment as a sibling of awsBackupFixJobId under the
        // master bulk parent. We deliberately avoid triggerOracleAssessmentAfterOptimization here:
        // that helper polls and updates whichever job id it is given, which would (a) nest the
        // assessment under the fix job in the job tree, and (b) race with handleFsxBackupOptimizeJob's
        // own updateJobDetails call on the same fix job.
        await Promise.all(
            databaseHosts.flatMap(({ id: databaseHostId, databases }) =>
                databases.map(databaseInstanceId =>
                    onDemandTriggerOracleDriftAssessment(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        AssessmentTriggeredBy.SYSTEM,
                        AssessmentCategoriesOracle.AWS_BACKUP,
                        masterOptimizeParentId
                    )
                )
            )
        );

        logger.info('Completed Oracle AWS backup remediation and scheduled assessment', {
            accountId,
            credentialsId,
            region,
            awsBackupFixJobId,
            masterOptimizeParentId,
            jobStatus,
            assessmentTriggered: true
        });

        return;
    }

    logger.info('Skipping Oracle AWS backup post-remediation assessment', {
        accountId,
        credentialsId,
        region,
        awsBackupFixJobId,
        masterOptimizeParentId,
        jobStatus,
        errMsg,
        assessmentTriggered: false
    });
}

export { optimizeOracleDatabase };
