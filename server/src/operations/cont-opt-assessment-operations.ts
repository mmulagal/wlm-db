import { DATABASE_TYPE, JOBSTATUS, JOBTYPE } from '@prisma/client';
import { groupBy, isEmpty } from 'lodash-es';
import throat from 'throat';

import { callWlmHostsGraphql, EC2_UNREGISTERED_ASSESSMENT_SCOPES_QUERY } from '../lib/cloud-manager/tagging-service';
import { setAsyncLocalStorageResource, getLocalStorage } from '../utils/async-local-storage';
import { DatabaseInstancesIncludingResource, Metadata, ResourceDetails } from '../utils/common-types';
import { ACCOUNT_ID, GOV_ACCOUNT, DatabaseTypes, RESOURCESTYPE, WINDOWS, isGovCloudRegion } from '../utils/consts';
import {
    AssessmentCategories,
    AssessmentCategoriesOracle,
    AssessmentTriggeredBy
} from '../utils/continous-optimization-consts';
import { INSTANCE_DEFAULT_SELECT_FIELDS } from '../utils/database-consts';
import getLogger from '../utils/logger';
import { IS_DEMO_FLOW, formatDuration, sleep } from '../utils/utils';

import { getFsxLinkReadinessByFsId } from './aws/fsx-operations';
import { canReadFleetManagerResource } from './aws/ssm-operations';
import { buildEc2FsxRelationship } from './cloud-manager/tagging-service-operations';
import {
    triggerMssqlAssessment,
    updateAssessmentResultsInInstanceMetadata
} from './continuous-optimization/mssql/assessment-operations';
import { triggerMssqlUnregisteredAssessment } from './continuous-optimization/mssql/offline-assessment-operations';
import { triggerOracleAssessment } from './continuous-optimization/oracle/assessment-operations';
import { triggerOracleUnregisteredAssessment } from './continuous-optimization/oracle/offline-assessment-operations';
import { getPaginatedDatabaseInstances, getResources } from './database/database-operations';
import { registerJob, updateParentJobStatus } from './database/job-operations';
import { getSqlServerInstancesFromRegistry } from './ssm-doc-operations';

const logger = getLogger();

interface AccountJobInfo {
    parentJobId: string;
    totalInstances: number;
    processedInstances: number;
}

async function createParentJobForAccount(
    accountId: string,
    initiatedBy: string,
    jobDescription = `Assess online database server instances in account ${accountId} for best practice misalignments.`
): Promise<string | null> {
    try {
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

function collectManagedEc2Ids(resources: ResourceDetails[]) {
    const ids = new Set<string>();
    for (const { resource_id: resourceId, metadata } of resources) {
        if (resourceId) {
            ids.add(resourceId);
        }
        const { node1InstanceId, node2InstanceId } = (metadata ?? {}) as Metadata;
        if (node1InstanceId) {
            ids.add(node1InstanceId);
        }
        if (node2InstanceId) {
            ids.add(node2InstanceId);
        }
    }
    return ids;
}

async function triggerUnregisteredAssessmentsForScope({
    accountId,
    credentialsId,
    region,
    topLevelJobId
}: {
    accountId: string;
    credentialsId: string;
    region: string;
    topLevelJobId: string;
}) {
    logger.info('Triggering unregistered assessments', { accountId, credentialsId, region });

    try {
        await getLocalStorage().run(new Map(), async () => {
            setAsyncLocalStorageResource(ACCOUNT_ID, accountId);
            setAsyncLocalStorageResource(GOV_ACCOUNT, isGovCloudRegion(region));

            const [{ ec2s }, { items: managedResources }] = await Promise.all([
                buildEc2FsxRelationship(accountId, credentialsId, region),
                getResources({
                    accountId,
                    credentialsId,
                    region,
                    resourceType: [RESOURCESTYPE.MSSQL, RESOURCESTYPE.ORACLE],
                    allRecords: true,
                    selectKeys: ['id', 'account_id', 'resource_id', 'credentials_id', 'region', 'metadata']
                })
            ]);

            if (!ec2s.length) {
                logger.info('No database server hosts found. Skipping unregistered assessments.', {
                    accountId,
                    credentialsId,
                    region
                });
                return;
            }

            const managedEc2Ids = collectManagedEc2Ids(managedResources);
            const unmanagedHosts = ec2s.filter(({ instanceId }) => !managedEc2Ids.has(instanceId));
            if (!unmanagedHosts.length) {
                logger.info('No unregistered hosts found. Skipping unregistered assessments.', {
                    accountId,
                    credentialsId,
                    region
                });
                return;
            }

            const fsxLinksByFsId = await getFsxLinkReadinessByFsId(
                credentialsId,
                region,
                unmanagedHosts.flatMap(({ fsxs }) => fsxs.map(({ fileSystemId }) => fileSystemId))
            );
            const hostsWithFsxLink = unmanagedHosts.filter(({ fsxs }) =>
                fsxs.some(({ fileSystemId }) => fsxLinksByFsId.get(fileSystemId)?.exists)
            );
            if (!hostsWithFsxLink.length) {
                logger.info('No unregistered hosts with an active FSx link. Skipping unregistered assessments.', {
                    accountId,
                    credentialsId,
                    region,
                    unmanagedHostCount: unmanagedHosts.length
                });
                return;
            }

            const canReadByInstanceId = new Map(
                await Promise.all(
                    hostsWithFsxLink.map(
                        throat(3, async ({ instanceId, operatingSystem }) => {
                            const platform = operatingSystem === WINDOWS ? ('windows' as const) : ('linux' as const);
                            return [
                                instanceId,
                                await canReadFleetManagerResource({
                                    credentialsId,
                                    region,
                                    instanceIds: [instanceId],
                                    platform,
                                    accountId
                                })
                            ] as const;
                        })
                    )
                )
            );
            const eligibleHosts = hostsWithFsxLink.filter(({ instanceId }) => canReadByInstanceId.get(instanceId));
            if (!eligibleHosts.length) {
                logger.info(
                    'No unregistered hosts with SSM document read permission. Skipping unregistered assessments.',
                    { accountId, credentialsId, region, fsxLinkedHostCount: hostsWithFsxLink.length }
                );
                return;
            }

            const mssqlInstanceIds = eligibleHosts
                .filter(({ workloadTypes }) => workloadTypes.includes(DATABASE_TYPE.mssql))
                .map(({ instanceId }) => instanceId);
            const sqlServerInstancesByEc2 = mssqlInstanceIds.length
                ? await getSqlServerInstancesFromRegistry(credentialsId, region, mssqlInstanceIds, accountId)
                : new Map<string, { sqlServerInstance: string }[]>();

            const assessments = eligibleHosts.flatMap(({ instanceId, workloadTypes }) => [
                ...(workloadTypes.includes(DATABASE_TYPE.mssql)
                    ? (sqlServerInstancesByEc2.get(instanceId) ?? []).map(({ sqlServerInstance }) => ({
                          instanceId,
                          databaseType: DATABASE_TYPE.mssql,
                          instanceName: sqlServerInstance
                      }))
                    : []),
                ...(workloadTypes.includes(DATABASE_TYPE.oracle)
                    ? [{ instanceId, databaseType: DATABASE_TYPE.oracle, instanceName: 'oracle' }]
                    : [])
            ]);

            if (!assessments.length) {
                logger.info('No unregistered assessments to trigger', { accountId, credentialsId, region });
                return;
            }

            await Promise.all(
                assessments.map(
                    throat(3, async ({ instanceId, databaseType, instanceName }) => {
                        try {
                            await (databaseType === DATABASE_TYPE.mssql
                                ? triggerMssqlUnregisteredAssessment
                                : triggerOracleUnregisteredAssessment)(
                                accountId,
                                credentialsId,
                                region,
                                instanceId,
                                instanceName,
                                topLevelJobId
                            );
                        } catch (error) {
                            logger.error('Failed to trigger unregistered assessment', {
                                accountId,
                                credentialsId,
                                region,
                                instanceId,
                                instanceName,
                                databaseType,
                                error
                            });
                        }
                    })
                )
            );
        });
    } catch (error) {
        logger.error('Error triggering unregistered assessments', { accountId, credentialsId, region, error });
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
                        const accountRegion = accountInstances[0]?.region;
                        setAsyncLocalStorageResource(
                            GOV_ACCOUNT,
                            accountRegion ? isGovCloudRegion(accountRegion) : false
                        );
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

        await cronAssessmentCollectionForUnregistered(initiatedBy);

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

async function cronAssessmentCollectionForUnregistered(initiatedBy: string) {
    logger.info('Cron unregistered assessment collection started', { initiatedBy });

    const startTime = Date.now();
    const parentJobByAccount: Record<string, string> = {};

    try {
        const { ec2Instances = [] } = await callWlmHostsGraphql<{
            ec2Instances?: {
                accountId?: string;
                credential?: string;
                region?: string;
                workloads?: unknown[];
            }[];
        }>('', '', '', EC2_UNREGISTERED_ASSESSMENT_SCOPES_QUERY, {
            first: 1000,
            workloadWhere: [
                {
                    field: 'workload',
                    op: 'IN',
                    value: ['Oracle Database', 'Microsoft SQL Server']
                }
            ]
        });

        const scopes = [
            ...new Map(
                ec2Instances.flatMap(({ accountId, credential: credentialsId, region, workloads }) =>
                    accountId && credentialsId && region && workloads?.length
                        ? [[`${accountId}||${credentialsId}||${region}`, { accountId, credentialsId, region }]]
                        : []
                )
            ).values()
        ];
        if (!scopes.length) {
            logger.warn(
                'Unable to find any Microsoft SQL Server or Oracle database server instances in any of your AWS accounts. Skipping unregistered assessments.'
            );
            return;
        }

        await Promise.all(
            Object.entries(groupBy(scopes, 'accountId')).map(
                throat(3, async ([accountId, accountScopes]) => {
                    const parentJobId = await createParentJobForAccount(
                        accountId,
                        initiatedBy,
                        `Assess unregistered database server instances in account ${accountId} for best practice misalignments.`
                    );
                    if (!parentJobId) {
                        logger.warn(`No parent job ID returned for unregistered assessments in account ${accountId}`);
                        return;
                    }

                    parentJobByAccount[accountId] = parentJobId;
                    await Promise.all(
                        accountScopes.map(scope =>
                            triggerUnregisteredAssessmentsForScope({
                                ...scope,
                                topLevelJobId: parentJobId
                            })
                        )
                    );
                })
            )
        );

        logger.info(
            `Cron unregistered assessment collection completed. Scopes: ${scopes.length}, Duration: ${formatDuration(
                Date.now() - startTime
            )}`
        );
    } catch (error) {
        logger.error('Fatal error in cron unregistered assessment collection:', error);
        throw error;
    } finally {
        await Promise.all(
            Object.entries(parentJobByAccount).map(
                throat(3, ([accountId, parentJobId]) => updateParentJobStatus(accountId, parentJobId))
            )
        );
    }
}

export {
    cronAssessmentCollection,
    cronAssessmentCollectionForUnregistered,
    processAccountInstancesBatch,
    triggerUnregisteredAssessmentsForScope
};
