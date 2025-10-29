import throat from 'throat';
import getLogger from '../../utils/logger';
import { DatabaseInstancesIncludingResource } from '../../utils/common-types';
import { WF_NOTIFICATION_PRIORITY, NOTIFICATION_TYPE, DatabaseTypes, WF_CONSOLE_ENDPOINT } from '../../utils/consts';

import prepareWFNotificationRequest from '../wf-notification-operations';
import { hasNotOptimizedStatus } from './assessment-utils';
import { formatDuration, sanitizeSnsSubject } from '../../utils/utils';
import { getPaginatedDatabaseInstances } from '../database/database-operations';
import { INSTANCE_DEFAULT_SELECT_FIELDS } from '../../utils/database-consts';

const logger = getLogger();

const DB_TYPE_DISPLAY: Record<string, string> = {
    [DatabaseTypes.MS_SQL_SERVER]: 'Microsoft SQL Server',
    [DatabaseTypes.ORACLE]: 'Oracle'
};

interface NotificationData {
    content: string;
    subject: string;
    resourceType: string;
    resourceId: string;
    priority: string;
    resourceName: string;
    notificationType: string;
}

interface InstanceAssessmentDetails {
    resourceId: string;
    databaseInstanceId: string;
    notOptimized: boolean;
    details?: unknown;
}

interface DatabaseTypeAssessmentSummary {
    wellArchitectedCount: number;
    notOptimizedCount: number;
    instances: InstanceAssessmentDetails[];
    credentialsId?: string;
    region?: string;
}

interface AccountAssessmentSummary {
    // Per-database-type summaries; keys are raw DatabaseTypes enum values (MSSQL | ORACLE) or 'UNKNOWN' fallback
    databaseTypeSummaries: {
        [dbType: string]: DatabaseTypeAssessmentSummary;
    };
}

/**
 * Well‑architected assessment notification processor for Microsoft SQL Server and Oracle instances.
 *
 * End‑to‑End Flow:
 * 1. Pagination (sequential): Fetch pages (size 50) of MSSQL + Oracle database instances including persisted
 *    assessment_results. The outer do/while awaits each page before requesting the next to keep memory bounded.
 * 2. Per‑page grouping: Instances in the page are grouped by account_id.
 * 3. Per‑account processing (throttled 3 concurrent accounts): For each account, instances are iterated (also
 *    throttled 3 at a time). Each instance with assessment_results is evaluated via hasNotOptimizedStatus.
 * 4. Summary accumulation: Results are stored in accountAssessmentMap[accountId].databaseTypeSummaries[dbTypeKey]
 *    where dbTypeKey is the DatabaseTypes enum value (MSSQL | ORACLE) or 'UNKNOWN' fallback. For each db type we
 *    track wellArchitectedCount, notOptimizedCount, and a list of instance assessment details.
 * 5. Notification build: After all pages are processed, one notification per (account, db type) is generated if at
 *    least one assessed instance exists. MSSQL and Oracle are never combined in a single message.
 * 6. Notification send: Notifications are sent (or prepared) with concurrency limited to 3; individual failures are
 *    caught and logged without aborting the batch. (Dispatch helper currently commented out pending enablement.)
 *
 * Key Points:
 * - Two layers of throttling (accounts + instances) protect downstream services.
 * - Instances lacking assessment_results are skipped, avoiding empty/noise notifications.
 * - Backward compatibility fields remain on AccountAssessmentSummary but are unused in new logic.
 * - Adding another database type would require only updating the databaseType filter and display mapping.
 */

export default async function processWellArchitectedAssessmentNotifications(initiatedBy: string) {
    logger.info('Processing well-architected assessment notifications', { initiatedBy });

    // Accumulate only the summary per account
    // Hash map to store per-account assessment summary
    const accountAssessmentMap: Record<string, AccountAssessmentSummary> = {};
    let nextToken: string | undefined;
    const PAGE_SIZE = 50;
    const startTime = Date.now();

    try {
        do {
            // This await is intentional: we process each page sequentially to avoid high memory usage and ensure order.
            // Using await in the loop is appropriate here because each page must be processed before fetching the next.
            // eslint-disable-next-line no-await-in-loop
            const response = await getPaginatedDatabaseInstances(undefined, {
                databaseType: [DatabaseTypes.MS_SQL_SERVER, DatabaseTypes.ORACLE],
                shouldIncludeResource: true,
                additionalResourceFields: ['assessment_results'],
                pageSize: PAGE_SIZE,
                nextToken,
                selectKeys: [...INSTANCE_DEFAULT_SELECT_FIELDS, 'assessment_results']
            });
            const { items: managedInstances, nextToken: newNextToken } = response as {
                items: DatabaseInstancesIncludingResource[];
                nextToken?: string;
                totalCount: number;
            };

            // Group managedInstances by account_id for this page, skipping those without assessment_results
            const managedInstancesGroupedByAccountId = managedInstances.reduce(
                (acc: { [key: string]: DatabaseInstancesIncludingResource[] }, managedInstance) => {
                    if (!managedInstance.assessment_results) {
                        return acc; // skip unassessed instances
                    }
                    const key = `${managedInstance.account_id}`;
                    (acc[key] ||= []).push(managedInstance);
                    return acc;
                },
                {}
            );

            // Process each account in this page and accumulate summary
            // This await is intentional: we process each page sequentially to avoid high memory usage and ensure order.
            // Using await in the loop is appropriate here because each page must be processed before fetching the next.
            // eslint-disable-next-line no-await-in-loop
            await Promise.all(
                Object.entries(managedInstancesGroupedByAccountId).map(
                    throat(3, async ([accountId, instances]) => {
                        // Build or update summary for this account
                        const summary: AccountAssessmentSummary = accountAssessmentMap[accountId] || {
                            databaseTypeSummaries: {}
                        };

                        // Instances here all have assessment_results (filtered in reduce)
                        for (const managedInstance of instances) {
                            try {
                                const {
                                    credentials_id: credentialsId,
                                    region,
                                    resource_id: resourceId,
                                    database_instance_id: databaseInstanceId,
                                    assessment_results: assessmentResults,
                                    database_type: databaseType
                                } = managedInstance;

                                const notOptimized = hasNotOptimizedStatus(assessmentResults);

                                const dbTypeKey = databaseType || 'UNKNOWN';

                                const dbTypeSummary: DatabaseTypeAssessmentSummary = summary.databaseTypeSummaries[
                                    dbTypeKey
                                ] || {
                                    wellArchitectedCount: 0,
                                    notOptimizedCount: 0,
                                    instances: [],
                                    credentialsId,
                                    region
                                };

                                dbTypeSummary.instances.push({
                                    resourceId,
                                    databaseInstanceId,
                                    notOptimized
                                });
                                if (notOptimized) {
                                    dbTypeSummary.notOptimizedCount += 1;
                                } else {
                                    dbTypeSummary.wellArchitectedCount += 1;
                                }
                                dbTypeSummary.credentialsId = credentialsId;
                                dbTypeSummary.region = region;
                                summary.databaseTypeSummaries[dbTypeKey] = dbTypeSummary;
                            } catch (error) {
                                logger.error(
                                    `Error processing managed instance ${managedInstance?.resource_id}:`,
                                    error
                                );
                            }
                        }
                        accountAssessmentMap[accountId] = summary;
                    })
                )
            );
            nextToken = newNextToken;
        } while (nextToken);
        // After all pages processed, send notifications using the accumulated summary
        await buildAndSendNotifications(accountAssessmentMap);
        const duration = Date.now() - startTime;
        const totalAccounts = Object.keys(accountAssessmentMap).length;
        logger.info(
            `Well-architected assessment notifications processed successfully. Total accounts: ${totalAccounts}, Duration: ${formatDuration(
                duration
            )}`
        );
    } catch (error) {
        logger.error('Error processing well-architected assessment notifications:', error);
    }
}

// Helper to build notification data for all accounts and instances
function buildNotificationsToSend(
    accountAssessmentMap: Record<string, AccountAssessmentSummary>
): Array<{ accountId: string; notificationData: NotificationData }> {
    const notificationsToSend: Array<{ accountId: string; notificationData: NotificationData }> = [];
    for (const [accountId, summary] of Object.entries(accountAssessmentMap)) {
        const databaseTypeSummaries = summary.databaseTypeSummaries || {};

        for (const [dbTypeKey, dbTypeSummary] of Object.entries(databaseTypeSummaries)) {
            const { wellArchitectedCount, notOptimizedCount } = dbTypeSummary;
            const total = wellArchitectedCount + notOptimizedCount;
            if (total !== 0) {
                const isMssql = dbTypeKey === DatabaseTypes.MS_SQL_SERVER;
                const dbTypeDisplay = DB_TYPE_DISPLAY[dbTypeKey] || dbTypeKey;
                const subject = `${notOptimizedCount} out of ${total} ${dbTypeDisplay} instances in your account aren't well-architected`;
                const body =
                    `All ${dbTypeDisplay} instances in your account ${accountId} have been analyzed for well-architected issues.\n\n` +
                    `Well-architected instances: ${wellArchitectedCount}\n\n` +
                    `Not optimized instances: ${notOptimizedCount}\n\n` +
                    `Review well-architected status findings and recommendations in the Databases inventory from the Workload Factory console at ${WF_CONSOLE_ENDPOINT}`;
                notificationsToSend.push({
                    accountId,
                    notificationData: {
                        content: body,
                        subject: sanitizeSnsSubject(subject),
                        resourceType: isMssql
                            ? 'Microsoft SQL Server instance'
                            : dbTypeKey === DatabaseTypes.ORACLE
                            ? 'Oracle database'
                            : 'Database instance',
                        resourceId: accountId,
                        priority: WF_NOTIFICATION_PRIORITY.WF_RECOMMENDATION,
                        resourceName: accountId,
                        notificationType: NOTIFICATION_TYPE.WELL_ARCHITECTED
                    }
                });
            }
        }
    }

    return notificationsToSend;
}

async function buildAndSendNotifications(accountAssessmentMap: Record<string, AccountAssessmentSummary>) {
    const notificationsToSend = buildNotificationsToSend(accountAssessmentMap);

    await Promise.all(
        notificationsToSend.map(
            throat(3, async ({ accountId, notificationData }) => {
                try {
                    await prepareWFNotificationRequest(accountId, notificationData);
                } catch (error) {
                    logger.error(
                        `Failed to send notification for account ${accountId}, instance ${notificationData.resourceId}:`,
                        error
                    );
                }
            })
        )
    );
}
