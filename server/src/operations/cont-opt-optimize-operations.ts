import { JOBSTATUS, JOBTYPE, resource } from '@prisma/client';
import createError from 'http-errors';
import { cloneDeep, compact, isEmpty } from 'lodash-es';
import { Volume } from '@aws-sdk/client-fsx';
import {
    Metadata,
    DatabaseInstance,
    WorkloadInstance,
    StorageAssessment,
    databaseInstanceMetadata,
    OptimizeMpioPolicyParams,
    LogDriveDetails,
    TempDbDriveDetails
} from '../utils/common-types';
import { HttpErrorCodes, AuditStatus, SqlServerDeploymentModel, RESOURCESTYPE } from '../utils/consts';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import { getInstanceInfo, getResources } from './database/database-operations';
import {
    CHECK_NODE_STATUS,
    GET_ONTAP_LUN_DETAILS,
    MOVE_ALL_CLUSTER_GROUPS,
    OPTIMIZE_STORAGE_PARAMS_SCRIPT,
    RESCAN_EXTEND_LUN
} from './workloads/mssql/continuous-optimization-scripts';
import { getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { getJobs, registerJob, updateJobDetails } from './database/job-operations';
import {
    getTimeDifferenceInMinutes,
    isDemo,
    sleep,
    sqlResponseParsing,
    convertToBytes,
    getResourceNameFromTags,
    calculateFsxStorageCapacityForHeadroomOptimization
} from '../utils/utils';
import {
    calculateComputeDrift,
    getHeadroomDrift,
    getLogVolumeDrift,
    getTempDbVolumeDrift,
    onDemandTriggerDriftAssessmentDataCollection
} from './cont-opt-assessment-operations';
import { describeFSx, describeFSxStorageVirtualMachines, updateFsxCapacity } from '../lib/aws/fsx';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import {
    OptimizeStorageParams,
    QUERY_PARAMS,
    OptimizeStorageConfigs,
    OptimizeStorageApiData,
    AssessmentCategories,
    AssessmentStatus,
    OPTIMIZE_SIZING_CONFIGS,
    AssessmentTriggeredBy,
    OptimizeOperatingSystemParams
} from '../utils/continous-optimization-consts';
import getLogger from '../utils/logger';
import { listDatabaseInstanceConfigData } from '../lib/database/database-instance-config';
import {
    OptimizeStorageRequestParamsType,
    SizingViolationResponseType
} from '../routes/types/continuous-optimization.types';
import {
    getFsxVolumeDetails,
    getFsxnVolIdsFromOntapVolIds,
    updateVolumeSizeAndWaitForUpdate
} from './aws/fsx-operations';
import { updateOptimizedConfigNameInInstanceTable } from './demo-operations';
import { CHECK_MPIO_POLICY, REMEDIATE_MPIO_POLICY } from './workloads/mssql/mpio-remediation-scripts';
import { describeInstance, modifyInstanceType, startInstance, stopInstance, waitForInstanceOk } from '../lib/aws/ec2';
import {
    getInstanceDetailsByPrivateIp,
    instanceTypeChangePreReqs,
    waitForInstanceToBeStopped
} from './aws/ec2-operations';
import { listResources, updateResourceMetaData } from '../lib/database/db';
import { CLUSTER_NETWORK_IP_INFO_PS1, FAILURE_INFO } from './workloads/mssql/discover-consts';
import { listJobs } from '../lib/database/job';

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
    instanceMetadata?: databaseInstanceMetadata;
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
        region,
        credentialsId,
        ...(parentJobId && { parentJobId })
    };
    const {
        items: [job]
    } = await getJobs(accountId, filterParams);

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

async function triggerAssessmentAfterOptimization(
    credentialsId: string,
    region: string,
    accountId: string,
    databaseHostId: string,
    serverNameWithHostName: string,
    parentJobId: string,
    instanceToAssess: WorkloadInstance
) {
    logger.info('Triggering assessment after optimization', {
        credentialsId,
        region,
        accountId,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        instanceToAssess
    });

    // its required to sleep for 5 seconds so that the optimization is completed before drift assessment
    if (!isDemoFlow) {
        await sleep(5000);
    }

    await onDemandTriggerDriftAssessmentDataCollection(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        instanceToAssess.id,
        AssessmentTriggeredBy.SYSTEM,
        '',
        parentJobId
    );

    let masterJobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    let retries = 5;
    while (retries > 0) {
        retries -= 1;
        const allSubJobs = await listJobs(accountId, '', '', parentJobId);
        masterJobStatus = allSubJobs.some(job => job.status === JOBSTATUS.IN_PROGRESS)
            ? JOBSTATUS.IN_PROGRESS
            : allSubJobs.every(job => job.status === JOBSTATUS.FAILED)
            ? JOBSTATUS.FAILED
            : allSubJobs.every(job => job.status === JOBSTATUS.COMPLETED)
            ? JOBSTATUS.COMPLETED
            : allSubJobs.some(job => job.status === JOBSTATUS.FAILED || job.status === JOBSTATUS.WARNING)
            ? JOBSTATUS.WARNING
            : JOBSTATUS.IN_PROGRESS;
        if (masterJobStatus !== JOBSTATUS.IN_PROGRESS || retries === 0) {
            break;
        }
        await sleep(30000);
    }

    await updateJobDetails(accountId, parentJobId, {
        status: masterJobStatus,
        endTime: Date.now(),
        description: `Optimization completed for ${serverNameWithHostName}`
    });
    updateLongRunningAuditGroup(AuditStatus.SUCCESS);
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
        optimizationTargets,
        instanceMetadata
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

    if (isDemoFlow) {
        // update metadata in nstances table to mark optimized configuration
        const configurationNames: string[] = optimizationTargets.map(config => config.configurationName);

        await updateOptimizedConfigNameInInstanceTable(
            accountId,
            instanceId,
            configurationNames,
            'STORAGE',
            instanceMetadata || { configsOptimized: {} }
        );
    }
    await triggerAssessmentAfterOptimization(
        credentialsId,
        region,
        accountId,
        databaseHostId,
        serverNameWithHostName,
        parentJobId,
        instanceToAssess
    );
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
        await updateJobDetails(accountId, jobId, {
            status: newJobStatus,
            endTime: Date.now(),
            error: newJobError,
            description: newJobDescription
        });
        await updateJobDetails(accountId, parentJobId, {
            status: parentJobStatus,
            endTime: Date.now(),
            error: parentJobError
        });
    }
}

async function activeSqlNodeDetails(
    credentialsId: string,
    region: string,
    accountId: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Getting active node details', {
        credentialsId,
        region,
        accountId,
        databaseHostId,
        databaseInstanceId
    });

    const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);

    const {
        fsxn_ids: fsxId,
        database_instance_name: instanceName,
        database_instance_id: instanceId,
        database_type: databaseType,
        fsx_svm_id: svmDetails,
        resource: resourceDetail,
        metadata: instanceMetadata
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

    const serverNameWithHostName = getServerNameWithHostname(sqlServerName!, instanceName);

    return {
        sqlAuthEnabled,
        activeNodeInstanceId,
        fsxId,
        instanceId,
        instanceName,
        sqlServerName,
        databaseType,
        svmDetails,
        awsAccountId: resourceDetail.cloud_provider_account_id,
        serverNameWithHostName,
        instanceMetadata
    };
}

async function getSvmNameFromId(credentialsId: string, region: string, fsxId: string, svmId: string) {
    logger.info('Getting SVM name from id', { credentialsId, region, fsxId, svmId });

    const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
        credentialsId,
        region,
        fsxId as string
    );

    const { Name: svmName } = fsxSVMs?.find(svm => svm.StorageVirtualMachineId === svmId) || {};

    return svmName;
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

    const {
        sqlAuthEnabled,
        activeNodeInstanceId,
        fsxId,
        instanceId,
        instanceName,
        databaseType,
        svmDetails,
        awsAccountId,
        serverNameWithHostName,
        instanceMetadata
    } = await activeSqlNodeDetails(credentialsId, region, accountId, databaseHostId, databaseInstanceId);
    // check whether any jobs on the same resource running
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
        const svmName = await getSvmNameFromId(credentialsId, region, fsxId, svmId);
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
            awsAccountId,
            instanceMetadata
        } as OptimizeStorageOperationParams);
    } catch (error) {
        const errorMessage = `Error while optimizing storage ${error}`;
        logger.error(errorMessage);
        await updateJobDetails(accountId, parentJobId, {
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
    typesList: OPTIMIZE_SIZING_CONFIGS[],
    parentJobId: string,
    configData: StorageAssessment,
    serverNameWithHostName: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Modifying sizing attributes ', {
        accountId,
        credentialsId,
        region,
        filesystemId,
        typesList,
        parentJobId,
        configData,
        serverNameWithHostName,
        databaseHostId,
        databaseInstanceId
    });
    let errorMessage = '';
    let jobStatus;
    try {
        const {
            sqlAuthEnabled,
            activeNodeInstanceId,
            fsxId,
            instanceId,
            instanceName,
            databaseType,
            awsAccountId,
            instanceMetadata
        } = await activeSqlNodeDetails(credentialsId, region, accountId, databaseHostId, databaseInstanceId);

        if (!activeNodeInstanceId) {
            errorMessage = `Unable to retrieve the active node instance ID from the MS SQL configuration. Drive size optimization for the database instance ${databaseInstanceId} cannot be performed.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        const childJobsStatus = [];
        for (const type of typesList) {
            switch (type) {
                case OPTIMIZE_SIZING_CONFIGS.HEADROOM: {
                    const result = await headroomOptimization(
                        accountId,
                        credentialsId,
                        region,
                        filesystemId,
                        parentJobId
                    );
                    childJobsStatus.push(result);
                    break;
                }
                case OPTIMIZE_SIZING_CONFIGS.LOG_DRIVE_SIZE: {
                    const {
                        sizing: { 'data-log-drive-details': logDriveDetails }
                    } = configData as unknown as StorageAssessment;
                    const result = await logDriveOptimization(
                        accountId,
                        credentialsId,
                        region,
                        filesystemId,
                        logDriveDetails,
                        parentJobId,
                        serverNameWithHostName,
                        databaseHostId,
                        databaseInstanceId,
                        activeNodeInstanceId
                    );
                    childJobsStatus.push(result);
                    break;
                }
                case OPTIMIZE_SIZING_CONFIGS.TEMPDB_DRIVE_SIZE: {
                    const {
                        sizing: { 'data-tempdb-drive-details': tempdbDriveDetails }
                    } = configData as unknown as StorageAssessment;
                    const result = await tempDbDriveOptimization(
                        accountId,
                        credentialsId,
                        region,
                        filesystemId,
                        tempdbDriveDetails,
                        parentJobId,
                        serverNameWithHostName,
                        databaseHostId,
                        databaseInstanceId,
                        activeNodeInstanceId
                    );
                    childJobsStatus.push(result);
                    break;
                }
                default:
                    throw createError('Invalid optimization type');
            }
        }

        if (isDemoFlow) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                instanceId,
                typesList,
                'SIZING',
                instanceMetadata as databaseInstanceMetadata
            );
        }

        if (childJobsStatus.some(job => job?.jobStatus !== JOBSTATUS.FAILED)) {
            // run assessment only if any of the child jobs are not failed (completed or warning - run assessment if its either of them)
            const instanceToAssess: WorkloadInstance = {
                id: instanceId,
                name: instanceName,
                type: databaseType,
                region,
                sqlAuthEnabled: sqlAuthEnabled || false,
                fsxFileSystem: fsxId,
                activeNodeInstanceid: activeNodeInstanceId!,
                cloudProviderAccountId: awsAccountId!,
                resourceName: serverNameWithHostName
            };

            await triggerAssessmentAfterOptimization(
                credentialsId,
                region,
                accountId,
                databaseHostId,
                serverNameWithHostName,
                parentJobId,
                instanceToAssess
            );
            jobStatus = childJobsStatus.some(job => job?.jobStatus === JOBSTATUS.WARNING)
                ? JOBSTATUS.WARNING
                : JOBSTATUS.COMPLETED;
            updateLongRunningAuditGroup(AuditStatus.SUCCESS);
        } else {
            jobStatus = JOBSTATUS.FAILED;
            updateLongRunningAuditGroup(AuditStatus.FAILED, 'Failed to optimize sizing');
        }
    } catch (error) {
        errorMessage = `Error while optimizing sizing: ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, parentJobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
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

            const fsxInfo = await describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId] });
            const [fileSystem = {}] = fsxInfo?.FileSystems || []; // first item in the list
            const existingFsxStorageCapacityGiB = fileSystem?.StorageCapacity;
            const newFsxStorageCapactiyGiB = calculateFsxStorageCapacityForHeadroomOptimization(
                totalVolumeSizeInBytes,
                ssdStorageCapacityInBytes
            );
            if (existingFsxStorageCapacityGiB && existingFsxStorageCapacityGiB < newFsxStorageCapactiyGiB) {
                return updateFsxCapacity(credentialsId, region, accountId, fileSystemId, newFsxStorageCapactiyGiB);
            }
            errorMessage =
                'Headroom configuration has been changed since we last assessed. It aligns with best practice recommendations now, no action required';
            jobStatus = JOBSTATUS.WARNING;
        }
        errorMessage = 'Headroom is more than 35%, no action required';
        jobStatus = JOBSTATUS.WARNING;
    } catch (error) {
        errorMessage = `Error while optimizing headroom sizing ${error}`;
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
    return { jobStatus, errorMessage };
}

async function resizeLun(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    lunUuid: string,
    diskSerialNumber: string,
    requiredLunSizeBytes: number,
    activeNodeInstanceId: string
) {
    logger.info('Resizing LUN ', {
        credentialsId,
        region,
        fileSystemId,
        lunUuid,
        diskSerialNumber,
        requiredLunSizeBytes,
        activeNodeInstanceId
    });

    const apiEndpoint = `/storage/luns/${lunUuid}`;

    const ssmCommand = OPTIMIZE_STORAGE_PARAMS_SCRIPT({
        fsxId: fileSystemId,
        region,
        apiEndpoint,
        apiQueryFilter: '',
        apiBody: JSON.stringify({ space: { size: requiredLunSizeBytes } })
    });

    const rescanExtendLunSsmCommand = RESCAN_EXTEND_LUN(diskSerialNumber);
    try {
        await callSsmExecution(credentialsId, region, [ssmCommand, rescanExtendLunSsmCommand], activeNodeInstanceId);
    } catch (error) {
        throw createError(400, `Error while resizing LUN ${error}`);
    }
}

async function logDriveOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    logDriveDetails: LogDriveDetails[],
    parentJobId: string,
    serverNameWithHostName: string,
    databaseHostId: string,
    databaseInstanceId: string,
    activeNodeInstanceId: string
) {
    logger.info('Optimizing log drive ', {
        accountId,
        credentialsId,
        region,
        fileSystemId,
        logDriveDetails,
        parentJobId,
        serverNameWithHostName,
        databaseHostId,
        databaseInstanceId,
        activeNodeInstanceId
    });
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
    let jobStatus: string = '';
    let errorMessage: string = '';
    try {
        if (underProvisionedDrives.length > 0) {
            const underProvisionedOntapVolIds =
                compact(underProvisionedDrives.map(drive => drive.ontapVolumeUuid)) || [];

            const { volumeIds: fsxVolumeIdList, uuidVolumeIdMap } = await getFsxnVolIdsFromOntapVolIds(
                credentialsId,
                region,
                fileSystemId,
                underProvisionedOntapVolIds
            );

            const underProvisionedVolumeDetails = await getFsxVolumeDetails(
                credentialsId,
                region,
                fileSystemId,
                fsxVolumeIdList
            );

            await Promise.all(
                underProvisionedDrives.map(async (drive: SizingViolationResponseType) => {
                    const { dataDriveTotalSizeMB = 0, lunUuid, diskSerialNumber, ontapVolumeUuid } = drive;
                    if (dataDriveTotalSizeMB > 0) {
                        const requiredLogLunSizeBytes = convertToBytes(dataDriveTotalSizeMB * 0.25, 'MiB') || 0;
                        const requiredLogVolumeSizeBytes = 1.1 * requiredLogLunSizeBytes;

                        const [matchingFsxVolumeId] =
                            Object.entries(uuidVolumeIdMap).find(
                                ([, ontapVolumeId]) => ontapVolumeId === ontapVolumeUuid
                            ) || [];
                        const existingVolumeDetails = underProvisionedVolumeDetails.find(
                            volume => volume.VolumeId === matchingFsxVolumeId
                        );

                        if (matchingFsxVolumeId && existingVolumeDetails && lunUuid && diskSerialNumber) {
                            ({ errorMessage, jobStatus } = await resizeVolumeAndLunSize(
                                'Log',
                                existingVolumeDetails,
                                requiredLogVolumeSizeBytes,
                                credentialsId,
                                region,
                                accountId,
                                fileSystemId,
                                matchingFsxVolumeId,
                                lunUuid,
                                activeNodeInstanceId,
                                requiredLogLunSizeBytes,
                                diskSerialNumber,
                                errorMessage,
                                jobStatus
                            ));
                        } else {
                            throw createError(400, 'Cannot find matching FSx volume or LUN for the log drive');
                        }
                    } else {
                        throw createError(400, 'Data drive size is unavailable, cannot calculate log drive size');
                    }
                })
            );
        } else {
            errorMessage = 'Log drives are not under provisioned, no action required';
            jobStatus = JOBSTATUS.WARNING;
        }
    } catch (error) {
        errorMessage = `Error while optimizing log volume sizing ${error}`;
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
    return { jobStatus, errorMessage };
}

async function resizeVolumeAndLunSize(
    driveType: string,
    existingVolumeDetails: Volume,
    requiredVolumeSizeBytes: number,
    credentialsId: string,
    region: string,
    accountId: string,
    fileSystemId: string,
    matchingFsxVolumeId: string,
    lunUuid: string,
    activeNodeInstanceId: string,
    requiredLunSizeBytes: number,
    diskSerialNumber: string,
    errorMessage: string,
    jobStatus: string
) {
    logger.info('Resizing volume and LUN size ', {
        driveType,
        existingVolumeDetails,
        requiredVolumeSizeBytes,
        credentialsId,
        region,
        accountId,
        fileSystemId,
        matchingFsxVolumeId,
        lunUuid,
        activeNodeInstanceId,
        requiredLunSizeBytes,
        diskSerialNumber,
        errorMessage,
        jobStatus
    });

    if (
        existingVolumeDetails?.OntapConfiguration?.SizeInBytes &&
        existingVolumeDetails.OntapConfiguration.SizeInBytes < requiredVolumeSizeBytes
    ) {
        requiredVolumeSizeBytes = Math.round(requiredVolumeSizeBytes); // rounding off to nearest integer
        await updateVolumeSizeAndWaitForUpdate(
            credentialsId,
            region,
            accountId,
            fileSystemId,
            matchingFsxVolumeId,
            requiredVolumeSizeBytes
        );
        logger.info(`${driveType} volume size increased to ${requiredVolumeSizeBytes} bytes.`);
    } else {
        logger.info(`${driveType} volume size changed since we last assessed, no action required`);
    }

    const ssmCommand = GET_ONTAP_LUN_DETAILS({
        fsxId: fileSystemId,
        region,
        apiEndpoint: `/storage/luns/${lunUuid}`,
        apiQueryFilter: 'fields=space'
    });

    const resp = await callSsmExecution(credentialsId, region, [ssmCommand], activeNodeInstanceId!);
    const parsedResp = sqlResponseParsing(resp);
    const {
        space: { size: existingLogLunSizeBytes }
    } = parsedResp || {};
    if (existingLogLunSizeBytes < requiredLunSizeBytes) {
        await resizeLun(
            credentialsId,
            region,
            fileSystemId,
            lunUuid!,
            diskSerialNumber!,
            requiredLunSizeBytes,
            activeNodeInstanceId
        );
        logger.info(`${driveType} LUN size increased to ${requiredLunSizeBytes} bytes.`);
    } else {
        logger.info(`${driveType} LUN size changed since we last assessed, no action required`);
    }

    if (
        existingVolumeDetails?.OntapConfiguration?.SizeInBytes &&
        existingVolumeDetails.OntapConfiguration.SizeInBytes >= requiredLunSizeBytes &&
        existingLogLunSizeBytes >= requiredLunSizeBytes
    ) {
        errorMessage = `${driveType} drives configuration changed since we last assessed, no action required for those`;
        jobStatus = JOBSTATUS.WARNING;
    }
    return { errorMessage, jobStatus };
}

async function tempDbDriveOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    tempDbDriveDetails: TempDbDriveDetails,
    parentJobId: string,
    serverNameWithHostName: string,
    databaseHostId: string,
    databaseInstanceId: string,
    activeNodeInstanceId: string
) {
    logger.info('Optimizing temp db drive ', {
        accountId,
        credentialsId,
        region,
        fileSystemId,
        tempDbDriveDetails,
        parentJobId,
        serverNameWithHostName,
        databaseHostId,
        databaseInstanceId,
        activeNodeInstanceId
    });
    let errorMessage = '';
    let jobStatus = '';
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
        const { dataDriveTotalSizeMB, tempdbPercent, ontapVolumeUuid, underProvisionedDrives } = getTempDbVolumeDrift(
            tempDbDriveDetails,
            AssessmentStatus.UNDER_PROVISIONED,
            'tempdb-drive-size'
        );

        if (tempdbPercent < 10) {
            const [{ diskSerialNumber, lunUuid }] = underProvisionedDrives;
            const requiredTempDbLunSizeBytes = convertToBytes(dataDriveTotalSizeMB * 0.1, 'MiB') || 0;
            const requiredTempDbVolumeSizeBytes = 1.1 * requiredTempDbLunSizeBytes;

            // get the volume ID from the drive details, make a get call to check if the volume size is less than requiredTempDbVolumeSizeBytes and update the volume size
            const {
                volumeIds: [tempDbFsxVolumeId]
            } = await getFsxnVolIdsFromOntapVolIds(credentialsId, region, fileSystemId, [ontapVolumeUuid]);

            const [existingVolumeDetails] = await getFsxVolumeDetails(credentialsId, region, fileSystemId, [
                tempDbFsxVolumeId
            ]);

            if (diskSerialNumber && lunUuid) {
                ({ errorMessage, jobStatus } = await resizeVolumeAndLunSize(
                    'TempDb',
                    existingVolumeDetails,
                    requiredTempDbVolumeSizeBytes,
                    credentialsId,
                    region,
                    accountId,
                    fileSystemId,
                    tempDbFsxVolumeId,
                    lunUuid,
                    activeNodeInstanceId,
                    requiredTempDbLunSizeBytes,
                    diskSerialNumber,
                    errorMessage,
                    jobStatus
                ));
            } else {
                throw createError(400, 'Cannot find LUN for the tempdb drive');
            }
        } else {
            errorMessage = 'TempDB drives are not under provisioned, no action required';
            jobStatus = JOBSTATUS.WARNING;
        }
    } catch (error) {
        errorMessage = `Error while optimizing tempDb sizing ${error}`;
        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
    return { jobStatus, errorMessage };
}

function getServerNameWithHostname(sqlServerName: string, instanceName: string) {
    return instanceName && sqlServerName ? `${sqlServerName}\\${instanceName}` : (sqlServerName as string);
}

async function optimizeSizing(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    types: OPTIMIZE_SIZING_CONFIGS[]
) {
    logger.info('Optimizing sizing ', { accountId, credentialsId, region, databaseHostId, databaseInstanceId, types });

    if (types.length === 0) {
        logger.info(`Optimization body is empty ${databaseInstanceId} in ${region}`);
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Optimization body is empty');
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
        database_instances: { database_instance_name: instanceName = '' } = {},
        resource: { resource_name: sqlServerName = '' } = {}
    } = persistedConfigurationData || {};
    const storageAssessmentConfigData = configData as unknown as StorageAssessment;
    const { filesystemId = '' } = storageAssessmentConfigData || {};

    if (!instanceName || !sqlServerName) {
        logger.error('Instance name or sql server name is missing');
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Instance name or sql server name is missing');
    }

    const serverNameWithHostName = getServerNameWithHostname(sqlServerName, instanceName);
    const jobId = await handleOptimizeJobCreation(
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
        types,
        jobId,
        storageAssessmentConfigData,
        serverNameWithHostName,
        databaseHostId,
        databaseInstanceId
    );

    return { jobId };
}

async function validateMpioPolicyToRoundRobin(
    optimizeMpioPolicyParams: OptimizeMpioPolicyParams,
    preCheck: boolean = false,
    runningOnPrimaryNode: boolean = true
) {
    logger.info(`Validate MPIO policy to Round Robin for ${optimizeMpioPolicyParams} on ${runningOnPrimaryNode}`);
    const {
        accountId,
        credentialsId,
        region,
        parentJobId,
        serverNameWithHostName,
        activeNodeInstanceId,
        standbyNodeInstanceId
    } = optimizeMpioPolicyParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    const jobDescription =
        optimizeMpioPolicyParams.sqlDeploymentType !== 'Standalone'
            ? `Check current MPIO policy on ${
                  runningOnPrimaryNode ? 'primary node' : 'standby node'
              } in ${serverNameWithHostName}.`
            : `Check current MPIO policy in ${serverNameWithHostName}`;
    let parsedValidateMPIOPolicyChangeResponse;

    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.OPTIMIZATION,
        jobDescription,
        jobDescription,
        parentJobId
    );

    try {
        const validateMPIOPolicyChangeResponse = await callSsmExecution(
            credentialsId,
            region,
            [CHECK_MPIO_POLICY],
            runningOnPrimaryNode ? activeNodeInstanceId! : standbyNodeInstanceId!,
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
            await updateJobDetails(accountId, jobId, {
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
        await updateJobDetails(accountId, jobId, {
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
        sqlDeploymentType !== SqlServerDeploymentModel.SQL_STANDALONE_SHORT
            ? `Setting MPIO policy to Round Robin on ${serverNameWithHostName} and changing cluster ownership on ${
                  runningOnPrimaryNode ? 'primary node' : 'standby node'
              }.`
            : `Setting MPIO policy to Round Robin on ${serverNameWithHostName}.`;
    let jobError;

    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.OPTIMIZATION,
        jobDescription,
        jobDescription,
        parentJobId
    );

    try {
        // Set MPIO policy to Round Robin
        const ssmCommand = REMEDIATE_MPIO_POLICY(optimizeMpioPolicyParams, runningOnPrimaryNode);
        await callSsmExecution(
            credentialsId,
            region,
            [ssmCommand],
            runningOnPrimaryNode ? activeNodeInstanceId! : standbyNodeInstanceId!
        );
    } catch (error) {
        const errorMessage = `Error while setting MPIO policy to Round Robin ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        jobError = errorMessage;
        throw errorMessage;
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError,
            description: jobDescription
        });
    }
}

async function validateAndRemediateMpioPolicy(
    optimizeMpioPolicyParams: OptimizeMpioPolicyParams,
    runningOnPrimaryNode: boolean
) {
    logger.info(
        `Validating and remediating MPIO policy to Round Robin for ${optimizeMpioPolicyParams} ${runningOnPrimaryNode}`
    );
    const validateMpioPolicyToRoundRobinResponse = await validateMpioPolicyToRoundRobin(
        optimizeMpioPolicyParams,
        true,
        runningOnPrimaryNode
    );

    // Policy set on the node
    optimizeMpioPolicyParams.activeNodeCurrentPolicy = validateMpioPolicyToRoundRobinResponse.policy;

    if (!validateMpioPolicyToRoundRobinResponse.remediated) {
        optimizeMpioPolicyParams.changeClusterOwnership = !validateMpioPolicyToRoundRobinResponse.remediated;
        await setMpioPolicyToRoundRobin(optimizeMpioPolicyParams, runningOnPrimaryNode);
        await validateMpioPolicyToRoundRobin(optimizeMpioPolicyParams, false, runningOnPrimaryNode);
    }
}

async function optimizeMpio(optimizeMpioPolicyParams: OptimizeMpioPolicyParams) {
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
        sqlDeploymentType,
        instanceMetadata
    } = optimizeMpioPolicyParams;

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;
    try {
        // For primary node
        // Check if MPIO policy is set to Round Robin
        // If not, set MPIO policy to Round Robin
        // If FCI, change cluster ownership
        await validateAndRemediateMpioPolicy(optimizeMpioPolicyParams, true);

        if (sqlDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT) {
            // For standby node
            // Check if MPIO policy is set to Round Robin
            // Case Not set to RR on standby
            // 1. Check if ownership was changed from primary to standby, if yes change back to primary
            // Case set to RR on standby
            // 1. Check if ownership was changed from primary to standby, if yes change back to primary. Else no action needed
            await validateAndRemediateMpioPolicy(optimizeMpioPolicyParams, false);
        }

        if (isDemoFlow) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                instanceId,
                ['mpio-load-balance-policy'],
                'OS',
                instanceMetadata || {}
            );
        }

        // Trigger assessment after optimization
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
        await triggerAssessmentAfterOptimization(
            credentialsId,
            region,
            accountId,
            databaseHostId,
            serverNameWithHostName,
            parentJobId,
            instanceToAssess
        );
    } catch (error) {
        const errorMessage = `Error while optimizing mpio configuration ${jobError}`;
        jobStatus = JOBSTATUS.FAILED;
        jobError = errorMessage;
    } finally {
        const errorMessage = `Error while optimizing mpio configuration ${jobError}`;
        logger.error(errorMessage);
        await updateJobDetails(accountId, parentJobId, {
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
        database_type: databaseType,
        metadata: instanceMetadata
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
    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.OPTIMIZATION,
        `Optimize operating system settings for ${serverNameWithHostName}`,
        `Optimize operating system settings for ${serverNameWithHostName}`
    );

    // Fetch instance node names for FCI
    let activeNodeName;
    let standbyNodeName;
    if (sqlDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT) {
        const { Reservations = [] } = await describeInstance(credentialsId, region, {
            InstanceIds: [activeNodeInstanceId!, standbyNodeInstanceId!]
        });
        activeNodeName = await getResourceNameFromTags(Reservations?.[0].Instances?.[0].Tags);
        standbyNodeName = await getResourceNameFromTags(Reservations?.[1].Instances?.[0].Tags);
    }

    switch (configurationName) {
        case OptimizeOperatingSystemParams.MPIO_POLICY: {
            try {
                optimizeMpio({
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
                    standbyNodeInstanceId,
                    activeNodeName,
                    standbyNodeName,
                    instanceMetadata
                });
            } catch (error) {
                const errorMessage = `Error while optimizing operating system settings ${error}`;
                logger.error(errorMessage);
                await updateJobDetails(accountId, parentJobId, {
                    status: JOBSTATUS.FAILED,
                    endTime: Date.now(),
                    error: errorMessage
                });
                updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);

                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
            }
            break;
        }
        case OptimizeOperatingSystemParams.MPIO_SESSIONS: {
            if (isDemoFlow) {
                const instanceDetailsForJob = JSON.stringify({
                    hostName: sqlServerName,
                    resourceId: databaseHostId,
                    databaseInstanceId,
                    databaseInstanceName: instanceName,
                    sqlServerDeploymentType: RESOURCESTYPE.MSSQL
                });

                await registerJob(accountId, credentialsId, region, {
                    name: `Validate MPIO iSCSCI sessions ${serverNameWithHostName}`,
                    description: `Validate MPIO iSCSCI sessions ${serverNameWithHostName}`,
                    startTime: Date.now(),
                    type: JOBTYPE.OPTIMIZATION,
                    status: JOBSTATUS.COMPLETED,
                    endTime: Date.now() + 4000,
                    resourceName: serverNameWithHostName,
                    parentJobId
                });
                await registerJob(accountId, credentialsId, region, {
                    name: `Optimize MPIO iSCSCI sessions for ${serverNameWithHostName}`,
                    description: `Optimize MPIO iSCSCI sessions for ${serverNameWithHostName}`,
                    startTime: Date.now() + 4000,
                    type: JOBTYPE.OPTIMIZATION,
                    status: JOBSTATUS.COMPLETED,
                    endTime: Date.now() + 8000,
                    resourceName: serverNameWithHostName,
                    parentJobId
                });
                const jobName = `Assess SQL Server instance ${serverNameWithHostName}`;
                const jobDescription = `Assess SQL Server instance ${serverNameWithHostName}. Review detailed findings and recommendations in.;${instanceDetailsForJob}`;
                await registerJob(accountId, credentialsId, region, {
                    name: jobName,
                    description: jobDescription,
                    resourceName: serverNameWithHostName,
                    startTime: Date.now() + 8000,
                    status: JOBSTATUS.COMPLETED,
                    endTime: Date.now() + 10000,
                    type: JOBTYPE.ASSESSMENT,
                    parentJobId
                });

                await updateJobDetails(accountId, parentJobId, {
                    endTime: Date.now() + 11000,
                    status: JOBSTATUS.COMPLETED
                });

                await updateOptimizedConfigNameInInstanceTable(
                    accountId,
                    instanceId,
                    [OptimizeOperatingSystemParams.MPIO_SESSIONS],
                    'OS',
                    (instanceMetadata as unknown as Metadata) || {}
                );
            }
            break;
        }
        case OptimizeOperatingSystemParams.MPIO_ENABLE: {
            if (isDemoFlow) {
                const instanceDetailsForJob = JSON.stringify({
                    hostName: sqlServerName,
                    resourceId: databaseHostId,
                    databaseInstanceId,
                    databaseInstanceName: instanceName,
                    sqlServerDeploymentType: RESOURCESTYPE.MSSQL
                });

                await registerJob(accountId, credentialsId, region, {
                    name: `Configure MPIO ${serverNameWithHostName}`,
                    description: `Configure MPIO ${serverNameWithHostName}`,
                    startTime: Date.now(),
                    type: JOBTYPE.OPTIMIZATION,
                    status: JOBSTATUS.COMPLETED,
                    endTime: Date.now() + 4000,
                    resourceName: serverNameWithHostName,
                    parentJobId
                });
                await registerJob(accountId, credentialsId, region, {
                    name: `Configure MPIO iSCSCI sessions ${serverNameWithHostName}`,
                    description: `Configure MPIO iSCSCI sessions for ${serverNameWithHostName}`,
                    startTime: Date.now() + 4000,
                    type: JOBTYPE.OPTIMIZATION,
                    status: JOBSTATUS.COMPLETED,
                    endTime: Date.now() + 7000,
                    resourceName: serverNameWithHostName,
                    parentJobId
                });
                const jobName = `Assess SQL Server instance ${serverNameWithHostName}`;
                const jobDescription = `Assess SQL Server instance ${serverNameWithHostName}. Review detailed findings and recommendations in.;${instanceDetailsForJob}`;
                await registerJob(accountId, credentialsId, region, {
                    name: jobName,
                    description: jobDescription,
                    resourceName: serverNameWithHostName,
                    startTime: Date.now() + 8000,
                    status: JOBSTATUS.COMPLETED,
                    endTime: Date.now() + 9000,
                    type: JOBTYPE.ASSESSMENT,
                    parentJobId
                });

                await updateJobDetails(accountId, parentJobId, {
                    endTime: Date.now() + 11000,
                    status: JOBSTATUS.COMPLETED
                });

                await updateOptimizedConfigNameInInstanceTable(
                    accountId,
                    instanceId,
                    [OptimizeOperatingSystemParams.MPIO_ENABLE],
                    'OS',
                    (instanceMetadata as unknown as Metadata) || {}
                );
            }
            break;
        }
        default: {
            const errorMessage = `Invalid configuration name ${configurationName}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }
    }

    return { jobId: parentJobId };
}

async function handleComputeRemediation(
    credentialsId: string,
    region: string,
    accountId: string,
    instanceType: string,
    resourceDetails: resource[],
    jobId: string
) {
    logger.info('Handling compute remediation', {
        credentialsId,
        region,
        accountId,
        instanceType,
        resourceDetails,
        jobId
    });

    let jobStatus;
    let errorMessage = '';

    try {
        const [{ id: resourceId, metadata }] = resourceDetails;
        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
        const { activeNodeInstanceId, instanceName } = await getActiveSqlNode(
            credentialsId,
            region,
            node1InstanceId,
            node2InstanceId
        );

        if (activeNodeInstanceId) {
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
                    accountId
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

                        // run elastic IP address; spot instance and autoscaling instance check for all nodes in the cluster; throws error if any node has does not meets the criteria

                        try {
                            // TODO: temporarily proceeding with the instance type change even if the pre-requisites fail; need to revisit this later
                            await instanceTypeChangePreReqs(credentialsId, region, accountId, clusterNodeInstanceIds);
                        } catch (error) {
                            logger.warn('Pre-requisites failed for instance type change', error);
                        }

                        const nonPrimaryNodeInstanceIds = clusterNodeInstanceIds.filter(
                            nodeId => nodeId !== activeNodeInstanceId
                        );
                        // modify instance type for all nodes in the cluster, (one node at a time to be on safer side) except the primary node
                        for (const nodeId of nonPrimaryNodeInstanceIds) {
                            await updateNodeInstanceType(credentialsId, region, nodeId, instanceType);
                        }
                        logger.info('Instance type updated for all secondary nodes in the cluster');

                        // pick one of the nodes in the cluster to transfer primary node ownership
                        const clusteNodeInstanceNames = compact(
                            clusterNodeDetails.map(
                                ({ ec2InstanceId, ec2InstanceName }) =>
                                    ec2InstanceId !== activeNodeInstanceId && ec2InstanceName
                            )
                        );

                        let targetNodeName;
                        for (const nodeName of clusteNodeInstanceNames) {
                            const resp = await callSsmExecution(
                                credentialsId,
                                region,
                                [CHECK_NODE_STATUS(nodeName)],
                                activeNodeInstanceId
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
                            logger.info('Primary node ownership transferred to', { targetNodeName, nodesTransferred });
                        } else {
                            throw createError(500, 'Failed to find a node to transfer primary node ownership');
                        }
                    }
                }
            } else {
                // single node cluster/standalone
                try {
                    // TODO: temporarily proceeding with the instance type change even if the pre-requisites fail; need to revisit this later
                    await instanceTypeChangePreReqs(credentialsId, region, accountId, instanceIdsList);
                } catch (error) {
                    logger.warn('Pre-requisites failed for instance type change', error);
                }
            }

            await updateNodeInstanceType(credentialsId, region, activeNodeInstanceId, instanceType); // modify instance type for the primary node ; secondary nodes if any are already modified at this point
            // move all cluster groups to the primary node
            if (node2InstanceId) {
                const ownershipTransferStatus = await moveClusterGroupOwnership(
                    credentialsId,
                    region,
                    instanceName,
                    activeNodeInstanceId
                );
                logger.info('Primary node ownership transferred to', { instanceName, ownershipTransferStatus });
            }
            jobStatus = JOBSTATUS.COMPLETED;
            if (isDemoFlow) {
                const updatedMetadata = cloneDeep(metadata) as unknown as Metadata;
                updatedMetadata.isComputeOptimized = true;
                await updateResourceMetaData(accountId, credentialsId, resourceId, updatedMetadata);
            }
            return;
        }

        jobStatus = JOBSTATUS.FAILED;
        errorMessage = 'No active node found in the cluster';
    } catch (error) {
        errorMessage = `Error while optimizing compute ${error}`;
        logger.error(errorMessage);

        jobStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);

        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
}
async function optimizeCompute(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    instanceType: string
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
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        resourceName!,
        JOBTYPE.OPTIMIZATION,
        `Optimize EC2 compute for ${resourceName}`,
        `Optimize EC2 compute for ${resourceName}`
    );

    handleComputeRemediation(credentialsId, region, accountId, instanceType, resourceDetails, jobId);

    if (isDemoFlow) {
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
    const resp = await callSsmExecution(
        credentialsId,
        region,
        [MOVE_ALL_CLUSTER_GROUPS(targetNodeName)],
        activeNodeInstanceId
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

async function updateNodeInstanceType(credentialsId: string, region: string, instanceId: string, instanceType: string) {
    logger.info(`Updating instance type for ${instanceId} to ${instanceType}`);

    try {
        await stopInstance(credentialsId, region, instanceId);
        if (!isDemo()) {
            await waitForInstanceToBeStopped(credentialsId, region, instanceId);
        }
        await modifyInstanceType(credentialsId, region, instanceId, instanceType);
        await startInstance(credentialsId, region, instanceId);
        await waitForInstanceOk(credentialsId, region, instanceId);
    } catch (error) {
        const errorMessage = `Failed to update instance type for ${instanceId} to ${instanceType}. ${error}`;

        logger.error(errorMessage);
        throw createError(500, errorMessage);
    }
}

export { optimizeStorage, optimizeSizing, optimizeOperatingSystemSettings, optimizeCompute };
