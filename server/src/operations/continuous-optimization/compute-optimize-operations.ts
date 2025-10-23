import { JOBSTATUS, JOBTYPE, resource } from '@prisma/client';
import createError from 'http-errors';
import { cloneDeep, compact, isEmpty } from 'lodash-es';
import {
    DatabaseInstance,
    Metadata,
    NodeDetails,
    ResourceAssessmentData,
    SsmSqlServerRunningStatus
} from '../../utils/common-types';
import { AuditStatus } from '../../utils/consts';
import {
    IS_DEMO_FLOW,
    formatSsmArrayResponse,
    getServerNameWithHostname,
    retryWithDelay,
    sqlResponseParsing
} from '../../utils/utils';
import { callSsmExecution, pollSSMConnectionStatus } from '../aws/ssm-operations';
import {
    CHECK_NODE_STATUS,
    GET_CLUSTER_NODE_NAMES,
    GET_RUNNING_SQL_SERVERS
} from '../workloads/mssql/assessment-scripts';
import { CHECK_RUNNING_STATUS_WITH_RESTART, MOVE_ALL_CLUSTER_GROUPS } from '../workloads/mssql/optimization-scripts';
import { getActiveSqlNode } from '../workloads/mssql/mssql-operations';
import { updateJobDetails } from '../database/job-operations';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';

import getLogger from '../../utils/logger';

import { getIscsiTargetAddresses } from '../aws/fsx-operations';

import { modifyInstanceType, startInstance, stopInstance, waitForInstanceOk } from '../../lib/aws/ec2';
import {
    getInstanceDetailsByPrivateIp,
    instanceTypeChangePreReqs,
    waitForInstanceToBeStopped
} from '../aws/ec2-operations';
import { listResources } from '../../lib/database/db';
import { CLUSTER_NETWORK_IP_INFO_PS1, FAILURE_INFO } from '../workloads/mssql/discover-consts';
import { calculateComputeDrift } from './compute-assessment-operations';
import { handleOptimizeJobCreation, JobMetadata } from './assessment-utils';
import { ENABLE_MPIO_AND_CONFIGURE } from '../workloads/mssql/mpio-remediation-scripts';
import {
    getInstanceInfo,
    updateDatabaseHostAssessmentData,
    updateResourceMetaData
} from '../database/database-operations';
import { AssessmentStatus } from '../../utils/continous-optimization-consts';
import { RESOURCE_DEFAULT_SELECT_FIELDS } from '../../utils/database-consts';

interface ModifiedInstancesNodeDetails {
    ec2InstanceId: string;
    oldDnsAddresses: string;
    oldInstanceType: string;
    isPrimaryNode?: boolean;
}
interface StorageDetails {
    svmId: string;
    fsxId: string;
}
const logger = getLogger();
const COMPUTE_OPTIMIZE_SSM_EXECUTION_TIMEOUT = '300';

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
    let isJobStatusUpdated = false;

    let anySubJobFailed = false;

    let oldClusterOwnerNode;
    let activeNodeInstanceId: string = '';
    let shouldRollbackClusterOwnership = false;
    let formattedInstanceName = getServerNameWithHostname(resourceDetails[0]?.resource_name || undefined);
    const modifiedInstancesNodeDetails: ModifiedInstancesNodeDetails[] = [];
    let storageDetails = { svmId: '', fsxId: '' };
    let runningSqlServerNames: string[] | undefined;
    let completedWithError = false;

    try {
        const [{ resource_id: databaseHostId, metadata, assessment_data: assessmentData }] = resourceDetails;
        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
        ({ activeNodeInstanceId = '' } = await getActiveSqlNode(credentialsId, region, {
            node1InstanceId,
            node2InstanceId
        }));

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
            storageDetails = { svmId, fsxId };
            if (node2InstanceId) {
                // more than one node in the cluster
                try {
                    // check for an active SSM connection on standby node
                    await pollSSMConnectionStatus(accountId, credentialsId, region, activeNodeInstanceId);
                } catch (error) {
                    const errorMsg = `SSM connection is not available for the selected instance: ${
                        (error as Error).message
                    }`;
                    logger.error(errorMsg);
                    throw createError(500, errorMsg);
                }
                const { clusterNodeDetails, clusterNodeInstanceIds } = await getClusterNodeInstanceIds(
                    accountId,
                    credentialsId,
                    region,
                    node2InstanceId
                );

                if (clusterNodeInstanceIds.length > 1) {
                    instanceIdsList.push(...clusterNodeInstanceIds);
                    await updateLongRunningAuditGroup(undefined, undefined, formattedInstanceName);

                    // run elastic IP address; spot instance and autoscaling instance check for all nodes in the cluster; throws error if any node has does not meets the criteria
                    const preReqJobId = await handleOptimizeJobCreation(
                        accountId,
                        credentialsId,
                        region,
                        formattedInstanceName,
                        JOBTYPE.WELL_ARCHITECTED,
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
                        JOBTYPE.WELL_ARCHITECTED,
                        'Modify instance type for secondary nodes in the cluster',
                        `Modify instance type of SQL nodes ${nonPrimaryNodeInstanceIds.join(
                            ','
                        )} to ${instanceType}. To modify, instance will be stopped, modified and restarted.`,
                        jobId
                    );

                    try {
                        // modify instance type for all nodes in the cluster, (one node at a time to be on safer side) except the primary node
                        for (const nodeId of nonPrimaryNodeInstanceIds) {
                            const { ec2InstanceType: oldInstanceType = '' } =
                                clusterNodeDetails.find(node => node.ec2InstanceId === nodeId) || {};
                            // eslint-disable-next-line no-await-in-loop
                            const { ec2InstanceId, oldDnsAddresses } = await updateNodeInstanceType(
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
                            modifiedInstancesNodeDetails.push({
                                ec2InstanceId,
                                oldDnsAddresses,
                                oldInstanceType,
                                isPrimaryNode: false
                            });
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
                    let ownerNode;
                    let targetNodeName;
                    const transferOwnershipJobId = await handleOptimizeJobCreation(
                        accountId,
                        credentialsId,
                        region,
                        formattedInstanceName,
                        JOBTYPE.WELL_ARCHITECTED,
                        'Transfer cluster node ownership from primary to another node in the cluster',
                        'Transfer cluster node ownership from primary node in the cluster to a healthy node in the cluster.',
                        jobId
                    );

                    try {
                        ({ targetNodeName, ownerNode } = await transferClusterOwnershipToStandbyNode(
                            accountId,
                            credentialsId,
                            region,
                            activeNodeInstanceId
                        ));
                        oldClusterOwnerNode = ownerNode;
                        shouldRollbackClusterOwnership = true;
                        await updateJobDetails(accountId, transferOwnershipJobId, {
                            description: `Transfer cluster node ownership from primary node ${ownerNode} to another node ${targetNodeName} in the cluster`,
                            status: JOBSTATUS.COMPLETED,
                            endTime: Date.now()
                        });
                    } catch (error) {
                        const errMsg = `Failed to transfer primary node: ${ownerNode} ownership to another node in the cluster: ${targetNodeName}, ${error}`;
                        logger.error(errMsg);
                        await updateJobDetails(accountId, transferOwnershipJobId, {
                            status: JOBSTATUS.FAILED,
                            endTime: Date.now(),
                            error: errMsg
                        });
                        anySubJobFailed = true;
                        throw error;
                    }
                }
            } else {
                // single node cluster/standalone
                runningSqlServerNames = await getRunningSqlServices(
                    accountId,
                    credentialsId,
                    region,
                    activeNodeInstanceId
                );

                const preReqJobId = await handleOptimizeJobCreation(
                    accountId,
                    credentialsId,
                    region,
                    formattedInstanceName,
                    JOBTYPE.WELL_ARCHITECTED,
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
                JOBTYPE.WELL_ARCHITECTED,
                'Modify instance type for primary node in the cluster',
                `Modify instance type of SQL node ${activeNodeInstanceId} to ${instanceType}.To modify, instance will be stopped,modified and restarted.`,
                jobId
            );
            try {
                const { compute: { currentInstanceType: oldInstanceType = '' } = {} } =
                    assessmentData as ResourceAssessmentData;
                const { ec2InstanceId, oldDnsAddresses } = await updateNodeInstanceType(
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
                modifiedInstancesNodeDetails.push({
                    ec2InstanceId,
                    oldDnsAddresses,
                    oldInstanceType,
                    isPrimaryNode: true
                });

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
                    JOBTYPE.WELL_ARCHITECTED,
                    'Transfer node ownership back to primary node in the cluster',
                    'Transfer node ownership back to primary node in the cluster',
                    jobId
                );
                try {
                    const ownershipTransferStatus = await moveClusterGroupOwnership(
                        credentialsId,
                        region,
                        oldClusterOwnerNode,
                        activeNodeInstanceId
                    );
                    logger.info('Primary node ownership transferred to', {
                        oldClusterOwnerNode,
                        ownershipTransferStatus
                    });
                    await updateJobDetails(accountId, nodeTransferJobId, {
                        status: JOBSTATUS.COMPLETED,
                        endTime: Date.now()
                    });
                    shouldRollbackClusterOwnership = false;
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
                subJobErrorMessage = checkRunningResponse.error;
                completedWithError = true;
                throw checkRunningResponse.error;
            }

            // Update assessment data after successful optimization
            const existingAssessmentData = assessmentData as ResourceAssessmentData;
            const recommendationOptions = existingAssessmentData?.compute?.recommendationOptions ?? [];
            const newAssessmentData: ResourceAssessmentData = {
                ...existingAssessmentData,
                compute: {
                    ...existingAssessmentData.compute,
                    finding: AssessmentStatus.OPTIMIZED,
                    findingReasonCodes: [],
                    currentInstanceType: instanceType,
                    recommendationOptions
                },
                lastAssessedDate: Date.now().toString()
            };
            await updateDatabaseHostAssessmentData(accountId, credentialsId, databaseHostId, newAssessmentData);
            jobStatus = JOBSTATUS.COMPLETED;
            if (IS_DEMO_FLOW) {
                const updatedMetadata = cloneDeep(metadata) as unknown as Metadata;
                updatedMetadata.isComputeOptimized = true;
                await updateResourceMetaData(accountId, credentialsId, databaseHostId, updatedMetadata);
            }
            await updateLongRunningAuditGroup(AuditStatus.SUCCESS, undefined, formattedInstanceName);
            return;
        }

        jobStatus = JOBSTATUS.FAILED;
        errorMessage = 'No active node found in the cluster';
    } catch (error) {
        errorMessage = `Error while fixing compute ${error}`;
        logger.error(errorMessage);
        isJobStatusUpdated = true;
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage, formattedInstanceName);
        await updateJobDetails(accountId, jobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        if (modifiedInstancesNodeDetails.length > 0) {
            // In case of failure, rollback the instance type change for the nodes that were successfully updated
            rollbackComputeOptimize(
                accountId,
                credentialsId,
                region,
                storageDetails,
                modifiedInstancesNodeDetails,
                shouldRollbackClusterOwnership,
                activeNodeInstanceId,
                oldClusterOwnerNode,
                resourceDetails[0]?.resource_name ?? formattedInstanceName
            ).catch(rollbackError => {
                errorMessage = `Error while reverting instance type change ${rollbackError}`;
                logger.error(errorMessage);
            });
        }
    } finally {
        if (!isJobStatusUpdated) {
            const parentJobStatus = completedWithError
                ? JOBSTATUS.WARNING
                : anySubJobFailed
                ? JOBSTATUS.FAILED
                : jobStatus || JOBSTATUS.COMPLETED;

            await updateJobDetails(accountId, jobId, {
                status: parentJobStatus,
                endTime: Date.now(),
                error: errorMessage
            });
        }
    }
}

async function getRunningSqlServices(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string
) {
    logger.info('Getting running services before optimization', {
        accountId,
        credentialsId,
        region
    });

    try {
        const rawResponse = await callSsmExecution(
            credentialsId,
            region,
            [GET_RUNNING_SQL_SERVERS()],
            activeNodeInstanceId,
            'Getting running SQL server names',
            accountId,
            false
        );

        const sqlServers: string | string[] = sqlResponseParsing(rawResponse);
        return formatSsmArrayResponse<string>(sqlServers);
    } catch (error) {
        logger.error('Error while fetching running sql servers:', error);
        return [];
    }
}

async function checkRunningStatus(
    accountId: string,
    parentJobId: string,
    region: string,
    credentialsId: string,
    activeNodeInstanceId: string,
    formattedInstanceName: string,
    sqlServerNames: string[]
) {
    logger.info('Checking running status', {
        accountId,
        credentialsId,
        region,
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

    // worst 40secs needed for one sql server to start; 10secs buffer
    const timeRequired = 40 * sqlServerNames.length + 10;
    let jobDetails: { status: string; error?: string } = {
        status: JOBSTATUS.COMPLETED,
        error: ''
    };
    let rawStatusResponse;

    try {
        rawStatusResponse = await callSsmExecution(
            credentialsId,
            region,
            [CHECK_RUNNING_STATUS_WITH_RESTART(sqlServerNames)],
            activeNodeInstanceId,
            'Checking running status of the service',
            accountId,
            false,
            timeRequired.toString()
        );
        const cleanResponse = sqlResponseParsing(rawStatusResponse);
        const statuses: SsmSqlServerRunningStatus[] = formatSsmArrayResponse<SsmSqlServerRunningStatus>(cleanResponse);

        const faultyServers = statuses.filter(({ status }) => status !== 'Running').map(({ name }) => name);

        jobDetails = {
            status: faultyServers.length === 0 ? JOBSTATUS.COMPLETED : JOBSTATUS.FAILED,
            error: faultyServers.length === 0 ? '' : `Some SQL servers (${faultyServers}) are not running.`
        };
    } catch (error) {
        logger.error('Error while fetching sql service running status:', rawStatusResponse);
        jobDetails = {
            status: JOBSTATUS.FAILED,
            error: typeof error === 'string' ? error : JSON.stringify(error)
        };
    } finally {
        await updateJobDetails(accountId, checkRunningJobId, {
            ...jobDetails,
            endTime: Date.now()
        });
    }
    return jobDetails;
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

    const resourceDetails = await listResources({
        accountId,
        resourceId: databaseHostId,
        credentialIds: credentialsId,
        region,
        selectKeys: [...RESOURCE_DEFAULT_SELECT_FIELDS, 'assessment_data', 'configurations']
    });
    const [{ resource_name: resourceName, metadata, assessment_data: assessmentData }] = resourceDetails;

    const { recommendationOptions } = calculateComputeDrift(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        assessmentData as ResourceAssessmentData
    );
    const recommendedInstanceTypes =
        recommendationOptions?.map(({ instanceType: recommendedInstanceType }) => recommendedInstanceType) || [];
    if (!IS_DEMO_FLOW && !recommendedInstanceTypes.includes(instanceType)) {
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
        JOBTYPE.WELL_ARCHITECTED,
        `Fix EC2 compute for ${resourceName}`,
        `Fix EC2 compute for ${resourceName}`,
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

    if (IS_DEMO_FLOW) {
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
            COMPUTE_OPTIMIZE_SSM_EXECUTION_TIMEOUT
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
        JOBTYPE.WELL_ARCHITECTED,
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
                COMPUTE_OPTIMIZE_SSM_EXECUTION_TIMEOUT
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
    accountId: string,
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
        try {
            // check for an active SSM connection on standby node
            await pollSSMConnectionStatus(accountId, credentialsId, region, instanceId);
        } catch (error) {
            const errorMsg = `SSM connection is not available for the selected instance: ${(error as Error).message}`;
            logger.error(errorMsg);
            throw createError(500, errorMsg);
        }
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
        JOBTYPE.WELL_ARCHITECTED,
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
                COMPUTE_OPTIMIZE_SSM_EXECUTION_TIMEOUT
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
    instanceName: string,
    dnsAddresses?: string
) {
    logger.info('Handling node instance type change', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        instanceType,
        fsxId,
        svmId,
        jobId,
        instanceName,
        dnsAddresses
    });

    try {
        const oldDnsAddresses = dnsAddresses ?? (await getCurrentDnsSettings(credentialsId, region, ec2InstanceId));
        if (!isEmpty(oldDnsAddresses)) {
            await stopInstance(credentialsId, region, ec2InstanceId);
            if (!IS_DEMO_FLOW) {
                await waitForInstanceToBeStopped(credentialsId, region, ec2InstanceId);
            }

            await handleEc2InstanceTypeChange(accountId, credentialsId, region, ec2InstanceId, instanceType);
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
        return { ec2InstanceId, oldDnsAddresses };
    } catch (error) {
        const errorMessage = `Failed to update instance type for ${ec2InstanceId} to ${instanceType}. ${error}`;

        logger.error(errorMessage);
        throw createError(500, errorMessage);
    }
}

async function getClusterNodeInstanceIds(accountId: string, credentialsId: string, region: string, instanceId: string) {
    const clusterNetworkIpDetails = await callSsmExecution(
        credentialsId,
        region,
        CLUSTER_NETWORK_IP_INFO_PS1,
        instanceId,
        'Get cluster network IPs',
        accountId,
        undefined,
        COMPUTE_OPTIMIZE_SSM_EXECUTION_TIMEOUT
    );
    let clusterNodeInstanceIds: string[] = [];
    let clusterNodeDetails: NodeDetails[] = [];
    if (clusterNetworkIpDetails?.includes(FAILURE_INFO)) {
        throw createError('Failed to get network interface details during compute optimization.');
    } else if (clusterNetworkIpDetails) {
        const clusterNetworkIpDetailsJson: { clusterNetworkIps: string[] } = JSON.parse(clusterNetworkIpDetails);
        // get all nodes in a cluster
        const { clusterNetworkIps } = clusterNetworkIpDetailsJson;
        if (clusterNetworkIps.length > 1) {
            clusterNodeDetails = await getInstanceDetailsByPrivateIp(credentialsId, region, clusterNetworkIps);
            clusterNodeInstanceIds = compact(clusterNodeDetails.map(({ ec2InstanceId }) => ec2InstanceId));
        }
    }
    return { clusterNodeDetails, clusterNodeInstanceIds };
}

async function transferClusterOwnershipToStandbyNode(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string
) {
    try {
        const sqlNodeDetails = await callSsmExecution(
            credentialsId,
            region,
            [GET_CLUSTER_NODE_NAMES()],
            activeNodeInstanceId,
            'Get all node names in the cluster',
            accountId,
            undefined,
            COMPUTE_OPTIMIZE_SSM_EXECUTION_TIMEOUT
        );
        let { ownerNodes, clusterNodes, currentNode } = sqlResponseParsing(sqlNodeDetails);
        ownerNodes = Array.isArray(ownerNodes) ? ownerNodes : ownerNodes?.split(',');
        const ownerNode = ownerNodes?.includes(currentNode) ? currentNode : ownerNodes?.[0];
        clusterNodes = clusterNodes.filter((nodeName: string) => nodeName !== currentNode);
        // pick one of the nodes in the cluster to transfer primary node ownership
        let targetNodeName;
        for await (const nodeName of clusterNodes) {
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
        return { targetNodeName, ownerNode };
    } catch (error) {
        const errorMessage = `Failed to transfer sql node ownership in the cluster, ${error}`;
        logger.error(errorMessage);
        throw Error(errorMessage);
    }
}

async function handleRollbackClusterOwnership(
    accountId: string,
    credentialsId: string,
    region: string,
    formattedInstanceName: string,
    targetNodeName: string,
    activeNodeInstanceId: string,
    rollBackJobId: string
) {
    logger.info('Rolling back cluster ownership', {
        accountId,
        credentialsId,
        region,
        formattedInstanceName,
        targetNodeName
    });

    let rollbackClusterOwnershipJobId;
    try {
        rollbackClusterOwnershipJobId = await handleOptimizeJobCreation(
            accountId,
            credentialsId,
            region,
            formattedInstanceName,
            JOBTYPE.WELL_ARCHITECTED,
            'Rollback cluster ownership transfer to primary node',
            'Rollback cluster ownership transfer to primary node',
            rollBackJobId
        );
        await moveClusterGroupOwnership(credentialsId, region, targetNodeName, activeNodeInstanceId);
        await updateJobDetails(accountId, rollbackClusterOwnershipJobId, {
            status: JOBSTATUS.COMPLETED,
            endTime: Date.now()
        });
    } catch (error) {
        const errorMessage = `Error while rolling back compute cluster group ownership ${error}`;
        logger.error(errorMessage);
        if (rollbackClusterOwnershipJobId) {
            await updateJobDetails(accountId, rollbackClusterOwnershipJobId, {
                status: JOBSTATUS.FAILED,
                endTime: Date.now(),
                error: errorMessage
            });
        }
        if (rollBackJobId) {
            await updateJobDetails(accountId, rollBackJobId, {
                status: JOBSTATUS.FAILED,
                endTime: Date.now(),
                error: errorMessage
            });
        }
        throw Error(`Error while rolling back compute cluster group ownership ${error}`);
    }
}

async function handleRollbackInstanceTypeChange(
    accountId: string,
    credentialsId: string,
    region: string,
    storageDetails: StorageDetails,
    modifiedInstancesNodeDetails: ModifiedInstancesNodeDetails[],
    formattedInstanceName: string,
    rollbackComputeOptimizeJobId: string,
    isPrimaryNode: boolean = false
) {
    logger.info('Rolling back instance type change', {
        accountId,
        credentialsId,
        region,
        storageDetails,
        modifiedInstancesNodeDetails,
        formattedInstanceName,
        rollbackComputeOptimizeJobId
    });

    const nodeType = isPrimaryNode ? 'primary node' : 'secondary nodes';

    const rollBackInstanceTypeJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        formattedInstanceName,
        JOBTYPE.WELL_ARCHITECTED,
        `Rolling back instance type change for ${nodeType} in the cluster`,
        `Rolling back instance type of SQL node/s ${modifiedInstancesNodeDetails
            .map(({ ec2InstanceId }) => ec2InstanceId)
            .join(',')} to ${
            modifiedInstancesNodeDetails[0]?.oldInstanceType
        }. To modify, instance/s will be stopped, modified and restarted.`,
        rollbackComputeOptimizeJobId
    );

    try {
        await Promise.all(
            modifiedInstancesNodeDetails.map(({ ec2InstanceId, oldDnsAddresses, oldInstanceType }) =>
                updateNodeInstanceType(
                    accountId,
                    credentialsId,
                    region,
                    ec2InstanceId,
                    oldInstanceType,
                    storageDetails.fsxId,
                    storageDetails.svmId,
                    rollBackInstanceTypeJobId,
                    formattedInstanceName,
                    oldDnsAddresses
                )
            )
        );
        await updateJobDetails(accountId, rollBackInstanceTypeJobId, {
            status: JOBSTATUS.COMPLETED,
            endTime: Date.now()
        });
    } catch (error) {
        await updateJobDetails(accountId, rollBackInstanceTypeJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: `Failed to update instance type for ${nodeType} in the cluster, ${error}`
        });
        throw error;
    }
}

async function rollbackComputeOptimize(
    accountId: string,
    credentialsId: string,
    region: string,
    storageDetails: StorageDetails,
    modifiedInstancesNodeDetails: ModifiedInstancesNodeDetails[],
    shouldRollbackClusterOwnership: boolean,
    activeNodeInstanceId: string,
    oldClusterOwnerNode: string,
    formattedInstanceName: string
) {
    logger.info('Rolling back compute optimization', {
        accountId,
        credentialsId,
        region,
        storageDetails,
        modifiedInstancesNodeDetails,
        shouldRollbackClusterOwnership,
        activeNodeInstanceId,
        oldClusterOwnerNode,
        formattedInstanceName
    });

    let errorMessage = '';
    const rollbackComputeOptimizeJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        formattedInstanceName,
        JOBTYPE.WELL_ARCHITECTED,
        'Rollback EC2 compute remidiation for nodes in the cluster',
        'Rollback EC2 compute remidiation for nodes in the cluster'
    );
    let rollBackJobStatus;
    try {
        if (modifiedInstancesNodeDetails.length > 0 && rollbackComputeOptimizeJobId) {
            const modifiedPrimaryNodeDetails = modifiedInstancesNodeDetails.find(
                instanceDetails => instanceDetails.isPrimaryNode
            );
            if (modifiedPrimaryNodeDetails) {
                // rollback primary node instance type change
                await handleRollbackInstanceTypeChange(
                    accountId,
                    credentialsId,
                    region,
                    storageDetails,
                    [modifiedPrimaryNodeDetails],
                    formattedInstanceName,
                    rollbackComputeOptimizeJobId,
                    true
                );
            }

            if (shouldRollbackClusterOwnership) {
                // rollback cluster ownership transfer back to original node
                await handleRollbackClusterOwnership(
                    accountId,
                    credentialsId,
                    region,
                    formattedInstanceName,
                    oldClusterOwnerNode,
                    activeNodeInstanceId,
                    rollbackComputeOptimizeJobId
                );
            }

            // rollback secondary nodes instance type change
            const modifiedSecondaryNodeDetails = modifiedInstancesNodeDetails.filter(
                instanceDetails => !instanceDetails.isPrimaryNode
            );
            if (!isEmpty(modifiedSecondaryNodeDetails)) {
                await handleRollbackInstanceTypeChange(
                    accountId,
                    credentialsId,
                    region,
                    storageDetails,
                    modifiedSecondaryNodeDetails,
                    formattedInstanceName,
                    rollbackComputeOptimizeJobId
                );
            }
        }
    } catch (error) {
        errorMessage = `Failed to rollback compute optimization ${error}`;
        logger.error(errorMessage);
        rollBackJobStatus = JOBSTATUS.FAILED;
    } finally {
        rollBackJobStatus = rollBackJobStatus || JOBSTATUS.COMPLETED;
        await updateJobDetails(accountId, rollbackComputeOptimizeJobId, {
            status: rollBackJobStatus,
            endTime: Date.now(),
            error: !isEmpty(errorMessage) ? errorMessage : undefined
        });
    }
}

export {
    handleComputeRemediation,
    checkRunningStatus,
    getRunningSqlServices,
    getClusterNodeInstanceIds,
    transferClusterOwnershipToStandbyNode,
    moveClusterGroupOwnership,
    handleRollbackClusterOwnership
};
