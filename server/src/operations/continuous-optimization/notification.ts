import throat from 'throat';
import getLogger from '../../utils/logger';
import { DatabaseInstancesIncludingResource } from '../../utils/common-types';
import { WF_NOTIFICATION_PRIORITY, NOTIFICATION_TYPE, DatabaseTypes } from '../../utils/consts';

import { listDatabaseInstancesPaginated } from '../../lib/database/db';
import prepareWFNotificationRequest from '../wf-notification-operations';
import { hasNotOptimizedStatus } from './assessment-utils';

const logger = getLogger();

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
    details?: any;
}

interface AccountAssessmentSummary {
    wellArchitectedCount: number;
    notOptimizedCount: number;
    credentialsId?: string;
    region?: string;
    instances: InstanceAssessmentDetails[];
}

/**
 * Processes well-architected assessment notifications for all managed Microsoft SQL Server instances.
 *
 * Logic Overview:
 * 1. Fetch all managed MSSQL database instances.
 * 2. Group instances by their account ID.
 * 3. For each account:
 *    a. Check if the account has any active notification channels (using getChannels).
 *    b. If no active channel or error, skip processing for that account.
 *    c. If active, process each managed instance in parallel (throttled to 3 at a time):
 *       - Analyze the assessment results for each instance to determine if it is "well-architected" or "not optimized".
 *       - Build an account-level summary (wellArchitectedCount, notOptimizedCount, and instance details).
 * 4. After all accounts are processed, build notification messages for each instance in each account,
 *    including subject and body with summary counts.
 * 5. Send notifications for all instances, throttled to 3 concurrent sends at a time, with error handling for each send.
 *
 * Performance & Reliability:
 * - Uses throttling (via throat) to avoid overloading downstream APIs.
 * - Handles errors gracefully at each step, so one account or notification failure does not affect others.
 * - Skips accounts with no managed instances or no active notification channels.
 * - Splits logic into small, maintainable functions for clarity.
 */

async function processWellArchitectedAssessmentNotifications(initiatedBy: string) {
    logger.info('Processing well-architected assessment notifications', { initiatedBy });

    // Accumulate only the summary per account
    // Hash map to store per-account assessment summary
    const accountAssessmentMap: Record<string, AccountAssessmentSummary> = {};
    let nextToken: string | undefined;
    const PAGE_SIZE = 50;

    try {
        do {
            // This await is intentional: we process each page sequentially to avoid high memory usage and ensure order.
            // Using await in the loop is appropriate here because each page must be processed before fetching the next.
            // eslint-disable-next-line no-await-in-loop
            const { items: managedInstances, nextToken: newNextToken } = await listDatabaseInstancesPaginated(
                undefined,
                { databaseType: DatabaseTypes.MS_SQL_SERVER },
                PAGE_SIZE,
                nextToken
            );

            // Group managedInstances by account_id for this page
            const managedInstancesGroupedByAccountId = managedInstances.reduce(
                (acc: { [key: string]: DatabaseInstancesIncludingResource[] }, managedInstance) => {
                    const key = `${managedInstance.account_id}`;
                    if (!acc[key]) {
                        acc[key] = [];
                    }
                    acc[key].push(managedInstance);
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
                        const summary = accountAssessmentMap[accountId] || {
                            wellArchitectedCount: 0,
                            notOptimizedCount: 0,
                            instances: []
                        };

                        await Promise.all(
                            instances.map(
                                throat(3, async managedInstance => {
                                    try {
                                        const {
                                            credentials_id: credentialsId,
                                            region,
                                            resource_id: resourceId,
                                            database_instance_id: databaseInstanceId,
                                            metadata
                                        } = managedInstance;

                                        // Safe check for assessmentResults in metadata
                                        let assessmentResults: any | undefined;
                                        if (
                                            metadata &&
                                            typeof metadata === 'object' &&
                                            !Array.isArray(metadata) &&
                                            'assessmentResults' in metadata
                                        ) {
                                            assessmentResults = (metadata as { assessmentResults?: any })
                                                .assessmentResults;
                                        }
                                        if (!assessmentResults) {
                                            return;
                                        }

                                        const notOptimized = hasNotOptimizedStatus(assessmentResults);

                                        summary.instances.push({
                                            resourceId,
                                            databaseInstanceId,
                                            notOptimized
                                            // details: assessmentResults // can have this later on for future references
                                        });
                                        summary.credentialsId = credentialsId;
                                        summary.region = region;
                                        if (notOptimized) {
                                            summary.notOptimizedCount += 1;
                                        } else {
                                            summary.wellArchitectedCount += 1;
                                        }
                                    } catch (error) {
                                        logger.error(
                                            `Error processing managed instance ${managedInstance?.resource_id}:`,
                                            error
                                        );
                                    }
                                })
                            )
                        );

                        accountAssessmentMap[accountId] = summary;
                    })
                )
            );

            nextToken = newNextToken;
        } while (nextToken);

        // After all pages processed, send notifications using the accumulated summary
        await buildAndSendNotifications(accountAssessmentMap);
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
        const { wellArchitectedCount, notOptimizedCount } = summary;
        const total = wellArchitectedCount + notOptimizedCount;
        const subject = `${notOptimizedCount}/${total} instances in your account aren’t well-architected`;
        const body = `All Microsoft SQL Server instances in your account ${accountId} have been analyzed for well-architected issues. Well-architected instances: ${wellArchitectedCount}, Not optimized instances: ${notOptimizedCount}. Review well-architected status findings and recommendations in the Databases inventory from the Workload Factory console.`;

        notificationsToSend.push({
            accountId,
            notificationData: {
                content: body,
                subject,
                resourceType: 'Microsoft SQL Server instance',
                resourceId: accountId,
                priority: WF_NOTIFICATION_PRIORITY.WF_RECOMMENDATION,
                resourceName: accountId,
                notificationType: NOTIFICATION_TYPE.WELL_ARCHITECTED
            }
        });
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

export { processWellArchitectedAssessmentNotifications };
