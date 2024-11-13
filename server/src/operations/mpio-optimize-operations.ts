import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import getLogger from '../utils/logger';
import { Metadata, DatabaseInstance, WorkloadInstance } from '../utils/common-types';
import { RESOURCESTYPE, HttpErrorCodes } from '../utils/consts';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import { getResources, getInstanceInfo } from './database/database-operations';

import { getActiveSqlNode } from './workloads/mssql/mssql-operations';

import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';

import { registerJob, updateJobDetails } from './database/job-operations';
import { sleep, sqlResponseParsing } from '../utils/utils';
import { CHECK_MPIO_POLICY, REMEDIATE_MPIO_POLICY } from './workloads/mssql/mpio-remediation-scripts';
import { driftAssessment } from './drift-assessment';

const logger = getLogger();

interface OptimizeMpioPolicyParams {
    accountId: string;
    region: string;
    credentialsId: string;
    parentJobId: string;
    fsxId: string;
    instanceId: string;
    instanceName: string;
    databaseType: string;
    sqlAuthEnabled: boolean;
    serverNameWithHostName: string;
    databaseHostId: string;
    databaseInstanceId: string;
    sqlDeploymentType?: string;
    activeNodeInstanceId?: string;
    standbyNodeInstanceId?: string;
    awsAccountId: string;
}

async function validateMpioPolicyToRoundRobin(
    optimizeMpioPolicyParams: OptimizeMpioPolicyParams,
    preCheck: boolean = false
) {
    logger.info(`Validate MPIO policy to Round Robin for ${optimizeMpioPolicyParams}`);
    const { accountId, credentialsId, region, parentJobId, serverNameWithHostName, activeNodeInstanceId } =
        optimizeMpioPolicyParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    const jobDescription = `Validate MPIO policy to Round Robin on ${serverNameWithHostName}.`;
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
        logger.info('@@@@@@@@@@@@@@@@@@@@');
        logger.info({ parsedValidateMPIOPolicyChangeResponse });
        logger.info({ preCheck });
        logger.info('@@@@@@@@@@@@@@@@@@@@');
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

async function setMpioPolicyToRoundRobin(optimizeMpioPolicyParams: OptimizeMpioPolicyParams) {
    logger.info(`Setting MPIO policy to Round Robin for ${optimizeMpioPolicyParams}`);
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        serverNameWithHostName,
        sqlDeploymentType,
        activeNodeInstanceId
    } = optimizeMpioPolicyParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    const jobDescription = `Setting MPIO policy to Round Robin on ${serverNameWithHostName} and rebooting instance.`;
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
        // Set MPIO policy to Round Robin and reboot instance
        const ssmCommand = REMEDIATE_MPIO_POLICY(sqlDeploymentType!);
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
        activeNodeInstanceId
    } = optimizeMpioPolicyParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    try {
        const validateMpioPolicyToRoundRobinResponse = await validateMpioPolicyToRoundRobin(
            optimizeMpioPolicyParams,
            true
        );
        if (!validateMpioPolicyToRoundRobinResponse.remediated) {
            await setMpioPolicyToRoundRobin(optimizeMpioPolicyParams);
            await validateMpioPolicyToRoundRobin(optimizeMpioPolicyParams, false);
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

    const { isSSMConnected, activeNodeInstanceId, instancesDetails } = await getActiveSqlNode(
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
        awsAccountId: resourceDetail.cloud_provider_account_id!
    });

    return { jobId: parentJobId };
}

export { optimizeOperatingSystemSettings, validateMpioPolicyToRoundRobin };
