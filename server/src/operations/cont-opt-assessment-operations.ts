import { groupBy, isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import throat from 'throat';
import getLogger from '../utils/logger';
import { DatabaseInstancesIncludingResource } from '../utils/common-types';
import { ACCOUNT_ID, DatabaseTypes } from '../utils/consts';
import { setAsyncLocalStorageResource, getLocalStorage } from '../utils/async-local-storage';
import { IS_DEMO_FLOW, formatDuration, sleep } from '../utils/utils';
import { registerJob, updateParentJobStatus } from './database/job-operations';
import {
    AssessmentCategories,
    AssessmentCategoriesOracle,
    AssessmentTriggeredBy
} from '../utils/continous-optimization-consts';
import { getPaginatedDatabaseInstances } from './database/database-operations';
import {
    triggerMssqlAssessment,
    updateAssessmentResultsInInstanceMetadata
} from './continuous-optimization/mssql/assessment-operations';
import { INSTANCE_DEFAULT_SELECT_FIELDS } from '../utils/database-consts';
import { triggerOracleAssessment } from './continuous-optimization/oracle/assessment-operations';

const logger = getLogger();
interface AccountJobInfo {
    parentJobId: string;
    totalInstances: number;
    processedInstances: number;
}

async function createParentJobForAccount(accountId: string, initiatedBy: string): Promise<string | null> {
    try {
        // Keep simple description without dynamic updates
        const jobDescription = `Assess online database server instances in account ${accountId} for best practice misalignments.`;

        const { id: parentJobId } = await registerJob(accountId, '', '', {
            name: jobDescription,
            description: jobDescription,
            resourceName: accountId,
            initiator: initiatedBy.toLocaleUpperCase(),
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.ASSESSMENT
        });
        return parentJobId;
    } catch (error) {
        logger.error(`Error creating parent job for account ${accountId}:`, error);
        return null;
    }
}

async function updateAccountSummaryAndCreateJobs(
    instances: DatabaseInstancesIncludingResource[],
    accountJobsMap: Record<string, AccountJobInfo>,
    initiatedBy: string,
    batchNumber: number
) {
    // Group instances by account for this batch
    const batchAccountGroups = groupBy(instances, 'account_id') as Record<string, DatabaseInstancesIncludingResource[]>;

    const newAccounts: string[] = [];

    for (const [accountId, accountInstances] of Object.entries(batchAccountGroups)) {
        if (!accountJobsMap[accountId]) {
            // First time seeing this account - initialize and queue for job creation
            accountJobsMap[accountId] = {
                parentJobId: '',
                totalInstances: 0,
                processedInstances: 0
            };

            newAccounts.push(accountId);
        }

        // Update total count as we discover instances
        accountJobsMap[accountId].totalInstances += accountInstances.length;
    }

    // Create jobs for new accounts with controlled concurrency
    if (newAccounts.length > 0) {
        logger.info(`Creating jobs for ${newAccounts.length} new accounts in batch ${batchNumber}`);

        await Promise.all(
            newAccounts.map(
                throat(3, async accountId => {
                    try {
                        const parentJobId = await createParentJobForAccount(accountId, initiatedBy);
                        if (parentJobId) {
                            accountJobsMap[accountId].parentJobId = parentJobId;
                            logger.info(
                                `Created parent job ${parentJobId} for account ${accountId} in batch ${batchNumber}`
                            );
                        } else {
                            logger.warn(`No parent job ID returned for account ${accountId}`);
                        }
                    } catch (error) {
                        logger.error(`Failed to create parent job for account ${accountId}:`, error);
                    }
                })
            )
        );

        logger.info(`Completed job creation for ${newAccounts.length} accounts in batch ${batchNumber}`);
    }
}

async function finalizeParentJobs(accountJobsMap: Record<string, AccountJobInfo>) {
    logger.info('Finalizing parent jobs for all accounts');

    await Promise.all(
        Object.entries(accountJobsMap).map(
            throat(3, async ([accountId, { parentJobId, processedInstances, totalInstances }]) => {
                try {
                    if (parentJobId) {
                        await updateParentJobStatus(accountId, parentJobId);
                        logger.info(
                            `Finalized parent job for account ${accountId}: ${processedInstances}/${totalInstances} instances processed`
                        );
                    } else {
                        logger.warn(`No parent job ID found for account ${accountId}. Skipping finalization.`);
                    }
                } catch (error) {
                    logger.error(`Error finalizing parent job for account ${accountId}:`, error);
                }
            })
        )
    );
}

async function processAccountInstancesBatch(
    accountId: string,
    instances: DatabaseInstancesIncludingResource[],
    parentJobId: string,
    batchNumber: number
) {
    try {
        logger.info(`Processing ${instances.length} instances for account ${accountId} in batch ${batchNumber}`);

        // Instance-level assessments
        const instanceAssessmentWithErrors = await Promise.allSettled(
            instances.map(
                throat(3, async instance => {
                    const { database_instance_id: databaseInstanceId, database_type: databaseType } = instance;
                    switch (databaseType) {
                        case DatabaseTypes.MS_SQL_SERVER:
                            await triggerMssqlAssessment(instance, parentJobId, [
                                AssessmentCategories.STORAGE,
                                AssessmentCategories.AWS_BACKUP,
                                AssessmentCategories.CRR,
                                AssessmentCategories.CLONE,
                                AssessmentCategories.MAXDOP,
                                AssessmentCategories.HIGH_AVAILABILITY
                            ]);
                            break;
                        case DatabaseTypes.ORACLE:
                            await triggerOracleAssessment(
                                instance,
                                parentJobId,
                                [
                                    AssessmentCategoriesOracle.STORAGE,
                                    AssessmentCategoriesOracle.COMPUTE,
                                    AssessmentCategoriesOracle.AWS_BACKUP,
                                    AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH,
                                    AssessmentCategoriesOracle.CRR,
                                    AssessmentCategoriesOracle.CLONE
                                ],
                                false,
                                AssessmentTriggeredBy.SYSTEM,
                                { skipHostLevel: true }
                            );
                            break;
                        default:
                            logger.error(
                                `Unsupported database type ${databaseType} for instance ${databaseInstanceId}. Skipping assessment.`
                            );
                            break;
                    }
                })
            )
        );

        const allFailed = instanceAssessmentWithErrors.every(result => result.status === 'rejected');

        if (allFailed) {
            logger.warn(
                `All instances failed for account ${accountId} in batch ${batchNumber}. Skipping host-level assessments for this batch.`
            );
            return true; // Continue processing subsequent batches
        }

        // Get unique resources for this batch
        const uniqueResources = Array.from(
            new Map(
                instances.map(({ resource, ...details }) => [
                    `${resource.account_id}-${resource.credentials_id}-${resource.id}`,
                    { resource, details }
                ])
            ).values()
        );

        // Host-level assessments for unique resources
        await Promise.allSettled(
            uniqueResources.map(
                throat(3, ({ resource, details }) => {
                    const instance = { ...details, resource } as DatabaseInstancesIncludingResource;
                    switch (details.database_type) {
                        case DatabaseTypes.MS_SQL_SERVER:
                            return triggerMssqlAssessment(instance, parentJobId, [
                                AssessmentCategories.LICENSE,
                                AssessmentCategories.COMPUTE,
                                AssessmentCategories.HOST_OS_PATCH,
                                AssessmentCategories.RSS_CONFIG,
                                AssessmentCategories.MSSQL_PATCH,
                                AssessmentCategories.HIGH_AVAILABILITY, // Cluster-quorum and heartbeat-settings
                                AssessmentCategories.MTU_ALIGNMENT
                            ]);
                        case DatabaseTypes.ORACLE:
                            return triggerOracleAssessment(
                                instance,
                                parentJobId,
                                [AssessmentCategoriesOracle.HOST_OS_PATCH, AssessmentCategoriesOracle.COMPUTE],
                                false,
                                AssessmentTriggeredBy.SYSTEM,
                                { skipInstanceLevel: true }
                            );
                        default:
                            logger.warn('Skipping host-level assessment for unsupported database type', {
                                accountId,
                                resourceId: resource.id,
                                databaseType: details.database_type,
                                parentJobId
                            });
                            return Promise.resolve();
                    }
                })
            )
        );

        // UPDATE METADATA IMMEDIATELY after assessments complete
        logger.info(
            `Updating metadata for ${instances.length} instances in account ${accountId}, batch ${batchNumber}`
        );
        if (!IS_DEMO_FLOW) {
            await Promise.all(
                instances.map(throat(3, instance => updateAssessmentResultsInInstanceMetadata(instance)))
            );
        }
        logger.info(
            `Completed processing and metadata update for ${instances.length} instances in account ${accountId}, batch ${batchNumber}`
        );
        return true; // Continue processing subsequent batches
    } catch (error: any) {
        logger.error(`Error processing account ${accountId} batch ${batchNumber}:`, error);
        throw error;
    }
}

async function processCurrentBatch(
    instances: DatabaseInstancesIncludingResource[],
    accountJobsMap: Record<string, AccountJobInfo>,
    batchNumber: number
) {
    // Group by account for processing
    const batchAccountGroups = groupBy(instances, 'account_id') as Record<string, DatabaseInstancesIncludingResource[]>;

    // Process each account's instances in this batch
    await Promise.all(
        Object.entries(batchAccountGroups).map(
            throat(3, async ([accountId, accountInstances]) => {
                const accountJob = accountJobsMap[accountId];
                if (!accountJob || !accountJob.parentJobId) {
                    logger.error(`No parent job found for account ${accountId} in batch ${batchNumber}`);
                    return;
                }

                try {
                    await getLocalStorage().run(new Map(), async () => {
                        setAsyncLocalStorageResource(ACCOUNT_ID, accountId);
                        await processAccountInstancesBatch(
                            accountId,
                            accountInstances,
                            accountJob.parentJobId,
                            batchNumber
                        );
                    });

                    accountJob.processedInstances += accountInstances.length;
                    logger.info(
                        `Account ${accountId}: processed ${accountJob.processedInstances}/${accountJob.totalInstances} instances`
                    );
                } catch (error) {
                    logger.error(`Error processing instances for account ${accountId} in batch ${batchNumber}:`, error);
                }
            })
        )
    );
}

/**
 * Performs continuous optimization assessments for all managed Microsoft SQL Server instances across accounts.
 *
 * Logic Overview:
 * 1. Fetch managed MSSQL database instances in batches using pagination.
 *    - Each batch contains a subset of instances to avoid memory overload.
 *    - Pagination ensures scalability for large datasets.
 * 2. Group instances in each batch by their account ID.
 *    - This allows processing to be done at the account level.
 * 3. For each account:
 *    a. Create a parent job for the account during the first batch that contains instances for that account.
 *       - Ensures jobs are not created multiple times for the same account across batches.
 *    b. Process instance-level assessments for the batch:
 *       - Assess each instance for best practice misalignments using `triggerMssqlAssessment`.
 *       - If all instances fail in the batch:
 *         - Skip host-level assessments for the batch.
 *       - If some instances succeed, proceed to host-level assessments for unique resources.
 *    c. Update metadata for all instances in the batch after processing.
 * 4. After all batches are processed:
 *    - Finalize the parent job status for each account based on the results:
 *      - `COMPLETED` if all sub-jobs are processed successfully without failures.
 *      - `WARNING` if some sub-jobs fail or have warnings.
 *      - `FAILED` if all sub-jobs fail.
 *    - The parent job status is determined dynamically by `updateParentJobStatus`, which checks sub-job statuses.
 * 5. Log the total number of instances processed, total batches, and the duration of the assessment process.
 *
 * Performance & Reliability:
 * - Uses throttling (via throat) to limit concurrent operations and avoid overloading downstream APIs.
 * - Processes instances incrementally in batches to ensure scalability and efficient memory usage.
 * - Centralizes job status determination in `updateParentJobStatus`, eliminating the need for manual failure tracking.
 * - Handles errors gracefully at each step, ensuring one batch or account failure does not affect others.
 * - Skips unnecessary host-level assessments for batches where all instances fail, optimizing processing time.
 */
async function cronAssessmentCollection(initiatedBy: string) {
    logger.info('Cron assessment collection started', { initiatedBy });

    const accountJobsMap: Record<string, AccountJobInfo> = {};
    let nextToken: string | undefined;
    let batchNumber = 1;
    let totalProcessed = 0;
    const PAGE_SIZE = 100;
    const startTime = Date.now();

    try {
        do {
            logger.info(`Processing batch ${batchNumber}`, { nextToken });

            try {
                // This await is intentional: we process each page sequentially to avoid high memory usage and ensure order.
                // Using await in the loop is appropriate here because each page must be processed before fetching the next.
                // eslint-disable-next-line no-await-in-loop
                const response = await getPaginatedDatabaseInstances(undefined, {
                    databaseType: [DatabaseTypes.MS_SQL_SERVER, DatabaseTypes.ORACLE],
                    shouldIncludeResource: true,
                    additionalResourceFields: ['assessment_data', 'configurations'],
                    pageSize: PAGE_SIZE,
                    nextToken,
                    selectKeys: INSTANCE_DEFAULT_SELECT_FIELDS
                });

                const { items: batchManagedInstances, nextToken: newNextToken } = response as {
                    items: DatabaseInstancesIncludingResource[];
                    nextToken?: string;
                    totalCount: number;
                };

                if (isEmpty(batchManagedInstances)) {
                    logger.info('No more managed instances found. Processing completed.');
                    break;
                }

                logger.info(`Processing ${batchManagedInstances.length} instances in batch ${batchNumber}`);

                // Step 1: Update account summary and create jobs as needed
                // eslint-disable-next-line no-await-in-loop
                await updateAccountSummaryAndCreateJobs(
                    batchManagedInstances,
                    accountJobsMap,
                    initiatedBy,
                    batchNumber
                );

                // Step 2: Process assessments AND update metadata for this batch
                // eslint-disable-next-line no-await-in-loop
                await processCurrentBatch(batchManagedInstances, accountJobsMap, batchNumber);

                totalProcessed += batchManagedInstances.length;
                nextToken = newNextToken;
                batchNumber += 1;

                // Optional delay between batches
                if (nextToken) {
                    // eslint-disable-next-line no-await-in-loop
                    await sleep(1000);
                }
            } catch (error: any) {
                logger.error(`Error processing batch ${batchNumber}:`, error);
                nextToken = undefined; // Exit loop on error
            }
        } while (nextToken);

        const duration = Date.now() - startTime;
        logger.info(
            `Cron assessment collection completed successfully. Total instances processed: ${totalProcessed}, Total batches: ${
                batchNumber - 1
            }, Duration: ${formatDuration(duration)}`
        );
    } catch (error: any) {
        logger.error('Fatal error in cron assessment collection:', error);
        throw error;
    } finally {
        // Step 3: Finalize parent job statuses
        await finalizeParentJobs(accountJobsMap);
    }
}

export { cronAssessmentCollection, processAccountInstancesBatch };
