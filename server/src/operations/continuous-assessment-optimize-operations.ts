import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import { Metadata, DatabaseInstance, WorkloadInstance, StorageAssessment } from '../utils/common-types';
import { HttpErrorCodes, AuditStatus } from '../utils/consts';
import { callSsmExecution } from './aws/ssm-operations';
import { getInstanceInfo } from './database/database-operations';
import { OPTIMIZE_STORAGE_PARAMS_SCRIPT } from './workloads/mssql/drift-assessment-scripts';
import { getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { getJobs, registerJob, updateJobDetails } from './database/job-operations';
import {
    getTimeDifferenceInMinutes,
    isDemo,
    sleep,
    sqlResponseParsing,
    convertToBytes,
    sizeInGigaBytes
} from '../utils/utils';
import {
    driftAssessmentDataCollection,
    getHeadroomDrift,
    getLogVolumeDrift,
    getTempDbVolumeDrift
} from './continuous-assessment-operations';
import { describeFSxStorageVirtualMachines, updateFsxCapacity, updateFsxVolumeSize } from '../lib/aws/fsx';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import {
    OptimizeStorageParams,
    QUERY_PARAMS,
    OptimizeStorageConfigs,
    OptimizeStorageApiData,
    AssessmentCategories,
    AssessmentStatus,
    OPTIMIZE_SIZING_CONFIGS
} from '../utils/continous-optimization-consts';
import getLogger from '../utils/logger';
import { listDatabaseInstanceConfigData } from '../lib/database/database-instance-config';
import { OptimizeStorageRequestParamsType } from '../routes/types/continuous-assessment.types';

const isDemoFlow = isDemo();

const logger = getLogger();

interface OptimizeStorageAttributeParams {
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

interface OptimizeStorageOperationParams {
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

async function optimizeStorageAttributes(params: OptimizeStorageOperationParams) {
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
        await optimizeOntapStorage({
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

    // its required to sleep for 5 seconds so that the optimization is completed before drift assessment
    if (!isDemoFlow) {
        await sleep(5000);
    }

    await driftAssessmentDataCollection(accountId, credentialsId, region, jobId, databaseHostId, [instanceToAssess]);
    await updateJobDetails(accountId, credentialsId, region, parentJobId, {
        status: JOBSTATUS.COMPLETED,
        endTime: Date.now(),
        description: `Optimization completed for ${serverNameWithHostName}`
    });
    updateLongRunningAuditGroup(AuditStatus.SUCCESS);
}

async function optimizeOntapStorage(params: OptimizeStorageAttributeParams) {
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
    logger.info(`Optimizing ONTAP storage for ${accountId} in ${region} for configuration ${optimizationTargets}`);

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

async function optimizeStorage(params: OptimizeStorageParams) {
    const { accountId, credentialsId, region, databaseHostId, databaseInstanceId, optimizationTargets } = params;
    logger.info(
        `Optimizing storage for ${accountId}  ${databaseInstanceId} in ${region} for configuration  ${optimizationTargets}`
    );

    if (optimizationTargets && optimizationTargets.length === 0) {
        logger.info(`Optimization body is empty ${databaseInstanceId} in ${region}`);
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Optimization body is empty');
    }

    const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
    const {
        fsxn_ids: fsxId,
        database_instance_name: instanceName,
        database_instance_id: instanceId,
        database_type: databaseType,
        fsx_svm_id: svmDetails,
        resource: resourceDetail
    } = instanceDetail as unknown as DatabaseInstance;

    const { metadata, resource_name: sqlServerName } = resourceDetail;
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId, instancesDetails } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId
    );
    logger.info('instancesDetails', instancesDetails);
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

    // check whether any jobs on the same resource running
    const serverNameWithHostName = getServerNameWithHostname(sqlServerName!, instanceName);
    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.OPTIMIZATION,
        `Optimize storage for ${serverNameWithHostName}`,
        `Optimize storage for ${serverNameWithHostName}`
    );

    const svmDetailsObject = svmDetails as Record<string, string>;
    const svmId = svmDetailsObject ? svmDetailsObject[fsxId] : '';
    try {
        const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
            credentialsId,
            region,
            fsxId as string
        );

        const { Name: svmName } = fsxSVMs?.find(svm => svm.StorageVirtualMachineId === svmId) || {};

        if (!svmName && !isDemoFlow) {
            const errorMessage = `No SVM with id ${svmId} found for ${fsxId} in ${region}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
        optimizeStorageAttributes({
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
        } as OptimizeStorageOperationParams);
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

async function modifySizingAttributes(
    accountId: string,
    credentialsId: string,
    region: string,
    filesystemId: string,
    typesList: string[],
    parentJobId: string,
    configData: StorageAssessment
) {
    logger.info('Modifying sizing attributes ', {
        accountId,
        credentialsId,
        region,
        filesystemId,
        typesList,
        parentJobId
    });
    let errorMessage = '';
    let jobStatus;
    try {
        for (const type of typesList) {
            switch (type) {
                case OPTIMIZE_SIZING_CONFIGS.HEADROOM:
                    await headroomOptimization(accountId, credentialsId, region, filesystemId, parentJobId);
                    break;
                case OPTIMIZE_SIZING_CONFIGS.LOG_DRIVE_SIZE: {
                    const {
                        sizing: { 'data-log-drive-details': logDriveDetails }
                    } = configData as unknown as StorageAssessment;
                    await logDriveOptimization(
                        accountId,
                        credentialsId,
                        region,
                        filesystemId,
                        logDriveDetails,
                        parentJobId
                    );
                    break;
                }
                case OPTIMIZE_SIZING_CONFIGS.TEMPDB_DRIVE_SIZE: {
                    const {
                        sizing: { 'data-tempdb-drive-details': tempdbDriveDetails }
                    } = configData as unknown as StorageAssessment;
                    await tempDbDriveOptimization(
                        accountId,
                        credentialsId,
                        region,
                        filesystemId,
                        tempdbDriveDetails,
                        parentJobId
                    );
                    break;
                }
                default:
                    throw new Error('Invalid optimization type');
            }
        }
        jobStatus = JOBSTATUS.COMPLETED;
        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } catch (error) {
        errorMessage = `Error while optimizing sizing ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
}
async function optimizeSizing(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    types: string
) {
    logger.info('Optimizing sizing ', { accountId, credentialsId, region, databaseHostId, databaseInstanceId, types });

    const typesList = types.split(',');
    if (typesList.length === 0) {
        logger.info(`Optimization body is empty ${databaseInstanceId} in ${region}`);
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Optimization body is empty');
    } else {
        typesList.forEach(
            type =>
                OPTIMIZE_SIZING_CONFIGS[type as keyof typeof OPTIMIZE_SIZING_CONFIGS] ||
                createError(HttpErrorCodes.BAD_REQUEST, 'Invalid optimization type')
        );
    }
    const [persistedConfigurationData] = await listDatabaseInstanceConfigData(
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseInstanceId,
        AssessmentCategories.STORAGE
    );
    const {
        config_data: configData,
        database_instances: { database_instance_name: instanceName },
        resource: { resource_name: sqlServerName }
    } = persistedConfigurationData;
    const storageAssessmentConfigData = configData as unknown as StorageAssessment;
    const { filesystemId } = storageAssessmentConfigData;

    const serverNameWithHostName = getServerNameWithHostname(sqlServerName!, instanceName);
    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.OPTIMIZATION,
        `Optimize ${types} sizing for ${serverNameWithHostName}`,
        `Optimize ${types} sizing for ${serverNameWithHostName}`
    );

    modifySizingAttributes(
        accountId,
        credentialsId,
        region,
        filesystemId,
        typesList,
        parentJobId,
        storageAssessmentConfigData
    );

    return { parentJobId };
}

async function headroomOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    parentJobId: string
) {
    logger.info('Optimizing FSx for NetApp ONTAP headroom ', { accountId, credentialsId, region, fileSystemId });
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        fileSystemId,
        JOBTYPE.OPTIMIZATION,
        'Optimize FSx for NetApp ONTAP headroom',
        'Optimize FSx for NetApp ONTAP headroom',
        parentJobId
    );

    let jobStatus;
    let errorMessage;
    try {
        const { headroomPercent, ssdStorageCapacityInBytes, totalVolumeSizeInBytes } = await getHeadroomDrift(
            credentialsId,
            region,
            fileSystemId
        );

        if (headroomPercent < 35) {
            logger.info('Under provisioned: Headroom is less than 35%');
            let newFsxStorageCapacity = totalVolumeSizeInBytes / 0.64;
            const increase = ((newFsxStorageCapacity - ssdStorageCapacityInBytes) / ssdStorageCapacityInBytes) * 100;
            // increase newFsxStorageCapactiy so that increment is atleast 10%
            newFsxStorageCapacity = increase > 10 ? newFsxStorageCapacity : ssdStorageCapacityInBytes * 1.1;

            const newFsxStorageCapactiyGiB = sizeInGigaBytes(newFsxStorageCapacity);
            return updateFsxCapacity(credentialsId, region, accountId, fileSystemId, newFsxStorageCapactiyGiB);
        }
        errorMessage = 'Headroom is more than 35%, no action required';
        jobStatus = JOBSTATUS.WARNING;
    } catch (error) {
        errorMessage = `Error while optimizing headroom sizing ${error}`;
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, credentialsId, region, jobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
}

async function logDriveOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    logDriveDetails: any,
    parentJobId: string
) {
    logger.info('Optimizing log drive ', { accountId, credentialsId, region, fileSystemId, logDriveDetails });
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        fileSystemId,
        JOBTYPE.OPTIMIZATION,
        'Optimize log drive sizing',
        'Optimize log drive sizing',
        parentJobId
    );

    const { underProvisionedDrives } = getLogVolumeDrift(
        logDriveDetails,
        AssessmentStatus.UNDER_PROVISIONED,
        'log-drive-size'
    );
    let jobStatus;
    let errorMessage;
    try {
        if (underProvisionedDrives.length > 0) {
            logger.info(
                'Under provisioned: Log drives are under provisioned',
                underProvisionedDrives.map((drive: any) => drive.driveName)
            );
            await Promise.all(
                underProvisionedDrives.map(async (drive: any) => {
                    const { dataVolumeSizeInBytes } = drive;
                    const requiredLogVolumeSizeBytes = dataVolumeSizeInBytes * 0.25; // Increase log volume to 25% of data volume

                    await updateFsxVolumeSize(
                        credentialsId,
                        region,
                        accountId,
                        fileSystemId,
                        requiredLogVolumeSizeBytes
                    );
                    logger.info(`Log volume size increased to ${requiredLogVolumeSizeBytes} bytes.`);
                })
            );
            jobStatus = JOBSTATUS.COMPLETED;

            updateLongRunningAuditGroup(AuditStatus.SUCCESS, errorMessage);
        } else {
            errorMessage = 'Log drives are not under provisioned, no action required';
            jobStatus = JOBSTATUS.WARNING;
        }
    } catch (error) {
        errorMessage = `Error while optimizing tempDb sizing ${error}`;
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, credentialsId, region, jobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
}

async function tempDbDriveOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    tempDbDriveDetails: any,
    parentJobId: string
) {
    logger.info('Optimizing temp db drive ', { accountId, credentialsId, region, fileSystemId, tempDbDriveDetails });
    let errorMessage = '';
    let jobStatus;
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        fileSystemId,
        JOBTYPE.OPTIMIZATION,
        'Optimize tempdb drive sizing',
        'Optimize tempdb drive sizing',
        parentJobId
    );

    try {
        const { defaultDataDriveSize, tempdbPercent } = getTempDbVolumeDrift(
            tempDbDriveDetails,
            AssessmentStatus.UNDER_PROVISIONED,
            'tempdb-drive-size'
        );

        if (tempdbPercent < 10) {
            const defaultDataDriveSizeBytes = convertToBytes(defaultDataDriveSize, 'MiB') || 0;

            const requiredTempDbVolumeSizeBytes = defaultDataDriveSizeBytes * 0.1; // Increase tempDB volume to 10% of data volume

            await updateFsxVolumeSize(credentialsId, region, accountId, fileSystemId, requiredTempDbVolumeSizeBytes);

            jobStatus = JOBSTATUS.COMPLETED;

            updateLongRunningAuditGroup(AuditStatus.SUCCESS, errorMessage);
        } else {
            errorMessage = 'TempDB drives are not under provisioned, no action required';
            jobStatus = JOBSTATUS.WARNING;
        }
    } catch (error) {
        errorMessage = `Error while optimizing tempDb sizing ${error}`;
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, credentialsId, region, jobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
}

function getServerNameWithHostname(sqlServerName: string, instanceName: string) {
    return instanceName && sqlServerName ? `${sqlServerName}\\${instanceName}` : (sqlServerName as string);
}

async function handleOptimizeJobCreation(
    accountId: string,
    credentialsId: string,
    region: string,
    serverNameWithHostName: string,
    jobType: string,
    jobName: string,
    jobDescription: string,
    parentJobId?: string
) {
    updateLongRunningAuditGroup(undefined, undefined, serverNameWithHostName);

    const filterParams = {
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName as string,
        typeFilter: jobType,
        ...(parentJobId && { parentJobId })
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
    const { id } = await registerJob(accountId, credentialsId, region, {
        type: jobType,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName as string,
        name: jobName,
        startTime: Date.now(),
        description: jobDescription,
        ...(parentJobId && { parentJobId })
    });
    logger.debug(`Job created with id ${id}`);

    return id;
}
export { optimizeStorage, optimizeSizing };
