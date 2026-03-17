/* eslint-disable no-await-in-loop */
import config from 'config';
import throat from 'throat';
import ms from 'ms';
import { STORAGE_TYPE, database_instances as DatabaseInstances, resource as Resource } from '@prisma/client';
import { compact } from 'lodash-es';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { deleteOlderJobs } from '../lib/database/job';
import {
    ACCOUNT_ID,
    CONTINUOUS_ASSESSMENT_FEATURE,
    DAILY_DRIFT_ASSESSMENT_TRIGGER_CRON_PATTERN,
    FAIL_LONGRUNNING_DEPLOYMENT_JOB_INTERVAL,
    FAIL_LONGRUNNING_RESOURCE_PREPARE_JOB_INTERVAL,
    INSTANCE_PERFORMANCE_ASSESSMENT_QUEUE,
    ORACLE_CPU_CATALOG_CRON_PATTERN,
    ORACLE_CPU_CATALOG_QUEUE,
    TCO_FEATURE,
    WELL_ARCHITECTED_ASSESSMENT_NOTIFICATION_CRON_PATTERN,
    WELL_ARCHITECTED_ASSESSMENT_NOTIFICATION_QUEUE
} from '../utils/consts';
import getLogger from '../utils/logger';
import { updateLongRunningJobs, updateLongRunningResourcePrepareJobs } from './database/job-operations';

import {
    deleteOlderDeployments,
    deleteResource,
    removeTrackedEc2Record,
    updateTrackedEc2Record,
    weeklyDemoDatabaseCleanup
} from '../lib/database/db';
import { getHostAndSqlServerInfo } from './discover-operations';
import {
    manageInstanceRecommendationPreReqs,
    manageInstanceRecommendationPreReqsForManagedInstances
} from './aws/compute-optimizer-operations';
import { getEc2Arn, getRedisConnection, sleep, IS_DEMO_FLOW } from '../utils/utils';
import { getAoagPartnerNodesDetails } from './storage-savings-operations';
import {
    checkComputeOptimizerEnrollmentStatus,
    fetchSqlServerInstanceConfiguration
} from './recommendation-operations';
import { getLocalStorage, setAsyncLocalStorageResource } from '../utils/async-local-storage';
import cronAssessmentCollection from './cont-opt-assessment-operations';
import { Metadata } from '../utils/common-types';
import { DRIFT_ASSESSMENT_QUEUE, AssessmentTriggeredBy } from '../utils/continous-optimization-consts';
import { triggerInstancePerformanceAssessment } from './database-hosts-operations';
import processWellArchitectedAssessmentNotifications from './continuous-optimization/notification';
import { refreshOracleCpuCatalog } from './continuous-optimization/oracle/cpu-catalog-operations';
import { deleteAllButLatestRecordPerConfigDataType } from '../lib/database/database-instance-config';
import { listAllManagedInstances, listTrackedEc2Operation } from './database/database-operations';

const logger = getLogger();

type CronJobOptions = {
    queueName: string;
    jobName: string;
    cronPattern: string;
    workerProcessor: (job?: any) => Promise<void>;
    onJobErrorMessage: string;
};

async function failLongRunningDeploymentJobs() {
    logger.info('Marking long running (> 4 hours) deployment jobs as failed');

    setInterval(async () => {
        try {
            await updateLongRunningJobs();
        } catch (error) {
            logger.error('Error in failLongRunningDeploymentJobs', error);
        }
    }, Number(ms(FAIL_LONGRUNNING_DEPLOYMENT_JOB_INTERVAL)));
}

async function failLongRunningResourcePrepareJobs() {
    logger.info('Marking long running (> 1 hour) resource prepare jobs as failed');
    setInterval(async () => {
        try {
            await updateLongRunningResourcePrepareJobs();
        } catch (error) {
            logger.error('Error in failLongRunningResourcePrepareJobs', error);
        }
    }, Number(ms(FAIL_LONGRUNNING_RESOURCE_PREPARE_JOB_INTERVAL)));
}

function purgeOlderJobs() {
    logger.info('Purging older jobs');

    const purgeInterval = ms(config.get('db.jobs.purge.interval'));
    const purgeAfter = ms(config.get('db.jobs.purge.older-than'));

    setInterval(async () => {
        try {
            await deleteOlderJobs(Date.now() - Number(purgeAfter));
        } catch (error) {
            logger.error('Error in purgeOlderJobs', error);
        }
    }, Number(purgeInterval));
}

// Scheduled task to update and manage EC2 instance recommendation preferences based on recent usage, and remove entries for instances no longer available in AWS."
function updateTcoInstanceRecommendationPreferences() {
    setInterval(async () => {
        try {
            await updateTcoInstRecPrefs();
        } catch (error) {
            logger.error('Error in updateTcoInstanceRecommendationPreferences', error);
        }
    }, Number(ms(config.get('db.tco.update-recommendation-preference'))));
}

async function updateTcoInstRecPrefs() {
    getLocalStorage().run(new Map(getLocalStorage().getStore()), async () => {
        logger.info('Updating instance recommendation preferences for TCO feature');
        const pageSize = 50;
        let nextToken;
        do {
            const { items: trackedEc2Instances, nextToken: newNextToken } = await listTrackedEc2Operation({
                feature: TCO_FEATURE,
                pageSize,
                ...(nextToken && { nextToken })
            });
            nextToken = newNextToken;
            await Promise.all(
                trackedEc2Instances.map(
                    throat(5, async instance => {
                        const {
                            cloud_provider_account_id: awsAccountId,
                            instance_id: instanceId,
                            account_id: accountId,
                            credentials_id: credentialsId,
                            region
                        } = instance;
                        setAsyncLocalStorageResource(ACCOUNT_ID, accountId);
                        try {
                            const {
                                items: [ec2HostDetails]
                            } = await getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [
                                instanceId
                            ]);
                            const resourceArn = getEc2Arn(awsAccountId, region, instanceId);

                            let { sqlServerInstances } = ec2HostDetails;
                            if (sqlServerInstances !== undefined) {
                                const { sqlServerDeploymentType, nodeIps } =
                                    fetchSqlServerInstanceConfiguration(sqlServerInstances) || {};
                                const instanceIds = [instanceId];
                                if (nodeIps && nodeIps.length > 0) {
                                    const { items: partnerNodeDetails } = await getAoagPartnerNodesDetails(
                                        accountId,
                                        credentialsId,
                                        region,
                                        instanceId,
                                        nodeIps
                                    );

                                    partnerNodeDetails?.forEach(partnerNode => {
                                        const { sqlServerInstances: partnerSqlServerInstances, ec2InstanceId } =
                                            partnerNode;
                                        if (partnerSqlServerInstances && partnerSqlServerInstances?.length > 0) {
                                            sqlServerInstances = sqlServerInstances?.concat(partnerSqlServerInstances);
                                        }
                                        instanceIds.push(ec2InstanceId);
                                    });
                                }
                                const ebsVolumeIds = compact(
                                    sqlServerInstances?.flatMap(server =>
                                        server?.storage
                                            ?.filter(storage => storage.type === STORAGE_TYPE.EBS)
                                            .map(storage => storage.id)
                                    )
                                );

                                await manageInstanceRecommendationPreReqs(
                                    awsAccountId,
                                    region,
                                    credentialsId,
                                    resourceArn,
                                    accountId,
                                    instanceIds,
                                    ebsVolumeIds,
                                    sqlServerDeploymentType!
                                );
                                await updateTrackedEc2Record(
                                    accountId,
                                    region,
                                    credentialsId,
                                    instanceId,
                                    TCO_FEATURE,
                                    {
                                        last_updated: new Date()
                                    }
                                );
                            }
                        } catch (error: any) {
                            if (error?.Code && error.Code === 'InvalidInstanceID.NotFound') {
                                await removeTrackedEc2Record(
                                    accountId,
                                    region,
                                    credentialsId,
                                    instance.instance_id,
                                    TCO_FEATURE
                                );
                            }
                            logger.error(
                                `Error while updating instance recommendation preferences for instance ${instanceId}: ${error}`
                            );
                        }
                    })
                )
            );
        } while (nextToken);
        logger.info('Updating instance recommendation preferences completed');
    });
}

function updateManagedInstanceRecommendationPreferences() {
    setInterval(async () => {
        try {
            await updateManagedInstRecPrefs();
        } catch (error) {
            logger.error('Error in updateManagedInstanceRecommendationPreferences', error);
        }
    }, Number(ms(config.get('db.managed-instance.update-recommendation-preference'))));
}

interface DatabaseInstancesIncludingResource extends DatabaseInstances {
    resource: Resource;
}

async function updateManagedInstRecPrefs() {
    getLocalStorage().run(new Map(getLocalStorage().getStore()), async () => {
        logger.info('Updating instance recommendation preferences for Continuous optimization feature');

        const { items: trackedEc2Instances } = await listTrackedEc2Operation({
            feature: CONTINUOUS_ASSESSMENT_FEATURE
        });
        const trackedEc2InstanceIds = trackedEc2Instances.map(instance => instance.instance_id);

        const pageSize = 50;
        let nextToken;
        do {
            const { items: managedInstances, nextToken: newNextToken } = await listAllManagedInstances(undefined, {
                selectKeys: ['account_id', 'region', 'credentials_id', 'database_deployment_type'],
                shouldIncludeResource: true,
                pageSize,
                ...(nextToken && { nextToken })
            });
            // group managed instances by account_id, region, credentials_id, cloud_provider_account_id, and database_deployment_type so that we can manage a set of instances in bulk
            const grouped: { [key: string]: DatabaseInstancesIncludingResource[] } = (managedInstances || []).reduce(
                (acc: { [key: string]: DatabaseInstancesIncludingResource[] }, managedInstance) => {
                    const instance = managedInstance as DatabaseInstancesIncludingResource;
                    const key = `${instance.account_id}||${instance.region}||${instance.credentials_id}||${instance.resource.cloud_provider_account_id}||${instance.database_deployment_type}`;
                    if (!acc[key]) {
                        acc[key] = [];
                    }
                    acc[key].push(instance);
                    return acc;
                },
                {} as { [key: string]: DatabaseInstancesIncludingResource[] }
            );

            await Promise.all(
                Object.entries(grouped).map(async ([key, instances]) => {
                    const [accountId, region, credentialsId, awsAccountId, deploymentType] = key.split('||');
                    setAsyncLocalStorageResource(ACCOUNT_ID, accountId);
                    const managedInstanceToBeUpdated = instances.filter((instance: { resource: Resource }) => {
                        const resourceInfo = instance?.resource;
                        const { node1InstanceId, node2InstanceId } = resourceInfo?.metadata as unknown as Metadata;
                        return (
                            !trackedEc2InstanceIds.includes(node1InstanceId) &&
                            !trackedEc2InstanceIds.includes(node2InstanceId!)
                        );
                    }); // update compute optimizer recommendation preferences only for managed instances that are not already being tracked, becuase the recommendation preference is static irrespsctive of the number of times it is updated
                    if (managedInstanceToBeUpdated.length === 0) {
                        logger.info('No new managed instances found to update instance recommendation preferences.');
                        return;
                    }

                    if (managedInstanceToBeUpdated.length > 0) {
                        let coOptedIn = false;
                        try {
                            await checkComputeOptimizerEnrollmentStatus(accountId, credentialsId, region);
                            coOptedIn = true;
                        } catch (error) {
                            logger.info(
                                `Failed fetching compute otimizer opt in status or Compute optimizer is not enabled for account ${awsAccountId} in region ${region}. Skipping updating instance recommendation preferences for managed instances.`
                            );
                        }
                        if (coOptedIn) {
                            managedInstanceToBeUpdated.forEach(async (instance: { resource: Resource }) => {
                                const { node1InstanceId, node2InstanceId } = instance?.resource
                                    ?.metadata as unknown as Metadata;

                                const instanceIds = [node1InstanceId];
                                if (node2InstanceId) {
                                    instanceIds.push(node2InstanceId);
                                }
                                try {
                                    await manageInstanceRecommendationPreReqsForManagedInstances(
                                        awsAccountId,
                                        region,
                                        credentialsId,
                                        instanceIds,
                                        accountId,
                                        deploymentType as string
                                    );
                                } catch (error: any) {
                                    if (error?.Code && error.Code === 'InvalidInstanceID.NotFound') {
                                        // TODO: This covers most of the scenarios. Only for accounts where compute optimizer is not opted in, we may not be able to delete the resource record from our DB. See the pattern after Jan 2025 release and accordingly introduce a new cron operation to delete the managed instances if required
                                        await deleteResource(accountId, instance?.resource?.resource_id, credentialsId);
                                    }
                                }
                            });
                        }
                    }
                })
            );
            nextToken = newNextToken;
        } while (nextToken);

        logger.info('Updating instance recommendation preferences for managed instances completed');
    });
}

async function logQueueMetrics(queue: Queue) {
    logger.info('Debug queue');
    const allJobsCount = await queue.getJobCounts();
    logger.info('allJobsCount', JSON.stringify(allJobsCount));
    const repeatableJobs = await queue.getJobSchedulers();
    logger.info('repeatableJobs', JSON.stringify(repeatableJobs));
}

async function purgeAssessmentData() {
    setInterval(async () => {
        try {
            await deleteAllButLatestRecordPerConfigDataType();
        } catch (error) {
            logger.error('Error in purgeAssessmentData', error);
        }
    }, Number(ms(config.get('db.assessment.purge.interval'))));
}

function purgeOlderDeployments() {
    logger.info('Purging older deployments');
    const purgeAfter = ms(config.get('db.deployments.purge.older-than'));
    deleteOlderDeployments(Date.now() - Number(purgeAfter));
}

function scheduleDemoCleanupWithTimeout() {
    const runCleanup = async () => {
        try {
            logger.info('Executing weekly demo database cleanup');
            await weeklyDemoDatabaseCleanup();
            logger.info('Demo cleanup completed successfully');
        } catch (error) {
            logger.error('Demo cleanup error:', error);
        }
    };

    const now = new Date();
    const nextSaturday = new Date();

    // Calculate next Saturday 4 AM GMT
    const daysUntilSaturday = (6 - now.getUTCDay() + 7) % 7 || 7;
    nextSaturday.setUTCDate(now.getUTCDate() + daysUntilSaturday);
    nextSaturday.setUTCHours(4, 0, 0, 0);

    // If it's already past Saturday 4 AM this week, schedule for next week
    if (nextSaturday <= now) {
        nextSaturday.setUTCDate(nextSaturday.getUTCDate() + 7);
    }

    const timeUntilNext = nextSaturday.getTime() - now.getTime();
    const hoursUntil = Math.round(timeUntilNext / (1000 * 60 * 60));

    logger.info(`Scheduling demo cleanup for ${nextSaturday.toISOString()} (in ${hoursUntil} hours), then weekly`);

    setTimeout(async () => {
        // Run the first cleanup
        await runCleanup();

        // Set up weekly interval starting from this point
        setInterval(async () => {
            await runCleanup();
        }, ms('1 week'));
    }, timeUntilNext);
}

function scheduleCronJob({ queueName, jobName, cronPattern, workerProcessor, onJobErrorMessage }: CronJobOptions) {
    let redisConnection: IORedis;
    try {
        redisConnection = getRedisConnection();
        const queue = new Queue(queueName, { connection: redisConnection });

        queue.on('error', error => {
            logger.error('Queue error:', error);
        });

        logQueueMetrics(queue);

        queue.upsertJobScheduler(
            jobName,
            { pattern: cronPattern },
            {
                name: jobName,
                opts: {
                    removeOnComplete: true,
                    removeOnFail: true
                }
            }
        );

        logQueueMetrics(queue);

        logger.info(`${jobName} job added to queue with interval.`);

        getLocalStorage().run(new Map(getLocalStorage().getStore()), async () => {
            const worker = new Worker(
                queueName,
                async (job: any) => {
                    try {
                        await workerProcessor();
                    } catch (error) {
                        logger.error(`job error ${jobName}`, { onJobErrorMessage, job, error });
                    }
                },
                { connection: redisConnection }
            );

            logger.info(`Worker for ${worker.name} started.`);

            // worker.on('completed', job => {
            //     logger.debug(job.name, 'is completed.');
            // });
        });
    } catch (error: any) {
        logger.error(`Error while processing ${jobName} cron job. ${error}.`);
    }
}

async function initiateCronOperations() {
    logger.info('Initializing cron jobs');
    try {
        await sleep(5 * 60 * 1000); // Wait for 5 minutes before starting the cron jobs to ensure all services are up and running
        purgeOlderJobs();
        purgeAssessmentData();
        if (IS_DEMO_FLOW) {
            scheduleDemoCleanupWithTimeout();
        }
        if (!IS_DEMO_FLOW) {
            failLongRunningDeploymentJobs();
            failLongRunningResourcePrepareJobs();
            updateTcoInstanceRecommendationPreferences();
            updateManagedInstanceRecommendationPreferences();

            // Directly call the generic cron scheduler with params
            // scheduleAssessment
            scheduleCronJob({
                queueName: DRIFT_ASSESSMENT_QUEUE,
                jobName: 'CONTINUOUS_OPTIMIZATION_DRIFT_ASSESSMENT',
                cronPattern: DAILY_DRIFT_ASSESSMENT_TRIGGER_CRON_PATTERN,
                workerProcessor: async () => {
                    await cronAssessmentCollection(AssessmentTriggeredBy.SYSTEM);
                },
                onJobErrorMessage: 'Error processing drift assessment job:'
            });
            // schedule instance resource assessment
            scheduleCronJob({
                queueName: INSTANCE_PERFORMANCE_ASSESSMENT_QUEUE,
                jobName: 'INSTANCE_PERFORMANCE_ASSESSMENT',
                cronPattern: '0 2,8,14,20 * * *', // Run every 6 hours starting at 2 AM
                workerProcessor: async () => {
                    await triggerInstancePerformanceAssessment(AssessmentTriggeredBy.SYSTEM);
                },
                onJobErrorMessage: 'Error triggering instance performance assessment'
            });
            // schedule well-architected assessment notification
            scheduleCronJob({
                queueName: WELL_ARCHITECTED_ASSESSMENT_NOTIFICATION_QUEUE,
                jobName: 'WELL_ARCHITECTED_ASSESSMENT_NOTIFICATION',
                cronPattern: WELL_ARCHITECTED_ASSESSMENT_NOTIFICATION_CRON_PATTERN, // Every 7 days at 5am for prod, Every 1 hour for staging
                workerProcessor: async () => {
                    await processWellArchitectedAssessmentNotifications(AssessmentTriggeredBy.SYSTEM);
                },
                onJobErrorMessage: 'Error processing well-architected assessment notification job:'
            });
            // schedule Oracle CPU catalog refresh
            scheduleCronJob({
                queueName: ORACLE_CPU_CATALOG_QUEUE,
                jobName: 'ORACLE_CPU_CATALOG_REFRESH',
                cronPattern: ORACLE_CPU_CATALOG_CRON_PATTERN,
                workerProcessor: async () => {
                    await refreshOracleCpuCatalog();
                },
                onJobErrorMessage: 'Error refreshing Oracle CPU catalog'
            });
            purgeOlderDeployments();
        }
    } catch (error) {
        logger.error('Failed to initialize cron jobs', error);
    }
    logger.info('Cron jobs initialized');
}

export {
    purgeOlderJobs,
    failLongRunningDeploymentJobs,
    failLongRunningResourcePrepareJobs,
    updateManagedInstanceRecommendationPreferences,
    updateTcoInstanceRecommendationPreferences,
    updateTcoInstRecPrefs,
    updateManagedInstRecPrefs,
    purgeAssessmentData,
    purgeOlderDeployments,
    initiateCronOperations
};
