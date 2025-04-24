import { isEmpty, isUndefined } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { listResources, updateResourceMetaData } from '../../lib/database/db';
import getLogger from '../../utils/logger';
import { Metadata, RssConfigAssesment } from '../../utils/common-types';
import { handleOptimizeJobCreation, JobMetadata } from './assessment-utils';
import {
    AssessmentCategories,
    AssessmentTriggeredBy,
    OPTIMIZATION_CATEGORIES
} from '../../utils/continous-optimization-consts';
import { getServerNameWithHostname, isDemo, retryWithDelay, sleep, sqlResponseParsing } from '../../utils/utils';
import { callSsmExecution, getSSMConnectionStatus } from '../aws/ssm-operations';
import { getActiveSqlNode } from '../workloads/mssql/mssql-operations';
import { OPTIMIZE_NETWORK_ADAPTERS } from '../workloads/mssql/continuous-optimization-scripts';
import { updateJobDetails } from '../database/job-operations';
import { getInstanceInfo } from '../database/database-operations';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import {
    checkRunningStatus,
    getClusterNodeInstanceIds,
    getRunningSqlServices,
    handleRollbackClusterOwnership,
    moveClusterGroupOwnership,
    transferClusterOwnershipToStandbyNode
} from './compute-optimize-operations';
import { waitForInstanceOk } from '../../lib/aws/ec2';
import { AuditStatus, SSM_COMMAND_CACHE_TYPE } from '../../utils/consts';
import { onDemandTriggerDriftAssessmentDataCollection } from '../cont-opt-assessment-operations';
import { resetCache } from '../../utils/cache';

const logger = getLogger();
async function optimizeNetworkAdapters(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceId: string,
    resourceName: string,
    networkAdapters: string[] = []
) {
    logger.info('optimizing network adapters config for database host', {
        databaseHostId,
        networkAdapters
    });
    let errMsg;
    try {
        const rawResponse = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [OPTIMIZE_NETWORK_ADAPTERS(networkAdapters)],
                instanceId,
                `Optimize network adapters for ${resourceName}`,
                accountId,
                false,
                '300'
            )
        );
        const { response, error: ssmError } = sqlResponseParsing(rawResponse) || {};
        if (response === 'FAILED' || !isEmpty(ssmError)) {
            const msg = `Failed to optimize network adapters: ${databaseHostId} account: ${accountId} region: ${region} credentialsId: ${credentialsId}`;
            logger.error(msg, ssmError);
            throw new Error(msg);
        }
        await waitForInstanceOk(credentialsId, region, instanceId);
        if (!isDemo()) {
            // Wait for 30 seconds to allow FCI setup to come online after ec2 is online
            await sleep(30000);
        }
    } catch (error) {
        errMsg = (error as Error).message;
        throw new Error(errMsg);
    }
}

async function handleOptimizeRssOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    networkAdapters: string[],
    parentJobId?: string | undefined,
    masterOptimizeJobParentId?: string | undefined
) {
    // create a parent job for network adapter optimization
    logger.info('optimizing RSS config for:', { databaseHostId, databaseInstanceId, credentialsId, region });
    let formattedInstanceName = '';
    let isAnySubjobFailed = false;

    let shouldRollbackClusterOwnership = false;
    let ownerNode: string = '';
    let errorMessage = '';
    const [{ metadata, resource_name: resourceName }] = await listResources(
        accountId,
        databaseHostId,
        credentialsId,
        region
    );
    if (isUndefined(resourceName) || isEmpty(metadata)) {
        const errMsg = `Resource not found for database host ${accountId}, ${databaseHostId}, ${credentialsId}, ${region}`;
        logger.error(errMsg);
        throw new Error(errMsg);
    }
    if (isEmpty(networkAdapters)) {
        const adapters =
            ((metadata as unknown as Metadata)?.assessment?.rssConfig as RssConfigAssesment)?.rssAdapters?.map(
                adapter => adapter?.adapterName
            ) || [];
        networkAdapters = adapters.length > 0 ? adapters : networkAdapters;
    }

    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
    const { activeNodeInstanceId = '' } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId
    );

    try {
        if (activeNodeInstanceId) {
            // single node cluster/standalone
            const runningSqlServerNames = await getRunningSqlServices(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId
            );
            const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
            formattedInstanceName = getServerNameWithHostname(resourceName!, instanceDetail?.database_instance_name);
            await updateLongRunningAuditGroup(undefined, undefined, formattedInstanceName);
            if (!parentJobId) {
                parentJobId = await handleOptimizeJobCreation(
                    accountId,
                    credentialsId,
                    region,
                    accountId,
                    JOBTYPE.OPTIMIZATION,
                    `Optimize network adapters for ${formattedInstanceName}`,
                    `Optimize network adapters for ${formattedInstanceName}`
                );
            }
            if (node2InstanceId) {
                const connectionStatus = await getSSMConnectionStatus(credentialsId, region, node2InstanceId);
                if (!connectionStatus) {
                    throw Error('SSM connection is not available for the selected instance');
                }
                const { clusterNodeInstanceIds } = await getClusterNodeInstanceIds(
                    accountId,
                    credentialsId,
                    region,
                    node2InstanceId
                );
                const nonPrimaryNodeInstanceIds = clusterNodeInstanceIds.filter(
                    nodeId => nodeId !== activeNodeInstanceId
                );
                let jobDescription = `Optimize network adapters of standby nodes for ${formattedInstanceName}`;
                const jobMetadata: JobMetadata = {
                    hostsToOptimize: [
                        {
                            optimizationType: OPTIMIZATION_CATEGORIES.RSS_CONFIG.toString(),
                            resourceId: databaseHostId,
                            sqlServerInstances: [databaseInstanceId]
                        }
                    ]
                };
                // Optimizing network adapters of standby nodes
                const jobId = await handleOptimizeJobCreation(
                    accountId,
                    credentialsId,
                    region,
                    resourceName!,
                    JOBTYPE.OPTIMIZATION,
                    jobDescription,
                    jobDescription,
                    parentJobId,
                    jobMetadata
                );
                try {
                    // Currently, assessment runs on active node only. So network adapters from standby node aren't available to UI
                    // Hence, we are optimizing all network adapters no the standby node instances
                    await Promise.all(
                        nonPrimaryNodeInstanceIds.map(async instanceId => {
                            await optimizeNetworkAdapters(
                                accountId,
                                credentialsId,
                                region,
                                databaseHostId,
                                instanceId,
                                resourceName!
                            );
                        })
                    );
                    await updateJobDetails(accountId, jobId, {
                        status: JOBSTATUS.COMPLETED,
                        endTime: Date.now()
                    });
                } catch (error) {
                    isAnySubjobFailed = true;
                    await updateJobDetails(accountId, jobId, {
                        status: JOBSTATUS.FAILED,
                        endTime: Date.now(),
                        error: (error as Error).message
                    });
                    throw new Error((error as Error).message);
                }

                // Transfer ownership to some secondary node
                jobDescription = 'Transfer cluster node ownership from primary to another node in the cluster';
                const transferOwnershipJobId = await handleOptimizeJobCreation(
                    accountId,
                    credentialsId,
                    region,
                    formattedInstanceName,
                    JOBTYPE.OPTIMIZATION,
                    jobDescription,
                    jobDescription,
                    parentJobId
                );

                try {
                    ({ ownerNode } = await transferClusterOwnershipToStandbyNode(
                        accountId,
                        credentialsId,
                        region,
                        activeNodeInstanceId
                    ));

                    if (!ownerNode) {
                        throw new Error('Failed to transfer cluster ownership');
                    }

                    await updateJobDetails(accountId, transferOwnershipJobId, {
                        status: JOBSTATUS.COMPLETED,
                        endTime: Date.now()
                    });
                    shouldRollbackClusterOwnership = true;
                } catch (error) {
                    const errMsg = `Failed to transfer sql node ownership in the cluster, ${error}`;
                    await updateJobDetails(accountId, transferOwnershipJobId, {
                        status: JOBSTATUS.FAILED,
                        endTime: Date.now(),
                        error: errMsg
                    });
                    isAnySubjobFailed = true;
                    throw new Error(errMsg);
                }
            }
            // Optimizing network adapters of primary nodes
            let jobDescription = `Optimize network adapters of primary node for ${formattedInstanceName}`;
            const jobMetadata: JobMetadata = {
                hostsToOptimize: [
                    {
                        optimizationType: OPTIMIZATION_CATEGORIES.RSS_CONFIG.toString(),
                        resourceId: databaseHostId,
                        sqlServerInstances: [databaseInstanceId]
                    }
                ]
            };
            const jobId = await handleOptimizeJobCreation(
                accountId,
                credentialsId,
                region,
                resourceName!,
                JOBTYPE.OPTIMIZATION,
                jobDescription,
                jobDescription,
                parentJobId,
                jobMetadata
            );

            try {
                await optimizeNetworkAdapters(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    activeNodeInstanceId,
                    resourceName!,
                    networkAdapters
                );

                await updateJobDetails(accountId, jobId, {
                    status: JOBSTATUS.COMPLETED,
                    endTime: Date.now()
                });
            } catch (error) {
                isAnySubjobFailed = true;
                await updateJobDetails(accountId, jobId, {
                    status: JOBSTATUS.FAILED,
                    endTime: Date.now(),
                    error: (error as Error).message
                });
                throw error;
            }
            if (shouldRollbackClusterOwnership) {
                // Transfer cluster ownership back to primary node instance
                jobDescription = 'Transfer cluster node ownership from primary to another node in the cluster';
                const transferOwnershipJobId = await handleOptimizeJobCreation(
                    accountId,
                    credentialsId,
                    region,
                    formattedInstanceName,
                    JOBTYPE.OPTIMIZATION,
                    jobDescription,
                    jobDescription,
                    parentJobId
                );
                try {
                    await moveClusterGroupOwnership(credentialsId, region, ownerNode!, activeNodeInstanceId);
                    await updateJobDetails(accountId, transferOwnershipJobId, {
                        status: JOBSTATUS.COMPLETED,
                        endTime: Date.now()
                    });
                    shouldRollbackClusterOwnership = false;
                } catch (error) {
                    const errMsg = `Failed to transfer sql node ownership in the cluster, ${error}`;
                    await updateJobDetails(accountId, transferOwnershipJobId, {
                        status: JOBSTATUS.FAILED,
                        endTime: Date.now(),
                        error: errMsg
                    });
                    isAnySubjobFailed = true;
                    throw error;
                }
            }

            if (isDemo()) {
                const resourceMeta = metadata as unknown as Metadata;
                let optimizedAdapters = resourceMeta?.isRssConfigOptimized;
                optimizedAdapters = isEmpty(optimizedAdapters)
                    ? networkAdapters
                    : optimizedAdapters?.concat(networkAdapters);
                resourceMeta.isRssConfigOptimized = optimizedAdapters;
                updateResourceMetaData(accountId, credentialsId, databaseHostId, resourceMeta);
            }
            const checkRunningResponse = await checkRunningStatus(
                accountId,
                jobId,
                region,
                credentialsId,
                activeNodeInstanceId,
                formattedInstanceName,
                runningSqlServerNames || []
            );

            if (checkRunningResponse.status !== JOBSTATUS.COMPLETED) {
                isAnySubjobFailed = true;
                throw Error(checkRunningResponse.error);
            }
            // Wait for 3 minutes
            await sleep(3 * 60 * 1000);
            // clearning all the ssm command cache so that we will get the fresh data in assessment
            resetCache(SSM_COMMAND_CACHE_TYPE);
            // Trigger assessment after optimize
            await onDemandTriggerDriftAssessmentDataCollection(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                AssessmentTriggeredBy.SYSTEM,
                AssessmentCategories.RSS_CONFIG,
                masterOptimizeJobParentId
            );
        }
    } catch (error) {
        errorMessage = (error as Error).message;
        logger.error(errorMessage);
        if (shouldRollbackClusterOwnership) {
            // rollback cluster ownership transfer back to original node
            const rollbackJobId = await handleOptimizeJobCreation(
                accountId,
                credentialsId,
                region,
                formattedInstanceName,
                JOBTYPE.OPTIMIZATION,
                'Rollback cluster ownership transfer to primary node',
                'Rollback cluster ownership transfer to primary node'
            );
            await handleRollbackClusterOwnership(
                accountId,
                credentialsId,
                region,
                formattedInstanceName,
                ownerNode,
                activeNodeInstanceId,
                rollbackJobId
            );
            await updateJobDetails(accountId, rollbackJobId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now()
            });
        }
        throw new Error(errorMessage);
    } finally {
        updateLongRunningAuditGroup(
            isAnySubjobFailed ? AuditStatus.FAILED : AuditStatus.SUCCESS,
            errorMessage,
            formattedInstanceName
        );
        if (parentJobId) {
            updateJobDetails(accountId, parentJobId, {
                status: isAnySubjobFailed ? JOBSTATUS.WARNING : JOBSTATUS.COMPLETED,
                endTime: Date.now(),
                error: errorMessage
            });
        }
    }
    return parentJobId;
}

export { handleOptimizeRssOptimization };
