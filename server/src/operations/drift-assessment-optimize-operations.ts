import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import getLogger from '../utils/logger';
import {
    OptimizeStorageVolumeRequestParamsType,
    OptimizeStorageLunRequestParamsType
} from '../routes/types/database-hosts.types';
import { Metadata, DatabaseInstance, WorkloadInstance } from '../utils/common-types';
import { RESOURCESTYPE, HttpErrorCodes, AuditStatus } from '../utils/consts';
import { callSsmExecution } from './aws/ssm-operations';
import { getResources, getInstanceInfo } from './database/database-operations';
import { OPTIMIZE_STORAGE_PARAMS_SCRIPT } from './workloads/mssql/drift-assessment-scripts';
import { getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { getJobs, registerJob, updateJobDetails } from './database/job-operations';
import { getTimeDifferenceInMinutes, sqlResponseParsing } from '../utils/utils';
import { driftAssessment } from './drift-assessment';
import { describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import {
    OptimizeStorageLunConfigs,
    OptimizeStorageLunApiData,
    OptimizeStorageVolumeConfigs,
    OptimizeStorageVolumeApiData,
    OptimizeInstanceParams,
    LUN,
    VOLUME,
    QUERY_PARAMS
} from '../utils/continous-optimization-consts';

const logger = getLogger();

interface OptimizeStorageParams {
    accountId: string;
    region: string;
    credentialsId: string;
    fsxId: string;
    activeNodeInstanceId: string;
    parentJobId: string;
    optimizationTargets: OptimizeStorageLunRequestParamsType[] | OptimizeStorageVolumeRequestParamsType[];
    optimizationConfigs: Record<string, any>;
    apiRequestData: Record<string, any>;
    optimizeType: string;
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
    lunoptimizationTargets: OptimizeStorageLunRequestParamsType[];
    volumeoptimizationTargets: OptimizeStorageVolumeRequestParamsType[];
}

async function optimizeOperation(params: OptimizeOperationParams) {
    logger.info('Optimizing storage for', params);
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
        lunoptimizationTargets,
        volumeoptimizationTargets
    } = params;
    if (lunoptimizationTargets && lunoptimizationTargets.length > 0) {
        await optimizeStorage({
            accountId,
            region,
            credentialsId,
            fsxId,
            activeNodeInstanceId: activeNodeInstanceId!,
            parentJobId,
            optimizationTargets: lunoptimizationTargets,
            optimizationConfigs: OptimizeStorageLunConfigs,
            apiRequestData: OptimizeStorageLunApiData,
            optimizeType: LUN,
            svmName,
            serverNameWithHostName
        });
    }

    if (volumeoptimizationTargets && volumeoptimizationTargets.length > 0) {
        await optimizeStorage({
            accountId,
            region,
            credentialsId,
            fsxId,
            activeNodeInstanceId: activeNodeInstanceId!,
            parentJobId,
            optimizationTargets: volumeoptimizationTargets,
            optimizationConfigs: OptimizeStorageVolumeConfigs,
            apiRequestData: OptimizeStorageVolumeApiData,
            optimizeType: VOLUME,
            svmName,
            serverNameWithHostName
        });
    }

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Assessment for ${serverNameWithHostName} after optimization`,
        description: `Assessment for ${serverNameWithHostName} after optimization`,
        startTime: Date.now(),
        type: JOBTYPE.OPTIMIZE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        parentJobId
    });

    const instancetoAsses: WorkloadInstance = {
        id: instanceId,
        name: instanceName,
        type: databaseType,
        region,
        sqlAuthEnabled: sqlAuthEnabled || false,
        fsxFileSystem: fsxId,
        activeNodeInstanceid: activeNodeInstanceId!
    };

    await driftAssessment(accountId, credentialsId, region, jobId, databaseHostId, [instancetoAsses]);

    await updateJobDetails(accountId, credentialsId, region, parentJobId, {
        status: JOBSTATUS.COMPLETED,
        endTime: Date.now()
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
        optimizeType,
        svmName,
        serverNameWithHostName
    } = params;
    logger.info(`Optimizing storage for ${accountId} in ${region} for configuration ${optimizationTargets}`);
    try {
        const { id: jobId } = await registerJob(accountId, credentialsId, region, {
            name: `Optimize ${optimizeType} for ${serverNameWithHostName}`,
            description: `Optimize ${optimizeType} for ${serverNameWithHostName}`,
            startTime: Date.now(),
            type: JOBTYPE.OPTIMIZE,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: serverNameWithHostName,
            parentJobId
        });
        logger.debug(`Job created with id ${jobId}`);
        for (const data of optimizationTargets) {
            const { configurationName, objectsToOptimize } = data;
            const configKey = Object.keys(optimizationConfigs).find(
                key => optimizationConfigs[key as keyof typeof optimizationConfigs] === configurationName
            );

            if (!configKey) {
                throw new Error(`${optimizeType} configuration not found`);
            }

            const apiData = apiRequestData[configKey as keyof typeof apiRequestData];
            const apiBody = JSON.stringify(apiData.body);
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
            const objectsOptimized = parsedResp.num_records;
            const optimizeMessage = `Optimized ${objectsOptimized}/${objectsToOptimize.length} ${queryParamKey} ${serverNameWithHostName}, ${parsedResp.cli_output}`;
            logger.info(optimizeMessage);

            await updateJobDetails(accountId, credentialsId, region, jobId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now(),
                description: optimizeMessage
            });
        }
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
        volumeoptimizationTargets,
        lunoptimizationTargets
    } = params;
    logger.info(
        `Optimizing storage for ${accountId}  ${databaseInstanceId} in ${region} for configuration  ${volumeoptimizationTargets} ${lunoptimizationTargets}`
    );

    if (
        volumeoptimizationTargets &&
        volumeoptimizationTargets.length > 0 &&
        lunoptimizationTargets &&
        lunoptimizationTargets.length > 0
    ) {
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
    try {
        const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
            credentialsId,
            region,
            fsxId as string
        );

        const svmList = fsxSVMs?.find(svm => svm.StorageVirtualMachineId === svmId);
        const svmName = svmList?.Name;

        if (!svmName) {
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
            lunoptimizationTargets,
            volumeoptimizationTargets
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
