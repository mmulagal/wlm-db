import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import getLogger from '../utils/logger';
import { OptimizeStorageRequestParamsType } from '../routes/types/database-hosts.types';
import { Metadata, DatabaseInstance, WorkloadInstance } from '../utils/common-types';
import { RESOURCESTYPE, HttpErrorCodes, AuditStatus } from '../utils/consts';
import { callSsmExecution } from './aws/ssm-operations';
import { getResources, getInstanceInfo } from './database/database-operations';
import { OPTIMIZE_STORAGE_PARAMS_SCRIPT } from './workloads/mssql/drift-assessment-scripts';
import { getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { getJobs, registerJob, updateJobDetails } from './database/job-operations';
import { getTimeDifferenceInMinutes, isDemo, sqlResponseParsing } from '../utils/utils';
import { driftAssessment } from './drift-assessment';
import { describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import {
    OptimizeInstanceParams,
    QUERY_PARAMS,
    OptimizeStorageConfigs,
    OptimizeStorageApiData
} from '../utils/continous-optimization-consts';

const isDemoFlow = isDemo();

const logger = getLogger();

interface OptimizeStorageParams {
    accountId: string;
    region: string;
    credentialsId: string;
    fsxId: string;
    activeNodeInstanceId: string;
    parentJobId: string;
    optimizationTargets: OptimizeStorageRequestParamsType[];
    optimizationConfigs: Record<string, any>;
    apiRequestData: Record<string, any>;
    svmName: string;
    serverNameWithHostName: string;
}

interface OptimizeOperationParams {
    accountId: string;
    region: string;
    credentialsId: string;
    awsAccountId: string;
    fsxId: string;
    activeNodeInstanceId: string;
    parentJobId: string;
    serverNameWithHostName: string;
    instanceId: string;
    databaseHostId: string;
    databaseType: string;
    instanceName: string;
    sqlAuthEnabled: boolean;
    svmName: string;
    optimizationTargets: OptimizeStorageRequestParamsType[];
}

async function optimizeOperation(params: OptimizeOperationParams) {
    logger.info('Optimizing storage for', params);
    const {
        accountId,
        region,
        credentialsId,
        awsAccountId,
        fsxId,
        activeNodeInstanceId,
        parentJobId,
        serverNameWithHostName,
        instanceId,
        databaseHostId,
        databaseType,
        instanceName,
        sqlAuthEnabled,
        svmName,
        optimizationTargets
    } = params;
    if (optimizationTargets && optimizationTargets.length > 0) {
        await optimizeStorage({
            accountId,
            region,
            credentialsId,
            fsxId,
            activeNodeInstanceId: activeNodeInstanceId!,
            parentJobId,
            optimizationTargets,
            optimizationConfigs: OptimizeStorageConfigs,
            apiRequestData: OptimizeStorageApiData,
            svmName,
            serverNameWithHostName
        });
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
        cloudProviderAccountId: awsAccountId,
        resourceName: serverNameWithHostName
    };

    await driftAssessment(accountId, credentialsId, region, jobId, databaseHostId, [instanceToAssess]);
    await updateJobDetails(accountId, credentialsId, region, parentJobId, {
        status: JOBSTATUS.COMPLETED,
        endTime: Date.now(),
        description: `Optimization completed for ${serverNameWithHostName}`
    });
    updateLongRunningAuditGroup(AuditStatus.SUCCESS);
}

async function optimizeStorage(params: OptimizeStorageParams) {
    const {
        accountId,
        region,
        credentialsId,
        fsxId,
        activeNodeInstanceId,
        parentJobId,
        optimizationTargets,
        optimizationConfigs,
        apiRequestData,
        svmName,
        serverNameWithHostName
    } = params;
    logger.info(`Optimizing storage for ${accountId} in ${region} for configuration ${optimizationTargets}`);

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Optimize storage for ${serverNameWithHostName}`,
        description: `Optimize storage for ${serverNameWithHostName}`,
        startTime: Date.now(),
        type: JOBTYPE.OPTIMIZATION,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        parentJobId
    });
    logger.debug(`Job created with id ${jobId}`);
    let newJobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let parentJobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let newJobError;
    let parentJobError;
    let newJobDescription;

    try {
        for (const data of optimizationTargets) {
            const { configurationName, objectsToOptimize } = data;
            const configKey = Object.keys(optimizationConfigs).find(
                key => optimizationConfigs[key as keyof typeof optimizationConfigs] === configurationName
            );

            if (!configKey) {
                throw new Error('Storage configuration not found');
            }

            const apiData = apiRequestData[configKey as keyof typeof apiRequestData];
            const apiBody = JSON.stringify(apiData.body);
            const optimizeType = apiData.type;
            if (!Array.isArray(objectsToOptimize) || objectsToOptimize.some(obj => !obj)) {
                throw new Error('objectsToOptimize must be an array with non-empty string elements.');
            }
            const queryParamKey = QUERY_PARAMS[optimizeType as keyof typeof QUERY_PARAMS];
            const apiQueryFilter = `vserver=${svmName}&${queryParamKey}=${objectsToOptimize.join(',')}`;
            const apiEndpoint = apiData.api;

            const ssmCommand = OPTIMIZE_STORAGE_PARAMS_SCRIPT({
                fsxId,
                region,
                apiEndpoint,
                apiQueryFilter,
                apiBody
            });
            const resp = await callSsmExecution(credentialsId, region, [ssmCommand], activeNodeInstanceId!);
            const parsedResp = sqlResponseParsing(resp);
            const objectsOptimized = parsedResp.num_records || 0;
            const optimizeMessage = `Optimized ${objectsOptimized}/${objectsToOptimize.length} ${queryParamKey} ${serverNameWithHostName}`;
            logger.info(optimizeMessage);
            if (objectsOptimized !== objectsToOptimize.length) {
                if (objectsOptimized === 0) {
                    const optimizeErrorMessage = `Failed to optimize  ${objectsToOptimize.length} objects, ${objectsToOptimize} for ${serverNameWithHostName}`;
                    logger.error(`Optimization failed for ${serverNameWithHostName}, ${parsedResp}`);
                    newJobStatus = JOBSTATUS.FAILED;
                    newJobError = optimizeErrorMessage;
                } else {
                    const unOptimizedObjects = objectsToOptimize.filter(obj => !parsedResp.cli_output.includes(obj));
                    const optimizeErrorMessage = `Failed to optimize  ${unOptimizedObjects.length} objects, ${unOptimizedObjects} for ${serverNameWithHostName}.`;
                    newJobStatus = JOBSTATUS.FAILED;
                    newJobError = optimizeErrorMessage;
                }
            } else {
                newJobDescription = optimizeMessage;
                newJobStatus = JOBSTATUS.COMPLETED;
            }
        }
    } catch (error) {
        const errorMessage = `Error while optimizing storage ${error}`;
        logger.error(errorMessage);
        newJobStatus = JOBSTATUS.FAILED;
        newJobError = errorMessage;

        parentJobStatus = JOBSTATUS.FAILED;
        parentJobError = errorMessage;
    } finally {
        await updateJobDetails(accountId, credentialsId, region, jobId, {
            status: newJobStatus,
            endTime: Date.now(),
            error: newJobError,
            description: newJobDescription
        });
        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
            status: parentJobStatus,
            endTime: Date.now(),
            error: parentJobError
        });
    }
}

async function optimizeInstance(params: OptimizeInstanceParams) {
    const { accountId, credentialsId, region, databaseHostId, databaseInstanceId, optimizationTargets } = params;
    logger.info(
        `Optimizing storage for ${accountId}  ${databaseInstanceId} in ${region} for configuration  ${optimizationTargets}`
    );

    if (optimizationTargets && optimizationTargets.length === 0) {
        logger.info(`Optimization body is empty ${databaseInstanceId} in ${region}`);
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Optimization body is empty');
    }

    const {
        items: [resourceDetail]
    } = await getResources(accountId, databaseHostId, credentialsId, region, RESOURCESTYPE.MSSQL);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const { metadata, resource_name: sqlServerName } = resourceDetail;
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId, instancesDetails } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId
    );
    logger.info('instancesDetails', instancesDetails);

    const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
    const {
        fsxn_ids: fsxId,
        database_instance_name: instanceName,
        database_instance_id: instanceId,
        database_type: databaseType,
        fsx_svm_id: svmDetails
    } = instanceDetail as unknown as DatabaseInstance;

    const sqlAuthEnabled =
        instancesDetails && instanceDetail
            ? instancesDetails.some(
                  instance =>
                      instance.instanceName === instanceDetail.database_instance_name &&
                      instance.sqlAuthEnabled === true
              )
            : false;

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        const errorMessage = `Unable to optimize instnace ${instanceName} in host ${sqlServerName} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const serverNameWithHostName = instanceName ? `${sqlServerName}\\${instanceName}` : (sqlServerName as string);
    updateLongRunningAuditGroup(undefined, undefined, serverNameWithHostName);

    // check whether any jobs on the same resource running
    const filterParams = {
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName as string,
        typeFilter: JOBTYPE.OPTIMIZATION
    };
    const {
        items: [job]
    } = await getJobs(accountId, credentialsId, region, filterParams);

    if (job) {
        const timeDifferenceInMinutes = getTimeDifferenceInMinutes(job.startTime);
        if (timeDifferenceInMinutes <= 5) {
            throw createError(
                412,
                `Optimization is not available now since another optimization is in progress with job ID ${job.id}.`
            );
        }
    }

    // create the parent job for optimize operation
    const { id: parentJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.OPTIMIZATION,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName as string,
        name: `Optimize storage for ${serverNameWithHostName}`,
        startTime: Date.now(),
        description: `Optimize storage for ${serverNameWithHostName}`
    });
    logger.debug(`Job created with id ${parentJobId}`);

    const svmDetailsObject = svmDetails as Record<string, string>;
    const svmId = svmDetailsObject ? svmDetailsObject[fsxId] : '';
    try {
        const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
            credentialsId,
            region,
            fsxId as string
        );

        const svmList = fsxSVMs?.find(svm => svm.StorageVirtualMachineId === svmId);
        const svmName = svmList?.Name;

        if (!svmName && !isDemoFlow) {
            const errorMessage = `No SVM with id ${svmId} found for ${fsxId} in ${region}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
        optimizeOperation({
            accountId,
            region,
            credentialsId,
            fsxId,
            activeNodeInstanceId,
            parentJobId,
            serverNameWithHostName,
            instanceId,
            databaseHostId,
            databaseType,
            instanceName,
            sqlAuthEnabled: sqlAuthEnabled || false,
            svmName,
            optimizationTargets,
            awsAccountId: resourceDetail.cloud_provider_account_id
        } as OptimizeOperationParams);
    } catch (error) {
        const errorMessage = `Error while optimizing storage ${error}`;
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

export { optimizeInstance };
