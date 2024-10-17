import config from 'config';
import Promise from 'bluebird';
import ms from 'ms';
import { STORAGE_TYPE } from '@prisma/client';
import { compact, isEmpty } from 'lodash-es';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { deleteOlderJobs } from '../lib/database/job';
import {
    ACCOUNT_ID,
    AssessmentTriggeredBy,
    FAIL_LONGRUNNING_DEPLOYMENT_JOB_INTERVAL,
    FAIL_LONGRUNNING_RESOURCE_PREPARE_JOB_INTERVAL,
    TCO_FEATURE
} from '../utils/consts';
import getLogger from '../utils/logger';
import { updateLongRunningJobs, updateLongRunningResourcePrepareJobs } from './database/job-operations';

import {
    listAllManagedInstances,
    listTrackedEc2,
    removeTrackedEc2Record,
    updateTrackedEc2Record
} from '../lib/database/db';
import { getHostAndSqlServerInfo } from './discover-operations';
import { manageInstanceRecommendationPreReqs } from './aws/compute-optimizer-operations';
import { getEc2Arn, getRedisDetails } from '../utils/utils';
import { getAoagPartnerNodesDetails } from './storage-savings-operations';
import { fetchSqlServerInstanceConfiguration } from './recommendation-operations';
import { getLocalStorage, setAsyncLocalStorageResource } from '../utils/async-local-storage';
import { triggerDriftAssessment } from './drift-assessment';
import { DriftAssessmentJob } from '../utils/common-types';

const logger = getLogger();

const redisDetails = getRedisDetails();
const driftAssessmentQueue = new Queue('driftAssessmentQueue', { connection: new Redis(redisDetails.connection) });

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
function updateInstanceRecommendationPreferences() {
    setInterval(async () => {
        await updatePreferences();
    }, Number(ms(config.get('db.tco.update-recommendation-preference'))));
}

async function updatePreferences() {
    getLocalStorage().run(new Map(getLocalStorage().getStore()), async () => {
        logger.info('Updating instance recommendation preferences');
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

async function scheduledAssessment() {
    const managedInstances = await listAllManagedInstances();
    if (isEmpty(managedInstances)) {
        logger.error('No successfully managed database instances found.');
        return;
    }

    try {
        await Promise.all(
            managedInstances.map(async managedInstance => {
                const {
                    account_id: accountId,
                    credentials_id: credentialsId,
                    region,
                    resource_id: resourceId
                } = managedInstance;

                const managedInstanceIds = managedInstances.map(instance => instance.database_instance_id);

                driftAssessmentQueue.add(
                    'driftAssessment',
                    {
                        accountId,
                        credentialsId,
                        region,
                        resourceId,
                        managedInstanceIds
                    },
                    {
                        repeat: { every: 24 * 3600 * 1000 }, // 24 hours in milliseconds
                        removeOnComplete: true,
                        removeOnFail: true
                    }
                );

                await triggerDriftAssessment(
                    accountId,
                    credentialsId,
                    region,
                    resourceId,
                    managedInstanceIds,
                    AssessmentTriggeredBy.SYSTEM
                );

                const driftAssessmentWorker = new Worker(
                    'driftAssessmentQueue',
                    async (job: { data: DriftAssessmentJob }) => {
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
                        connection: redisDetails.connection
                    }
                );

                driftAssessmentWorker.on('completed', job => {
                    logger.debug(job.id, 'is completed.');
                });
            })
        );
    } catch (error) {
        logger.error(`Error while triggering scheduled assessment: ${error}.`);
    }
}

export {
    purgeOlderJobs,
    failLongRunningDeploymentJobs,
    failLongRunningResourcePrepareJobs,
    updateInstanceRecommendationPreferences,
    updatePreferences,
    scheduledAssessment
};
