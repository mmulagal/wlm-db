import config from 'config';
import throat from 'throat';
import ms from 'ms';
import { STORAGE_TYPE, database_instances as DatabaseInstances, resource as Resource } from '@prisma/client';
import { compact, isEmpty } from 'lodash-es';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { deleteOlderJobs } from '../lib/database/job';
import {
    ACCOUNT_ID,
    CONTINUOUS_ASSESSMENT_FEATURE,
    FAIL_LONGRUNNING_DEPLOYMENT_JOB_INTERVAL,
    FAIL_LONGRUNNING_RESOURCE_PREPARE_JOB_INTERVAL,
    INSTANCE_PERFORMANCE_ASSESSMENT_QUEUE,
    TCO_FEATURE,
    WELL_ARCHITECTED_ASSESSMENT_NOTIFICATION_CRON_PATTERN,
    WELL_ARCHITECTED_ASSESSMENT_NOTIFICATION_QUEUE
} from '../utils/consts';
import getLogger from '../utils/logger';
import { updateLongRunningJobs, updateLongRunningResourcePrepareJobs } from './database/job-operations';

import {
    deleteOlderDeployments,
    deleteResource,
    listTrackedEc2,
    removeTrackedEc2Record,
    updateTrackedEc2Record
} from '../lib/database/db';
import { getHostAndSqlServerInfo } from './discover-operations';
import {
    manageInstanceRecommendationPreReqs,
    manageInstanceRecommendationPreReqsForManagedInstances
} from './aws/compute-optimizer-operations';
import { getEc2Arn, getRedisConnection, isDemo, sleep } from '../utils/utils';
import { getAoagPartnerNodesDetails } from './storage-savings-operations';
import {
    checkComputeOptimizerEnrollmentStatus,
    fetchSqlServerInstanceConfiguration
} from './recommendation-operations';
import { getLocalStorage, setAsyncLocalStorageResource } from '../utils/async-local-storage';
import {
    processWellArchitectedAssessmentNotifications,
    triggerDriftAssessmentDataCollection
} from './cont-opt-assessment-operations';
import { Metadata } from '../utils/common-types';
import { DRIFT_ASSESSMENT_QUEUE, AssessmentTriggeredBy } from '../utils/continous-optimization-consts';
import { purgeOlderAssessmentRecords } from './database/instance-config-operations';
import { listAllManagedInstances } from './database/database-operations';
import { triggerInstancePerformanceAssessment } from './database-hosts-operations';

const logger = getLogger();

const isDemoFlow = isDemo();

type CronJobOptions = {
    queueName: string;
    jobName: string;
    cronPattern: string;
    logIntervalConfigKey: string;
    workerProcessor: (job?: any) => Promise<void>;
    onJobErrorMessage: string;
};

async function failLongRunningDeploymentJobs() {
    logger.info('Marking long running (> 4 hours) deployment jobs as failed');

    setInterval(async () => updateLongRunningJobs(), Number(ms(FAIL_LONGRUNNING_DEPLOYMENT_JOB_INTERVAL)));
}

async function failLongRunningResourcePrepareJobs() {
    logger.info('Marking long running (> 1 hour) resource prepare jobs as failed');
    setInterval(
        async () => updateLongRunningResourcePrepareJobs(),
        Number(ms(FAIL_LONGRUNNING_RESOURCE_PREPARE_JOB_INTERVAL))
    );
}

function purgeOlderJobs() {
    logger.info('Purging older jobs');

    const purgeInterval = ms(config.get('db.jobs.purge.interval'));
    const purgeAfter = ms(config.get('db.jobs.purge.older-than'));

    setInterval(async () => deleteOlderJobs(Date.now() - Number(purgeAfter)), Number(purgeInterval));
}

// Scheduled task to update and manage EC2 instance recommendation preferences based on recent usage, and remove entries for instances no longer available in AWS."
function updateTcoInstanceRecommendationPreferences() {
    setInterval(async () => {
        await updateTcoInstRecPrefs();
    }, Number(ms(config.get('db.tco.update-recommendation-preference'))));
}

async function updateTcoInstRecPrefs() {
    getLocalStorage().run(new Map(getLocalStorage().getStore()), async () => {
        logger.info('Updating instance recommendation preferences for TCO feature');
        const trackedEc2Instances = await listTrackedEc2(TCO_FEATURE);
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
                            await updateTrackedEc2Record(accountId, region, credentialsId, instanceId, TCO_FEATURE, {
                                last_updated: new Date()
                            });
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
        logger.info('Updating instance recommendation preferences completed');
    });
}

function updateManagedInstanceRecommendationPreferences() {
    setInterval(async () => {
        await updateManagedInstRecPrefs();
    }, Number(ms(config.get('db.managed-instance.update-recommendation-preference'))));
}

interface DatabaseInstancesIncludingResource extends DatabaseInstances {
    resource: Resource;
}

async function updateManagedInstRecPrefs() {
    getLocalStorage().run(new Map(getLocalStorage().getStore()), async () => {
        logger.info('Updating instance recommendation preferences for Continuous optimization feature');

        const managedInstances = (await listAllManagedInstances()) as DatabaseInstancesIncludingResource[];
        if (isEmpty(managedInstances)) {
            logger.error(
                'No successfully managed database instances found during instance recommendation preference update.'
            );
            return;
        }
        const trackedEc2Instances = await listTrackedEc2(CONTINUOUS_ASSESSMENT_FEATURE);
        const trackedEc2InstanceIds = trackedEc2Instances.map(instance => instance.instance_id);

        // group managed instances by account_id, region, credentials_id, cloud_provider_account_id, and database_deployment_type so that we can manage a set of instances in bulk
        const grouped: { [key: string]: DatabaseInstancesIncludingResource[] } = managedInstances.reduce(
            (acc: { [key: string]: DatabaseInstancesIncludingResource[] }, managedInstance) => {
                const key = `${managedInstance.account_id}||${managedInstance.region}||${managedInstance.credentials_id}||${managedInstance.resource.cloud_provider_account_id}||${managedInstance.database_deployment_type}`;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(managedInstance);
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
        await purgeOlderAssessmentRecords();
    }, Number(ms(config.get('db.assessment.purge.interval'))));
}

function purgeOlderDeployments() {
    logger.info('Purging older deployments');
    const purgeAfter = ms(config.get('db.deployments.purge.older-than'));
    deleteOlderDeployments(Date.now() - Number(purgeAfter));
}

function scheduleCronJob({
    queueName,
    jobName,
    cronPattern,
    logIntervalConfigKey,
    workerProcessor,
    onJobErrorMessage
}: CronJobOptions) {
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

        logger.info(`${jobName} job added to queue with interval ${config.get(logIntervalConfigKey)}.`);

        getLocalStorage().run(new Map(getLocalStorage().getStore()), async () => {
            const worker = new Worker(
                queueName,
                async (job: any) => {
                    try {
                        await workerProcessor();
                    } catch (error) {
                        logger.error(onJobErrorMessage, job, error);
                    }
                },
                { connection: redisConnection }
            );

            worker.on('completed', job => {
                logger.debug(job.id, 'is completed.');
            });
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
        if (!isDemoFlow) {
            failLongRunningDeploymentJobs();
            failLongRunningResourcePrepareJobs();
            updateTcoInstanceRecommendationPreferences();
            updateManagedInstanceRecommendationPreferences();

            // Directly call the generic cron scheduler with params
            // scheduleAssessment
            scheduleCronJob({
                queueName: DRIFT_ASSESSMENT_QUEUE,
                jobName: 'CONTINUOUS_OPTIMIZATION_DRIFT_ASSESSMENT',
                cronPattern: '0 0 0 * * *', // Run every day at midnight
                logIntervalConfigKey: 'redis.well-architected-assessment-job-interval',
                workerProcessor: async () => {
                    await triggerDriftAssessmentDataCollection(AssessmentTriggeredBy.SYSTEM);
                },
                onJobErrorMessage: 'Error processing drift assessment job:'
            });
            // schedule instance resource assessment
            scheduleCronJob({
                queueName: INSTANCE_PERFORMANCE_ASSESSMENT_QUEUE,
                jobName: 'INSTANCE_PERFORMANCE_ASSESSMENT',
                cronPattern: '0 2,8,14,20 * * *', // Run every 6 hours starting at 2 AM
                logIntervalConfigKey: 'redis.performance-assessment-cron-job-interval',
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
                logIntervalConfigKey: 'redis.well-architected-assessment-notification-job-interval',
                workerProcessor: async () => {
                    await processWellArchitectedAssessmentNotifications(AssessmentTriggeredBy.SYSTEM);
                },
                onJobErrorMessage: 'Error processing well-architected assessment notification job:'
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
