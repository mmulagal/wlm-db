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

    await Promise.all(
        hostsToOptimize.map(async host => {
            host.databaseHosts = await validateAndFilterDatabaseHosts(accountId, host.databaseHosts);
        })
    );

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

    const flattenedHosts = hostsToOptimize.flatMap(({ configurationName: optimizationSubcategory, databaseHosts }) =>
        databaseHosts.map(databaseHost => ({
            ...databaseHost,
            optimizationSubcategory
        }))
    );

    try {
        await Promise.all(
            flattenedHosts.map(
                throat(3, async ({ id: databaseHostId, databases, credentialsId, region, optimizationSubcategory }) => {
                    if (isEmpty(databases)) {
                        logger.error(`No instances given for resource ${databaseHostId}.`);
                    }

                    await Promise.all(
                        databases.map(async databaseInstanceId => {
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

                                default: {
                                    const errMsg = `Unsupported optimization type: ${optimizationCategory}`;
                                    logger.error(errMsg);
                                    throw new Error(errMsg);
                                }
                            }
                        })
                    );
                })
            )
        );
    } catch (error: any) {
        logger.error(
            `Error occurred while optimizing for account ${accountId}, ${optimizationCategory}. Error: ${error}`
        );
        masterOptimizeParentStatus = JOBSTATUS.WARNING;
    } finally {
        if (masterOptimizeParentStatus === JOBSTATUS.COMPLETED) {
            await updateJobDetails(accountId, masterOptimizeParentId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now()
            });
        } else {
            await updateJobDetails(accountId, masterOptimizeParentId, {
                status: JOBSTATUS.WARNING,
                endTime: Date.now()
            });
        }
    }
}

export { optimizeOracleDatabase };
