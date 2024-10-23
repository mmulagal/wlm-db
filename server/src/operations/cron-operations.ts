import config from 'config';
import Promise from 'bluebird';
import ms from 'ms';
import { STORAGE_TYPE, database_instances as DatabaseInstances } from '@prisma/client';
import { compact, isEmpty } from 'lodash-es';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { deleteOlderJobs } from '../lib/database/job';
import {
    ACCOUNT_ID,
    FAIL_LONGRUNNING_DEPLOYMENT_JOB_INTERVAL,
    FAIL_LONGRUNNING_RESOURCE_PREPARE_JOB_INTERVAL,
    TCO_FEATURE
} from '../utils/consts';
import getLogger from '../utils/logger';
import { updateLongRunningJobs, updateLongRunningResourcePrepareJobs } from './database/job-operations';

import {
    listAllManagedInstances,
    listResources,
    listTrackedEc2,
    removeTrackedEc2Record,
    updateTrackedEc2Record
} from '../lib/database/db';
import { getHostAndSqlServerInfo } from './discover-operations';
import {
    manageInstanceRecommendationPreReqs,
    manageInstanceRecommendationPreReqsForManagedInstances
} from './aws/compute-optimizer-operations';
import { getEc2Arn, getRedisDetails } from '../utils/utils';
import { getAoagPartnerNodesDetails } from './storage-savings-operations';
import {
    checkComputeOptimizerEnrollmentStatus,
    fetchSqlServerInstanceConfiguration
} from './recommendation-operations';
import {
    getAsyncLocalStorageResource,
    getLocalStorage,
    setAsyncLocalStorageResource
} from '../utils/async-local-storage';
import { triggerDriftAssessment } from './drift-assessment';
import { DriftAssessmentJob, Metadata } from '../utils/common-types';
import { DRIFT_ASSESSMENT_QUEUE, AssessmentTriggeredBy } from '../utils/continous-optimization-consts';

const logger = getLogger();

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
        await Promise.map(
            trackedEc2Instances,
            async instance => {
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
                                const { sqlServerInstances: partnerSqlServerInstances, ec2InstanceId } = partnerNode;
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
            },
            { concurrency: 5 }
        );
        logger.info('Updating instance recommendation preferences completed');
    });
}

async function updateManagedInstanceRecommendationPreferences() {
    setInterval(async () => {
        await updateManagedInstRecPrefs();
    }, Number(ms(config.get('db.manged-instance.update-recommendation-preference'))));
}

async function updateManagedInstRecPrefs() {
    getLocalStorage().run(new Map(getLocalStorage().getStore()), async () => {
        logger.info('Updating instance recommendation preferences for Continuous assessment feature');

        const managedInstances = await listAllManagedInstances();
        if (isEmpty(managedInstances)) {
            logger.error(
                'No successfully managed database instances found during instance recommendation preference update.'
            );
            return;
        }
        const trackedEc2Instances = await listTrackedEc2(CONTINUOUS_ASSESSMENT_FEATURE);
        const trackedEc2InstanceIds = trackedEc2Instances.map(instance => instance.instance_id);

        // group managed instances by account_id, region, credentials_id, cloud_provider_account_id, and database_deployment_type so that we can manage a set of instances in bulk
        const grouped: { [key: string]: DatabaseInstances[] } = managedInstances.reduce(
            (acc: { [key: string]: DatabaseInstances[] }, managedInstance) => {
                const key = `${managedInstance.account_id}|${managedInstance.region}|${managedInstance.credentials_id}|${managedInstance.resource.cloud_provider_account_id}|${managedInstance.database_deployment_type}`;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(managedInstance);
                return acc;
            },
            {} as { [key: string]: DatabaseInstances[] }
        );

        await Promise.all(
            Object.entries(grouped).map(async ([key, instances]) => {
                const [accountId, region, credentialsId, awsAccountId, deploymentType] = key.split('|');
                setAsyncLocalStorageResource(ACCOUNT_ID, accountId);
                const managedInstanceToBeUpdated = instances.filter(
                    instance => !trackedEc2InstanceIds.includes(instance.database_instance_id)
                ); // update compute optimizer recommendation preferences only for managed instances that are not already being tracked, becuase the recommendation preference is static irrespsctive of the number of times it is updated
                if (managedInstanceToBeUpdated.length === 0) {
                    logger.info('No new managed instances found to update instance recommendation preferences.');
                    return;
                }

                if (managedInstanceToBeUpdated.length > 0) {
                    try {
                        await checkComputeOptimizerEnrollmentStatus(accountId, credentialsId, region);
                    } catch (error) {
                        logger.info(
                            `Failed fetching compute otimizer opt in status or Compute optimizer is not enabled for account ${awsAccountId} in region ${region}. Skipping updating instance recommendation preferences for managed instances.`
                        );
                        return;
                    }
                }
                managedInstanceToBeUpdated.forEach(async instance => {
                    const { node1InstanceId, node2InstanceId } = instance?.metadata as unknown as Metadata;

                    const instanceId = node1InstanceId || instance.database_instance_id;

                    const instanceIds = [instanceId];
                    if (node2InstanceId) {
                        instanceIds.push(node2InstanceId);
                    }
                    await manageInstanceRecommendationPreReqsForManagedInstances(
                        awsAccountId,
                        region,
                        credentialsId,
                        instanceIds,
                        accountId,
                        deploymentType as string
                    );
                });
            })
        );

        logger.info('Updating instance recommendation preferences for managed instances completed');
    });
}

async function scheduledAssessment() {
    const redisDetails = getRedisDetails();

    logger.info(`Redis host: ${redisDetails.host}`);
    logger.info(`Redis port: ${redisDetails.port}`);

    const managedResources = await listResources();
    if (isEmpty(managedResources)) {
        logger.error('No managed database resources found.');
        return;
    }
    const managedInstances = await listAllManagedInstances();
    if (isEmpty(managedInstances)) {
        logger.error('No successfully managed database instances found.');
        return;
    }

    let redisConnection;
    try {
        redisConnection = new IORedis(redisDetails.url, {
            maxRetriesPerRequest: null
        });

        redisConnection.on('error', error => {
            logger.error('Redis connection error:', error);
        });

        const driftAssessmentQueue = new Queue(DRIFT_ASSESSMENT_QUEUE, {
            connection: redisConnection
        });

        driftAssessmentQueue.on('error', error => {
            logger.error('Queue error:', error);
        });

        logger.info('Debug queue');
        const allJobsCount = await driftAssessmentQueue.getJobCounts();
        logger.info(JSON.stringify(allJobsCount));

        await Promise.all(
            managedResources.map(async managedResource => {
                const {
                    account_id: accountId,
                    credentials_id: credentialsId,
                    region,
                    resource_id: resourceId
                } = managedResource;

                const managedInstanceIds = managedInstances
                    .filter(instance => instance.resource_id === resourceId)
                    .map(instance => instance.database_instance_id);

                if (!isEmpty(managedInstanceIds)) {
                    logger.info(`Adding assessment cron for ${resourceId}, ${managedInstanceIds}.`);

                    try {
                        driftAssessmentQueue.add(
                            `driftAssessmentFor${resourceId}`,
                            {
                                accountId,
                                credentialsId,
                                region,
                                resourceId,
                                managedInstanceIds
                            },
                            {
                                // 2hours to observe
                                repeat: { every: 2 * 3600 * 1000 }, // 24 hours in milliseconds
                                removeOnComplete: true,
                                removeOnFail: true
                            }
                        );
                    } catch (error: any) {
                        logger.error(`Error while add job to the queue. Error: ${error}`);
                    }

                    logger.info(`Added assessment cron for ${resourceId}, ${managedInstanceIds}.`);
                } else {
                    logger.info(`No managed instances found for ${resourceId}.`);
                }
            })
        );
    } catch (error) {
        logger.error(`Error while adding cron assessment job ${error}`);
    }

    if (redisConnection) {
        getLocalStorage().run(new Map(getLocalStorage().getStore()), async () => {
            try {
                const driftAssessmentWorker = new Worker(
                    DRIFT_ASSESSMENT_QUEUE,
                    async (job: { data: DriftAssessmentJob }) => {
                        setAsyncLocalStorageResource(ACCOUNT_ID, job.data.accountId);
                        logger.info(`Account id ${getAsyncLocalStorageResource(ACCOUNT_ID)}`);
                        try {
                            await triggerDriftAssessment(
                                job.data.accountId,
                                job.data.credentialsId,
                                job.data.region,
                                job.data.resourceId,
                                job.data.managedInstanceIds,
                                AssessmentTriggeredBy.SYSTEM
                            );
                        } catch (error) {
                            logger.error('Error processing job:', job, error);
                        }
                    },
                    {
                        connection: redisConnection
                    }
                );

                driftAssessmentWorker.on('completed', job => {
                    logger.debug(job.id, 'is completed.');
                });
            } catch (error) {
                logger.error(`Error while triggering scheduled assessment: ${error}.`);
            }
        });
    }
}

export {
    purgeOlderJobs,
    failLongRunningDeploymentJobs,
    failLongRunningResourcePrepareJobs,
    updateManagedInstanceRecommendationPreferences,
    updateTcoInstanceRecommendationPreferences,
    updateTcoInstRecPrefs,
    updateManagedInstRecPrefs,
    scheduledAssessment
};
