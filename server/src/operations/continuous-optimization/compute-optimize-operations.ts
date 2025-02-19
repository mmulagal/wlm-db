import { JOBSTATUS, JOBTYPE, resource } from '@prisma/client';
import createError from 'http-errors';
import { cloneDeep, compact, isEmpty } from 'lodash-es';
import { DatabaseInstance, Metadata } from '../../utils/common-types';
import { AuditStatus } from '../../utils/consts';
import { callSsmExecution, getSSMConnectionStatus } from '../aws/ssm-operations';
import {
    CHECK_NODE_STATUS,
    CHECK_RUNNING_STATUS_WITH_RESTART,
    GET_CLUSTER_NODE_NAMES,
    MOVE_ALL_CLUSTER_GROUPS
} from '../workloads/mssql/continuous-optimization-scripts';
import { getActiveSqlNode } from '../workloads/mssql/mssql-operations';
import { updateJobDetails } from '../database/job-operations';
import { getServerNameWithHostname, isDemo, retryWithDelay, sqlResponseParsing } from '../../utils/utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';

import getLogger from '../../utils/logger';

import { getIscsiTargetAddresses } from '../aws/fsx-operations';

import { modifyInstanceType, startInstance, stopInstance, waitForInstanceOk } from '../../lib/aws/ec2';
import {
    getInstanceDetailsByPrivateIp,
    instanceTypeChangePreReqs,
    waitForInstanceToBeStopped
} from '../aws/ec2-operations';
import { listResources, updateResourceMetaData } from '../../lib/database/db';
import { CLUSTER_NETWORK_IP_INFO_PS1, FAILURE_INFO } from '../workloads/mssql/discover-consts';
import { calculateComputeDrift } from './compute-assessment-operations';
import { handleOptimizeJobCreation, JobMetadata } from './assessment-utils';
import { ENABLE_MPIO_AND_CONFIGURE } from '../workloads/mssql/mpio-remediation-scripts';
import { getInstanceInfo } from '../database/database-operations';
import { AssessmentStatus } from '../../utils/continous-optimization-consts';

const logger = getLogger();

async function handleComputeRemediation(
    credentialsId: string,
    region: string,
    accountId: string,
    instanceType: string,
    resourceDetails: resource[],
    jobId: string,
    databaseInstanceId: string
) {
    logger.info('Handling compute remediation', {
        credentialsId,
        region,
        accountId,
        instanceType,
        resourceDetails,
        jobId,
        databaseInstanceId
    });

    let jobStatus;
    let errorMessage = '';
    let subJobErrorMessage;

    let anySubJobFailed = false;
    let formattedInstanceName = getServerNameWithHostname(resourceDetails[0]?.resource_name || undefined);
    try {
        const [{ id: resourceId, resource_id: databaseHostId, metadata }] = resourceDetails;
        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
        const { activeNodeInstanceId, instanceName } = await getActiveSqlNode(
            credentialsId,
            region,
            node1InstanceId,
            node2InstanceId
        );

        if (activeNodeInstanceId) {
            const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
            formattedInstanceName = getServerNameWithHostname(
                resourceDetails[0]?.resource_name || undefined,
                instanceDetail?.database_instance_name
            );
            const { fsxn_ids: fsxId, fsx_svm_id: svmDetails } = instanceDetail as unknown as DatabaseInstance;
            const svmDetailsObject = svmDetails as Record<string, string>;
            const svmId = svmDetailsObject ? svmDetailsObject[fsxId] : '';

            const instanceIdsList = [activeNodeInstanceId];
            if (node2InstanceId) {
                // more than one node in the cluster
                const connectionStatus = await getSSMConnectionStatus(credentialsId, region!, node2InstanceId);
                if (!connectionStatus) {
                    throw createError(500, 'SSM connection is not available for the selected instance');
                }
                const clusterNetworkIpDetails = await callSsmExecution(
                    credentialsId,
                    region,
                    CLUSTER_NETWORK_IP_INFO_PS1,
                    node2InstanceId,
                    'Get cluster network IPs',
                    accountId,
                    undefined,
                    '300'
                );
                if (clusterNetworkIpDetails?.includes(FAILURE_INFO)) {
                    throw createError('Failed to get network interface details during compute optimization.');
                } else if (clusterNetworkIpDetails) {
                    const clusterNetworkIpDetailsJson: { clusterNetworkIps: string[] } =
                        JSON.parse(clusterNetworkIpDetails);
                    // get all nodes in a cluster
                    const { clusterNetworkIps } = clusterNetworkIpDetailsJson;
                    if (clusterNetworkIps.length > 1) {
                        const clusterNodeDetails = await getInstanceDetailsByPrivateIp(
                            credentialsId,
                            region,
                            clusterNetworkIps
                        );
                        const clusterNodeInstanceIds = compact(
                            clusterNodeDetails.map(({ ec2InstanceId }) => ec2InstanceId)
                        );

                        instanceIdsList.push(...clusterNodeInstanceIds);
                        await updateLongRunningAuditGroup(undefined, undefined, formattedInstanceName);

                        // run elastic IP address; spot instance and autoscaling instance check for all nodes in the cluster; throws error if any node has does not meets the criteria
                        const preReqJobId = await handleOptimizeJobCreation(
                            accountId,
                            credentialsId,
                            region,
                            formattedInstanceName,
                            JOBTYPE.OPTIMIZATION,
                            'Prerequisite check for compute optimization of secondary nodes.',
                            'Prerequisite check for compute optimization of secondary nodes.',
                            jobId
                        );
                        try {
                            await instanceTypeChangePreReqs(credentialsId, region, accountId, clusterNodeInstanceIds);
                            await updateJobDetails(accountId, preReqJobId, {
                                status: JOBSTATUS.COMPLETED,
                                endTime: Date.now()
                            });
                        } catch (error) {
                            subJobErrorMessage = `Failed to meet pre-requisites for compute optimization in SQL nodes, ${error}`;
                            await updateJobDetails(accountId, preReqJobId, {
                                status: JOBSTATUS.FAILED,
                                endTime: Date.now(),
                                error: subJobErrorMessage
                            });
                            anySubJobFailed = true;
                            throw error;
                        }

                        const nonPrimaryNodeInstanceIds = clusterNodeInstanceIds.filter(
                            nodeId => nodeId !== activeNodeInstanceId
                        );

                        const changeInstanceTypeJobId = await handleOptimizeJobCreation(
                            accountId,
                            credentialsId,
                            region,
                            formattedInstanceName,
                            JOBTYPE.OPTIMIZATION,
                            'Modify instance type for secondary nodes in the cluster',
                            `Modify instance type of SQL nodes ${nonPrimaryNodeInstanceIds.join(
                                ','
                            )} to ${instanceType}. To modify, instance will be stopped, modified and restarted.`,
                            jobId
                        );

                        try {
                            // modify instance type for all nodes in the cluster, (one node at a time to be on safer side) except the primary node
                            for (const nodeId of nonPrimaryNodeInstanceIds) {
                                await updateNodeInstanceType(
                                    accountId,
                                    credentialsId,
                                    region,
                                    nodeId,
                                    instanceType,
                                    fsxId,
                                    svmId,
                                    changeInstanceTypeJobId,
                                    formattedInstanceName
                                );
                            }
                            logger.info('Instance type updated for all secondary nodes in the cluster');

                            await updateJobDetails(accountId, changeInstanceTypeJobId, {
                                status: JOBSTATUS.COMPLETED,
                                endTime: Date.now()
                            });
                        } catch (error) {
                            subJobErrorMessage = `Failed to update instance type for secondary nodes in the cluster, ${error}`;
                            await updateJobDetails(accountId, changeInstanceTypeJobId, {
                                status: JOBSTATUS.FAILED,
                                endTime: Date.now(),
                                error: subJobErrorMessage
                            });
                            anySubJobFailed = true;
                            throw error;
                        }
                        const sqlNodeDetails = await callSsmExecution(
                            credentialsId,
                            region,
                            [GET_CLUSTER_NODE_NAMES()],
                            activeNodeInstanceId,
                            'Get all node names in the cluster',
                            accountId,
                            undefined,
                            '300'
                        );
                        const { ownerNode, clusterNodes } = sqlResponseParsing(sqlNodeDetails);
                        // pick one of the nodes in the cluster to transfer primary node ownership
                        let targetNodeName;
                        for (const nodeName of clusterNodes) {
                            const resp = await callSsmExecution(
                                credentialsId,
                                region,
                                [CHECK_NODE_STATUS(nodeName)],
                                activeNodeInstanceId,
                                'Checks if a cluster node is Up and reachable, returning the status as a JSON object.',
                                accountId
                            );
                            const { status } = sqlResponseParsing(resp);
                            if (status === 'success') {
                                targetNodeName = nodeName;
                                break;
                            }
                        }
                        const transferOwnershipJobId = await handleOptimizeJobCreation(
                            accountId,
                            credentialsId,
                            region,
                            formattedInstanceName,
                            JOBTYPE.OPTIMIZATION,
                            'Transfer cluster node ownership from primary to another node in the cluster',
                            `Transfer cluster node ownership from ${ownerNode} to ${targetNodeName} in the cluster. Cluster node ownership transfers to a healthy node in the cluster.`,
                            jobId
                        );
                        try {
                            // move all cluster groups to the selected node
                            if (targetNodeName) {
                                const nodesTransferred = await moveClusterGroupOwnership(
                                    credentialsId,
                                    region,
                                    targetNodeName,
                                    activeNodeInstanceId
                                );
                                logger.info('Primary node ownership transferred to', {
                                    targetNodeName,
                                    nodesTransferred
                                });
                            } else {
                                throw createError(500, 'Failed to find a node to transfer primary node ownership');
                            }
                            await updateJobDetails(accountId, transferOwnershipJobId, {
                                status: JOBSTATUS.COMPLETED,
                                endTime: Date.now()
                            });
                        } catch (error) {
                            subJobErrorMessage = `Failed to transfer sql node ownership in the cluster, ${error}`;
                            await updateJobDetails(accountId, changeInstanceTypeJobId, {
                                status: JOBSTATUS.FAILED,
                                endTime: Date.now(),
                                error: subJobErrorMessage
                            });
                            anySubJobFailed = true;
                            throw error;
                        }
                    }
                }
            } else {
                // single node cluster/standalone
                const preReqJobId = await handleOptimizeJobCreation(
                    accountId,
                    credentialsId,
                    region,
                    formattedInstanceName,
                    JOBTYPE.OPTIMIZATION,
                    'Prerequisite check for compute optimization in SQL node',
                    'Prerequisite check for compute optimization of SQL node.',
                    jobId
                );
                try {
                    await instanceTypeChangePreReqs(credentialsId, region, accountId, instanceIdsList);
                    await updateJobDetails(accountId, preReqJobId, {
                        status: JOBSTATUS.COMPLETED,
                        endTime: Date.now()
                    });
                } catch (error) {
                    subJobErrorMessage = `Failed to meet pre-requisites for compute optimization in primary node, ${error}`;
                    await updateJobDetails(accountId, preReqJobId, {
                        status: JOBSTATUS.FAILED,
                        endTime: Date.now(),
                        error: subJobErrorMessage
                    });
                    anySubJobFailed = true;
                    throw error;
                }
            }

            const updateInstanceTypeJobId = await handleOptimizeJobCreation(
                accountId,
                credentialsId,
                region,
                formattedInstanceName,
                JOBTYPE.OPTIMIZATION,
                'Modify instance type for primary node in the cluster',
                `Modify instance type of SQL node ${activeNodeInstanceId} to ${instanceType}.To modify, instance will be stopped,modified and restarted.`,
                jobId
            );
            try {
                await updateNodeInstanceType(
                    accountId,
                    credentialsId,
                    region,
                    activeNodeInstanceId,
                    instanceType,
                    fsxId,
                    svmId,
                    updateInstanceTypeJobId,
                    formattedInstanceName
                ); // modify instance type for the primary node ; secondary nodes if any are already modified at this point
                await updateJobDetails(accountId, updateInstanceTypeJobId, {
                    status: JOBSTATUS.COMPLETED,
                    endTime: Date.now()
                });
            } catch (error) {
                subJobErrorMessage = `Failed to update instance type for primary node in the cluster, ${error}`;
                await updateJobDetails(accountId, updateInstanceTypeJobId, {
                    status: JOBSTATUS.FAILED,
                    endTime: Date.now(),
                    error: subJobErrorMessage
                });
                anySubJobFailed = true;
                throw error;
            }

            // move all cluster groups to the primary node
            if (node2InstanceId) {
                const nodeTransferJobId = await handleOptimizeJobCreation(
                    accountId,
                    credentialsId,
                    region,
                    formattedInstanceName,
                    JOBTYPE.OPTIMIZATION,
                    'Transfer node ownership back to primary node in the cluster',
                    'Transfer node ownership back to primary node in the cluster',
                    jobId
                );
                try {
                    const ownershipTransferStatus = await moveClusterGroupOwnership(
                        credentialsId,
                        region,
                        instanceName,
                        activeNodeInstanceId
                    );
                    logger.info('Primary node ownership transferred to', { instanceName, ownershipTransferStatus });
                    await updateJobDetails(accountId, nodeTransferJobId, {
                        status: JOBSTATUS.COMPLETED,
                        endTime: Date.now()
                    });
                } catch (error) {
                    subJobErrorMessage = `Failed to transfer node ownership back to primary node in the cluster, ${error}`;
                    await updateJobDetails(accountId, nodeTransferJobId, {
                        status: JOBSTATUS.FAILED,
                        endTime: Date.now(),
                        error: subJobErrorMessage
                    });
                    anySubJobFailed = true;
                    throw error;
                }
            }

            // const checkRunningResponse = await checkRunningStatus(
            //     accountId,
            //     jobId,
            //     instanceName,
            //     region,
            //     credentialsId,
            //     activeNodeInstanceId,
            //     formattedInstanceName
            // );

            // if (!checkRunningResponse.running) {
            //     subJobErrorMessage = checkRunningResponse.error;
            //     anySubJobFailed = true;
            //     throw checkRunningResponse.error;
            // }

            // update metadata after successful optimization
            const existingAssessmentData = (metadata as unknown as Metadata).assessment;
            const { compute: { recommendationOptions = [] } = {} } = existingAssessmentData || {};
            (metadata as unknown as Metadata).assessment = {
                ...existingAssessmentData,
                compute: {
                    finding: AssessmentStatus.OPTIMIZED,
                    findingReasonCodes: [],
                    currentInstanceType: instanceType,
                    recommendationOptions
                },
                lastAssessedDate: new Date().getTime().toString()
            };
            await updateResourceMetaData(accountId, credentialsId, resourceId, metadata);
            jobStatus = JOBSTATUS.COMPLETED;
            if (isDemo()) {
                const updatedMetadata = cloneDeep(metadata) as unknown as Metadata;
                updatedMetadata.isComputeOptimized = true;
                await updateResourceMetaData(accountId, credentialsId, resourceId, updatedMetadata);
            }
            await updateLongRunningAuditGroup(AuditStatus.SUCCESS, undefined, formattedInstanceName);
            return;
        }

        jobStatus = JOBSTATUS.FAILED;
        errorMessage = 'No active node found in the cluster';
    } catch (error) {
        errorMessage = `Error while optimizing compute ${error}`;
        logger.error(errorMessage);

        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage, formattedInstanceName);
    } finally {
        const parentJobStatus = anySubJobFailed ? JOBSTATUS.FAILED : jobStatus || JOBSTATUS.COMPLETED;
        await updateJobDetails(accountId, jobId, {
            status: parentJobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
    }
}

async function checkRunningStatus(
    accountId: string,
    parentJobId: string,
    instanceName: string,
    region: string,
    credentialsId: string,
    activeNodeInstanceId: string,
    formattedInstanceName: string
) {
    logger.info('Checking running status', {
        accountId,
        credentialsId,
        region,
        instanceName,
        parentJobId,
        activeNodeInstanceId
    });

    const checkRunningJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        formattedInstanceName,
        JOBTYPE.ASSESSMENT,
        'Checking running status of the service',
        'Checking running status of the service',
        parentJobId
    );

    const rawStatusResponse = await callSsmExecution(
        credentialsId,
        region,
        [CHECK_RUNNING_STATUS_WITH_RESTART(instanceName)],
        activeNodeInstanceId,
        'Checking running status of the service',
        accountId,
        undefined,
        '300'
    );

    let statusResponse: { status: string; error?: string };
    try {
        const cleanStatusResponse = rawStatusResponse.replaceAll('\r\n', '')?.replaceAll('\\r\\n', '');
        statusResponse = JSON.parse(cleanStatusResponse);
    } catch (error) {
        logger.error('Error parsing query response:', rawStatusResponse);
        return { running: false, error: 'Error parsing SSM query response' };
    }

    if (statusResponse.status !== 'Running') {
        await updateJobDetails(accountId, checkRunningJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: statusResponse.error
        });
        return { running: false, error: statusResponse.error };
    }

    await updateJobDetails(accountId, checkRunningJobId, {
        status: JOBSTATUS.COMPLETED,
        endTime: Date.now()
    });

    return { running: true, error: '' };
}

export default async function optimizeCompute(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    instanceType: string,
    masterOptimizeParentId?: string
) {
    logger.info('Optimizing compute', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        instanceType
    });
    const { recommendationOptions } = await calculateComputeDrift(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    );
    const recommendedInstanceTypes =
        recommendationOptions?.map(({ instanceType: recommendedInstanceType }) => recommendedInstanceType) || [];
    if (!isDemo() && !recommendedInstanceTypes.includes(instanceType)) {
        throw createError(400, 'Invalid instance type, please choose from the recommended instance types');
    }

    /*
        As per https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/resize-limitations.html), Its riskier to programatically configure the parameters to overcome these limitations.
        Most of these differences between the current and recommended instance types are captured in `platformDifferences` in the response of compute-optimizer.(https://docs.aws.amazon.com/compute-optimizer/latest/ug/view-ec2-recommendations.html#ec2-platform-differences) .
        So proceeding with the optimization only if there are no platform differences between the current and recommended instance types.

        Additional considerations:
        https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/change-instance-type-of-ebs-backed-instance.html

        If your instance has a public IPv4 address, that is not an Elastic IP, we release the address and give your instance a new public IPv4 address.
        If your instance is in an Auto Scaling group, the Amazon EC2 Auto Scaling service marks the stopped instance as unhealthy, and might terminate it and launch a replacement instance.
        You can't change the instance type of a Spot Instance.
        The maximum number of Amazon EBS volumes that you can attach to an instance depends on the instance type and instance size. You can't change to an instance type or instance size that does not support the number of volumes that are already attached to your instance. For more information, see Amazon EBS volume limits for Amazon EC2 instances.
    */

    const platformDifferences =
        recommendationOptions?.find(
            ({ instanceType: recommendedInstanceType }) => recommendedInstanceType === instanceType
        )?.platformDifferences || [];
    if (!isEmpty(platformDifferences)) {
        throw createError(400, 'We dont support the selected instance type as it has platform differences');
    }

    const resourceDetails = await listResources(accountId, databaseHostId, credentialsId, region);

    const [{ resource_name: resourceName, metadata }] = resourceDetails;

    const jobMetadata: JobMetadata = {
        hostsToOptimize: [
            {
                optimizationType: 'compute-rightsizing',
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
        `Optimize EC2 compute for ${resourceName}`,
        `Optimize EC2 compute for ${resourceName}`,
        masterOptimizeParentId,
        jobMetadata
    );

    handleComputeRemediation(
        credentialsId,
        region,
        accountId,
        instanceType,
        resourceDetails,
        jobId,
        databaseInstanceId
    );

    if (isDemo()) {
        (metadata as unknown as Metadata).isComputeOptimized = true;
        updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
    }
    return { jobId };
}

async function moveClusterGroupOwnership(
    credentialsId: string,
    region: string,
    targetNodeName: string,
    activeNodeInstanceId: string
) {
    logger.info('Moving cluster group ownership', {
        credentialsId,
        region,
        targetNodeName,
        activeNodeInstanceId
    });
    const resp = await retryWithDelay(
        callSsmExecution.bind(
            null,
            credentialsId,
            region,
            [MOVE_ALL_CLUSTER_GROUPS(targetNodeName)],
            activeNodeInstanceId,
            'Moves all "SQL Server" cluster groups to a target node and returns the status as a compressed JSON.',
            undefined,
            undefined,
            '300'
        ),
        3,
        5000
    );

    let clusterGroupOwnershipTransferStatus = sqlResponseParsing(resp);
    if (!Array.isArray(clusterGroupOwnershipTransferStatus)) {
        clusterGroupOwnershipTransferStatus = [clusterGroupOwnershipTransferStatus];
    }

    if (
        clusterGroupOwnershipTransferStatus.some(
            ({ status }: { status: string; groupName: string; error: string }) => status === 'failed'
        )
    ) {
        const failedClusterGroups = clusterGroupOwnershipTransferStatus.filter(
            ({ status }: { status: string }) => status === 'failed'
        );
        throw createError(
            500,
            'Failed to transfer primary node ownership. Failed cluster groups',
            failedClusterGroups ? JSON.stringify(failedClusterGroups) : []
        );
    }

    return clusterGroupOwnershipTransferStatus;
}

async function getCurrentDnsSettings(credentialsId: string, region: string, instanceId: string) {
    logger.info('Getting current DNS settings', { credentialsId, region, instanceId });
    return callSsmExecution(
        credentialsId,
        region,
        ['Get-NetAdapter | Get-DnsClientServerAddress | Select-Object -ExpandProperty ServerAddresses'],
        instanceId,
        'Retrieves the DNS server addresses for all network adapters on the system.',
        undefined,
        false
    );
}

async function updateDnsSettings(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    dnsAddresses: string,
    jobId: string,
    instanceName: string
) {
    logger.info('Updating DNS settings', { credentialsId, region, instanceId, dnsAddresses, jobId });
    let errorMessage = '';
    const updateDnsJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        instanceName,
        JOBTYPE.OPTIMIZATION,
        'Update DNS settings',
        'Update DNS settings',
        jobId
    );
    try {
        return await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [`Get-NetAdapter | Set-DnsClientServerAddress -ServerAddresses ${dnsAddresses}`],
                instanceId,
                'Sets the DNS server addresses for all network adapters to the specified addresses.',
                accountId,
                undefined,
                '300'
            ),
            3,
            5000
        );
    } catch (error) {
        errorMessage = `Failed to update DNS settings for ${instanceId}. ${error}`;
        logger.error(errorMessage);
    } finally {
        await updateJobDetails(accountId, updateDnsJobId, {
            status: errorMessage ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
}

async function handleEc2InstanceTypeChange(
    credentialsId: string,
    region: string,
    instanceId: string,
    instanceType: string
) {
    logger.info(`Handling EC2 instance type for ${instanceId} to ${instanceType}`);

    try {
        await modifyInstanceType(credentialsId, region, instanceId, instanceType);
        await startInstance(credentialsId, region, instanceId);
        await waitForInstanceOk(credentialsId, region, instanceId);
    } catch (error) {
        const errorMessage = `Failed to update instance type for ${instanceId} to ${instanceType}. ${error}`;
        logger.error(errorMessage);
        throw createError(500, errorMessage);
    }
}

async function handleIscsiSessions(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    fsxId: string,
    svmId: string,
    jobId: string,
    instanceName: string
) {
    logger.info('Handling ISCSI sessions', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        fsxId,
        svmId,
        jobId,
        instanceName
    });

    const handleIscsiJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        instanceName,
        JOBTYPE.OPTIMIZATION,
        'Check and update ISCSI sessions',
        'Check and update ISCSI sessions to ensure ISCSI sessions are available after instance type change',
        jobId
    );
    let errorMessage = '';
    try {
        const iscsiTargetAddresses = await getIscsiTargetAddresses(credentialsId, region, fsxId, svmId);
        await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                [ENABLE_MPIO_AND_CONFIGURE(iscsiTargetAddresses, 'compute-optimize')],
                ec2InstanceId,
                'Enable MPIO and configure ISCSI sessions',
                accountId,
                false,
                '300'
            ),
            3,
            5000
        );
    } catch (error) {
        errorMessage = `Failed to update ISCSI sessions for ${ec2InstanceId}. ${error}`;
        logger.error(errorMessage);
    } finally {
        await updateJobDetails(accountId, handleIscsiJobId, {
            status: errorMessage ? JOBSTATUS.FAILED : JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
}

async function updateNodeInstanceType(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    instanceType: string,
    fsxId: string,
    svmId: string,
    jobId: string,
    instanceName: string
) {
    logger.info('Handling node instance type change', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        instanceType,
        fsxId,
        svmId
    });

    try {
        const oldDnsAddresses = await getCurrentDnsSettings(credentialsId, region, ec2InstanceId);
        if (!isEmpty(oldDnsAddresses)) {
            await stopInstance(credentialsId, region, ec2InstanceId);
            if (!isDemo()) {
                await waitForInstanceToBeStopped(credentialsId, region, ec2InstanceId);
            }

            await handleEc2InstanceTypeChange(credentialsId, region, ec2InstanceId, instanceType);
            const newDnsAddresses = await getCurrentDnsSettings(credentialsId, region, ec2InstanceId);
            if (isEmpty(newDnsAddresses) || newDnsAddresses !== oldDnsAddresses) {
                await updateDnsSettings(
                    accountId,
                    credentialsId,
                    region,
                    ec2InstanceId,
                    oldDnsAddresses,
                    jobId,
                    instanceName
                );
            }
            await handleIscsiSessions(
                accountId,
                credentialsId,
                region,
                ec2InstanceId,
                fsxId,
                svmId,
                jobId,
                instanceName
            );
        }
    } catch (error) {
        const errorMessage = `Failed to update instance type for ${ec2InstanceId} to ${instanceType}. ${error}`;

        logger.error(errorMessage);
        throw createError(500, errorMessage);
    }
}

export { handleComputeRemediation, checkRunningStatus };
