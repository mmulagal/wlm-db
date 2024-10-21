import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import getLogger from '../utils/logger';
import {
    OptimizeStorageVolumeRequestParamsType,
    OptimizeStorageLunRequestParamsType
} from '../routes/types/database-hosts.types';
import { Metadata, DatabaseInstance, WorkloadInstance } from '../utils/common-types';
import {
    RESOURCESTYPE,
    HttpErrorCodes,
    OptimizeStorageVolumeConfigs,
    OptimizeStorageVolumeApiData,
    OptimizeStorageLunApiData,
    OptimizeStorageLunConfigs,
    OptimizeInstanceParams,
    AuditStatus
} from '../utils/consts';
import { callSsmExecution } from './aws/ssm-operations';
import { getResources, getInstanceInfo } from './database/database-operations';
import { OPTIMIZE_STOARGE_PARAMS_SCRIPT } from './workloads/mssql/drift-assessment-scripts';
import { getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { getJobs, registerJob, updateJobDetails } from './database/job-operations';
import { sqlResponseParsing } from '../utils/utils';
import { driftAssesment } from './drift-assessment';
import { describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';

const logger = getLogger();

interface OptimizeStorageParams {
    accountId: string;
    region: string;
    credentialsId: string;
    fsxId: string;
    activeNodeInstanceId: string;
    parentJobId: string;
    optimizeData: OptimizeStorageLunRequestParamsType[] | OptimizeStorageVolumeRequestParamsType[];
    configMap: Record<string, any>;
    apiDataMap: Record<string, any>;
    queryParamKey: string;
    svmName: string;
    serverNameWithHostName: string;
}

interface OptimizeOperationParams {
    accountId: string;
    region: string;
    credentialsId: string;
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
    lunOptimizeData: OptimizeStorageLunRequestParamsType[];
    volumeOptimizeData: OptimizeStorageVolumeRequestParamsType[];
}

async function optimizeOperation(params: OptimizeOperationParams) {
    const {
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
        sqlAuthEnabled,
        svmName,
        lunOptimizeData,
        volumeOptimizeData
    } = params;
    logger.info('Optimizing storage for', serverNameWithHostName, volumeOptimizeData, lunOptimizeData);
    if (lunOptimizeData && lunOptimizeData.length > 0) {
        await optimizeStorage({
            accountId,
            region,
            credentialsId,
            fsxId,
            activeNodeInstanceId: activeNodeInstanceId!,
            parentJobId,
            optimizeData: lunOptimizeData,
            configMap: OptimizeStorageLunConfigs,
            apiDataMap: OptimizeStorageLunApiData,
            queryParamKey: 'path',
            svmName,
            serverNameWithHostName
        });
    }

    if (volumeOptimizeData && volumeOptimizeData.length > 0) {
        await optimizeStorage({
            accountId,
            region,
            credentialsId,
            fsxId,
            activeNodeInstanceId: activeNodeInstanceId!,
            parentJobId,
            optimizeData: volumeOptimizeData,
            configMap: OptimizeStorageVolumeConfigs,
            apiDataMap: OptimizeStorageVolumeApiData,
            queryParamKey: 'volume',
            svmName,
            serverNameWithHostName
        });
    }

    const instancetoAsses: WorkloadInstance = {
        id: instanceId,
        name: instanceName,
        type: databaseType,
        region,
        sqlAuthEnabled: sqlAuthEnabled || false,
        fsxFileSystem: fsxId,
        activeNodeInstanceid: activeNodeInstanceId!
    };

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Assesment for ${serverNameWithHostName} after optimization`,
        description: `Assesment for ${serverNameWithHostName} after optimization`,
        startTime: Date.now(),
        type: JOBTYPE.OPTIMIZE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        parentJobId
    });
    await driftAssesment(accountId, credentialsId, region, jobId, databaseHostId, [instancetoAsses]);
}

async function optimizeStorage(params: OptimizeStorageParams) {
    logger.info('Optimizing storage for', params.serverNameWithHostName, params.optimizeData);
    const {
        accountId,
        region,
        credentialsId,
        fsxId,
        activeNodeInstanceId,
        parentJobId,
        optimizeData,
        configMap,
        apiDataMap,
        queryParamKey,
        svmName,
        serverNameWithHostName
    } = params;
    logger.debug(`Optimizing storage for ${accountId} in ${region} for configuration ${optimizeData}`);
    try {
        const { id: jobId } = await registerJob(accountId, credentialsId, region, {
            name: `Optimize ${queryParamKey} for ${serverNameWithHostName}`,
            description: `Optimize ${queryParamKey} for ${serverNameWithHostName}`,
            startTime: Date.now(),
            type: JOBTYPE.OPTIMIZE,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: serverNameWithHostName,
            parentJobId
        });
        logger.debug(`Job created with id ${jobId}`);
        const { configurationName, objectsToOptimize } = optimizeData[0];
        const configKey = Object.keys(configMap).find(
            key => configMap[key as keyof typeof configMap] === configurationName
        );

        if (!configKey) {
            throw new Error(`${queryParamKey} configuration not found`);
        }

        const apiData = apiDataMap[configKey as keyof typeof apiDataMap];
        const jsonApiBody = JSON.stringify(apiData.body);
        const apiQueryParams = `vserver=${svmName}&${queryParamKey}=${objectsToOptimize.join(',')}`;
        const apiEndpoint = apiData.api;

        const ssmCommand = OPTIMIZE_STOARGE_PARAMS_SCRIPT(fsxId, region, apiEndpoint, apiQueryParams, jsonApiBody);
        const resp = await callSsmExecution(credentialsId, region, [ssmCommand], activeNodeInstanceId!);
        const parsedResp = sqlResponseParsing(resp);
        const objectsOptimized = parsedResp.num_records;
        const optimizeMessage = `Optimized ${objectsOptimized}/${objectsToOptimize.length} ${queryParamKey} ${serverNameWithHostName}, parsedResp.cli_output`;
        logger.debug(optimizeMessage);

        await updateJobDetails(accountId, credentialsId, region, jobId, {
            status: JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            description: optimizeMessage,
            error: undefined
        });
        logger.debug(resp);
    } catch (error) {
        const errorMessage = `Error while optimizing storage ${error}`;
        logger.error(errorMessage);
        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function optimizeInstance(params: OptimizeInstanceParams) {
    const {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        volumeOptimizeData,
        lunOptimizeData
    } = params;
    logger.info(
        `Optimizing storage for ${accountId}  ${databaseInstanceId} in ${region} for configuration  ${volumeOptimizeData} ${lunOptimizeData}`
    );

    if (volumeOptimizeData && volumeOptimizeData.length > 0 && lunOptimizeData && lunOptimizeData.length > 0) {
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

    const { isSSMConnected, activeNodeInstanceId } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId
    );

    const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
    const {
        fsxn_ids: fsxId,
        database_instance_name: instanceName,
        database_instance_id: instanceId,
        database_type: databaseType,
        sqlAuthEnabled,
        fsx_svm_id: svmDetails
    } = instanceDetail as unknown as DatabaseInstance;
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
        typeFilter: JOBTYPE.OPTIMIZE
    };
    const {
        items: [job]
    } = await getJobs(accountId, credentialsId, region, filterParams);

    if (job) {
        // Calculate the time difference in minutes
        const timeDifferenceInMilliseconds = Math.abs(Date.now() - job.startTime);
        const timeDifferenceInMinutes = Math.floor(timeDifferenceInMilliseconds / (1000 * 60));
        if (timeDifferenceInMinutes <= 5) {
            throw createError(
                412,
                `Optimize is not available now on since another optimize is in progress with job ID ${job.id}`
            );
        }
    }

    // create the parent job for optimize operation
    const { id: parentJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.OPTIMIZE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName as string,
        name: `Optimize storage for ${serverNameWithHostName}`,
        startTime: Date.now(),
        description: `Optimize storage for ${serverNameWithHostName}`
    });
    logger.debug(`Job created with id ${parentJobId}`);

    const svmDetailsObject = svmDetails as Record<string, string>;
    const svmId = svmDetailsObject ? svmDetailsObject[fsxId] : '';

    const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
        credentialsId,
        region,
        fsxId as string
    );

    const svmList = fsxSVMs?.filter(svm => svm.StorageVirtualMachineId === svmId) || [];
    const svmName = svmList[0]?.Name;

    if (!svmName) {
        const errorMessage = `No SVM with id ${svmId} found for ${fsxId} in ${region}`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    try {
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
            lunOptimizeData,
            volumeOptimizeData
        } as OptimizeOperationParams);
        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
            status: JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: undefined
        });
        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
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
