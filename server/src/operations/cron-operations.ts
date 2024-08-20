import config from 'config';
import Promise from 'bluebird';
import ms from 'ms';
import { STORAGE_TYPE } from '@prisma/client';
import { compact } from 'lodash-es';
import { deleteOlderJobs } from '../lib/database/job';
import {
    FAIL_LONGRUNNING_DEPLOYMENT_JOB_INTERVAL,
    FAIL_LONGRUNNING_RESOURCE_PREPARE_JOB_INTERVAL,
    TCO_FEATURE
} from '../utils/consts';
import getLogger from '../utils/logger';
import { updateLongRunningJobs, updateLongRunningResourcePrepareJobs } from './database/job-operations';

import { listTrackedEc2, removeTrackedEc2Record, updateTrackedEc2Record } from '../lib/database/db';
import { getHostAndSqlServerInfo } from './discover-operations';
import { manageInstanceRecommendationPreReqs } from './aws/compute-optimizer-operations';
import { getEc2Arn } from '../utils/utils';
import { getAoagPartnerNodesDetails } from './storage-savings-operations';
import { fetchSqlServerInstanceConfiguration } from './recommendation-operations';

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
function updateInstanceRecommendationPreferences() {
    setInterval(async () => {
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
    }, Number(ms(config.get('db.tco.update-recommendation-preference'))));
}

export {
    purgeOlderJobs,
    failLongRunningDeploymentJobs,
    failLongRunningResourcePrepareJobs,
    updateInstanceRecommendationPreferences
};
