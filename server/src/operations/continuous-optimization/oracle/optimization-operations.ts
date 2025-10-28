import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import throat from 'throat';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import {
    HostsToOptimizeType,
    OptimizeRequestBodyType
} from '../../../routes/types/oracle-continuous-optimization.types';
import { OptimizeOracleTypes, OracleOptimizeJobDescriptions } from '../../../utils/continous-optimization-consts';
import getLogger from '../../../utils/logger';
import { oracleOptimizeStorageOS } from './storage-os-optimize-operations';
import { HttpErrorCodes } from '../../../utils/consts';
import { handleOptimizeJobCreation } from '../assessment-utils';
import { updateJobDetails } from '../../database/job-operations';
import { validateAndFilterDatabaseHosts } from '../../bulk-cont-opt-operations';
import { OracleJobMetadata } from './consts';

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
    const jobDescription = OracleOptimizeJobDescriptions[optimizationType];

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

    handleBulkOptimization(accountId, optimizationType, hostsToOptimize, masterJobId);

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

    let masterOptimizeParentStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

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

                                default:
                            }
                        } catch (error: any) {
                            logger.error(
                                `Error optimizing database ${databaseInstanceId} on host ${databaseHostId}: ${error.message}`
                            );
                            masterOptimizeParentStatus = JOBSTATUS.WARNING;
                        }
                    }
                )
            )
        );
    } catch (error: any) {
        logger.error(
            `Error occurred while optimizing for account ${accountId}, ${optimizationCategory}. Error: ${error}`
        );
        masterOptimizeParentStatus = JOBSTATUS.WARNING;
    } finally {
        await updateJobDetails(accountId, masterOptimizeParentId, {
            status:
                masterOptimizeParentStatus === JOBSTATUS.COMPLETED ? JOBSTATUS.COMPLETED : masterOptimizeParentStatus,
            endTime: Date.now()
        });
    }
}

export { optimizeOracleDatabase };
