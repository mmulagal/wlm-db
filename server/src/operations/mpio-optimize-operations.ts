import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import getLogger from '../utils/logger';
import { Metadata, DatabaseInstance, WorkloadInstance, OptimizeMpioPolicyParams } from '../utils/common-types';
import { RESOURCESTYPE, HttpErrorCodes, AuditStatus, FCI } from '../utils/consts';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import { getResources, getInstanceInfo } from './database/database-operations';

import { getActiveSqlNode } from './workloads/mssql/mssql-operations';

import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';

import { registerJob, updateJobDetails } from './database/job-operations';
import { getResourceNameFromTags, sleep, sqlResponseParsing } from '../utils/utils';
import { CHECK_MPIO_POLICY, REMEDIATE_MPIO_POLICY } from './workloads/mssql/mpio-remediation-scripts';
import { driftAssessment } from './drift-assessment';
import { describeInstance } from '../lib/aws/ec2';

const logger = getLogger();

async function validateMpioPolicyToRoundRobin(
    optimizeMpioPolicyParams: OptimizeMpioPolicyParams,
    preCheck: boolean = false,
    runningOnPrimaryNode: boolean = true
) {
    logger.info(`Validate MPIO policy to Round Robin for ${optimizeMpioPolicyParams} on ${runningOnPrimaryNode}`);
    const { accountId, credentialsId, region, parentJobId, serverNameWithHostName, activeNodeInstanceId } =
        optimizeMpioPolicyParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    const jobDescription =
        optimizeMpioPolicyParams.sqlDeploymentType !== 'Standalone'
            ? `Check current MPIO policy on ${
                  runningOnPrimaryNode ? 'primary node' : 'standby node'
              } in ${serverNameWithHostName}.`
            : `Check current MPIO policy in ${serverNameWithHostName}`;
    let parsedValidateMPIOPolicyChangeResponse;

    // Validate the MPIO policy change
    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: jobDescription,
        description: jobDescription,
        startTime: Date.now(),
        type: JOBTYPE.OPTIMIZATION,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        parentJobId
    });
    try {
        const validateMPIOPolicyChangeResponse = await callSsmExecution(
            credentialsId,
            region,
            [CHECK_MPIO_POLICY],
            activeNodeInstanceId!,
            accountId,
            false
        );
        parsedValidateMPIOPolicyChangeResponse = sqlResponseParsing(validateMPIOPolicyChangeResponse);
        if (!parsedValidateMPIOPolicyChangeResponse.remediated && !preCheck) {
            const errorMessage = `Failed to set MPIO policy to Round Robin on ${serverNameWithHostName}.`;
            logger.error(errorMessage);
            jobStatus = JOBSTATUS.FAILED;
            jobError = errorMessage;
            throw errorMessage;
        } else {
            await updateJobDetails(accountId, credentialsId, region, jobId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now()
            });
        }
    } catch (error) {
        const errorMessage = `Error while validating MPIO policy to Round Robin ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        jobError = errorMessage;
        throw errorMessage;
    } finally {
        await updateJobDetails(accountId, credentialsId, region, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }
    return parsedValidateMPIOPolicyChangeResponse;
}

async function setMpioPolicyToRoundRobin(
    optimizeMpioPolicyParams: OptimizeMpioPolicyParams,
    runningOnPrimaryNode: boolean = true
) {
    logger.info(`Setting MPIO policy to Round Robin for ${optimizeMpioPolicyParams} on ${runningOnPrimaryNode}`);
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        serverNameWithHostName,
        sqlDeploymentType,
        activeNodeInstanceId,
        standbyNodeInstanceId
    } = optimizeMpioPolicyParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    const jobDescription =
        optimizeMpioPolicyParams.sqlDeploymentType !== 'Standalone'
            ? `Setting MPIO policy to Round Robin on ${serverNameWithHostName}, rebooting instance and changing cluster ownership on ${
                  runningOnPrimaryNode ? 'primary node' : 'standby node'
              }.`
            : `Setting MPIO policy to Round Robin on ${serverNameWithHostName} and rebooting instance.`;
    let jobError;

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: jobDescription,
        description: jobDescription,
        startTime: Date.now(),
        type: JOBTYPE.OPTIMIZATION,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        parentJobId
    });
    try {
        // Fetch standby node name
        if (sqlDeploymentType === FCI) {
            if (!standbyNodeInstanceId) {
                const errorMessage = `Unable to fetch standby node id for ${serverNameWithHostName}.`;
                logger.error(errorMessage);
                jobStatus = JOBSTATUS.FAILED;
                jobError = errorMessage;
                throw errorMessage;
            }
            const standbyNodeDetails = await describeInstance(credentialsId, region, {
                InstanceIds: [standbyNodeInstanceId!]
            });
            const standbyNodeName = await getResourceNameFromTags(
                standbyNodeDetails.Reservations?.[0].Instances?.[0].Tags
            );
            optimizeMpioPolicyParams.standbyNodeName = standbyNodeName;
        }
        // Set MPIO policy to Round Robin and reboot instance
        const ssmCommand = REMEDIATE_MPIO_POLICY(optimizeMpioPolicyParams);
        await callSsmExecution(credentialsId, region, [ssmCommand], activeNodeInstanceId!);
        let connectionStatus = await getSSMConnectionStatus(credentialsId, region!, activeNodeInstanceId!);
        let retries = 3;
        while (retries > 0) {
            retries -= 1;
            await sleep(20000);
            if (connectionStatus.Status === ConnectionStatus.CONNECTED) {
                jobStatus = JOBSTATUS.COMPLETED;
                break;
            }

            connectionStatus = await getSSMConnectionStatus(credentialsId, region!, activeNodeInstanceId!);
        }
        if (connectionStatus.Status !== ConnectionStatus.CONNECTED) {
            const errorMessage = `Failed to set MPIO policy to Round Robin on ${serverNameWithHostName}.`;
            logger.error(errorMessage);
            jobStatus = JOBSTATUS.FAILED;
            jobError = errorMessage;
            throw errorMessage;
        }
    } catch (error) {
        const errorMessage = `Error while setting MPIO policy to Round Robin ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        jobError = errorMessage;
        throw errorMessage;
    } finally {
        await updateJobDetails(accountId, credentialsId, region, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError,
            description: jobDescription
        });
    }
}

async function optimize(optimizeMpioPolicyParams: OptimizeMpioPolicyParams) {
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        fsxId,
        instanceId,
        instanceName,
        databaseType,
        sqlAuthEnabled,
        serverNameWithHostName,
        databaseHostId,
        awsAccountId,
        activeNodeInstanceId,
        sqlDeploymentType
    } = optimizeMpioPolicyParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    try {
        // For primary node
        // Check if MPIO policy is set to Round Robin
        // If not, set MPIO policy to Round Robin
        // If standalone, reboot instance
        // If FCI, change cluster ownership and reboot instance
        let validateMpioPolicyToRoundRobinResponse = await validateMpioPolicyToRoundRobin(
            optimizeMpioPolicyParams,
            true
        );

        optimizeMpioPolicyParams.currentPolicy = validateMpioPolicyToRoundRobinResponse.policy;

        if (!validateMpioPolicyToRoundRobinResponse.remediated) {
            optimizeMpioPolicyParams.changeClusterOwnership = !validateMpioPolicyToRoundRobinResponse.remediated;
            await setMpioPolicyToRoundRobin(optimizeMpioPolicyParams);
            await validateMpioPolicyToRoundRobin(optimizeMpioPolicyParams, false);
        }

        if (sqlDeploymentType === 'FCI') {
            const activeNode = optimizeMpioPolicyParams.standbyNodeInstanceId;
            optimizeMpioPolicyParams.activeNodeInstanceId = optimizeMpioPolicyParams.standbyNodeInstanceId;
            optimizeMpioPolicyParams.standbyNodeInstanceId = activeNode;

            // For standby node
            // Check if MPIO policy is set to Round Robin
            // Case Not set to RR on standby
            // 1. Check if ownership was changed from primary to standby, if yes change back to primary
            // 2. Reboot instance
            // Case set to RR on standby
            // 1. Check if ownership was changed from primary to standby, if yes change back to primary. Else no action needed
            validateMpioPolicyToRoundRobinResponse = await validateMpioPolicyToRoundRobin(
                optimizeMpioPolicyParams,
                true,
                false
            );
            if (!validateMpioPolicyToRoundRobinResponse.remediated) {
                optimizeMpioPolicyParams.changeClusterOwnership = !validateMpioPolicyToRoundRobinResponse.remediated;
                optimizeMpioPolicyParams.currentPolicy = validateMpioPolicyToRoundRobinResponse.policy;
                await setMpioPolicyToRoundRobin(optimizeMpioPolicyParams, false);
                await validateMpioPolicyToRoundRobin(optimizeMpioPolicyParams, false);
            }
        }
        const { id: jobId } = await registerJob(accountId, credentialsId, region, {
            name: `Assessment for ${serverNameWithHostName} after optimization`,
            description: `Assessment for ${serverNameWithHostName} after optimization`,
            startTime: Date.now(),
            type: JOBTYPE.OPTIMIZATION,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: serverNameWithHostName,
            parentJobId
        });

        const instanceToAssess: WorkloadInstance = {
            id: instanceId,
            name: instanceName,
            type: databaseType,
            region,
            sqlAuthEnabled: sqlAuthEnabled || false,
            fsxFileSystem: fsxId,
            activeNodeInstanceid: activeNodeInstanceId!,
            resourceName: serverNameWithHostName,
            cloudProviderAccountId: awsAccountId
        };
        await driftAssessment(accountId, credentialsId, region, jobId, databaseHostId, [instanceToAssess]);
    } catch (error) {
        const errorMessage = `Error while optimizing mpio configuration ${jobError}`;
        jobStatus = JOBSTATUS.FAILED;
        jobError = errorMessage;
    } finally {
        const errorMessage = `Error while optimizing mpio configuration ${jobError}`;
        logger.error(errorMessage);
        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        updateLongRunningAuditGroup(
            jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED,
            errorMessage
        );
    }
}

async function optimizeOperatingSystemSettings(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    configurationName: string
) {
    logger.info(
        `Optimizing operating system settings for ${accountId}, ${credentialsId} ${databaseHostId} ${databaseInstanceId} in ${region} for configuration ${configurationName}`
    );

    const {
        items: [resourceDetail]
    } = await getResources(accountId, databaseHostId, credentialsId, region, RESOURCESTYPE.MSSQL);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const { metadata, resource_name: sqlServerName } = resourceDetail;
    const { sqlDeploymentType, node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId, standbyNodeInstanceId, instancesDetails } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId
    );

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        const errorMessage = `Unable to optimize host ${sqlServerName} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
    const {
        fsxn_ids: fsxId,
        database_instance_name: instanceName,
        database_instance_id: instanceId,
        database_type: databaseType
    } = instanceDetail as unknown as DatabaseInstance;

    const sqlAuthEnabled =
        instancesDetails && instanceDetail
            ? instancesDetails.some(
                  instance =>
                      instance.instanceName === instanceDetail.database_instance_name &&
                      instance.sqlAuthEnabled === true
              )
            : false;

    const serverNameWithHostName = instanceName ? `${sqlServerName}\\${instanceName}` : (sqlServerName as string);
    updateLongRunningAuditGroup(undefined, undefined, serverNameWithHostName);

    // create the parent job for optimize operation
    const { id: parentJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.OPTIMIZATION,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName as string,
        name: `Optimize operating system configuration for ${serverNameWithHostName}`,
        startTime: Date.now(),
        description: `Optimize operating system configuration for ${serverNameWithHostName}`
    });
    try {
        optimize({
            accountId,
            region,
            credentialsId,
            parentJobId,
            serverNameWithHostName,
            sqlDeploymentType,
            activeNodeInstanceId,
            databaseHostId,
            fsxId,
            instanceId,
            instanceName,
            databaseType,
            databaseInstanceId,
            sqlAuthEnabled,
            awsAccountId: resourceDetail.cloud_provider_account_id!,
            standbyNodeInstanceId
        });
    } catch (error) {
        const errorMessage = `Error while optimizing operating system settings ${error}`;
        logger.error(errorMessage);
        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);

        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    return { jobId: parentJobId };
}

export { optimizeOperatingSystemSettings };
