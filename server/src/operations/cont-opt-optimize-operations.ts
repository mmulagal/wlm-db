import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import { compact, isEmpty } from 'lodash-es';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import {
    Metadata,
    DatabaseInstance,
    WorkloadInstance,
    StorageAssessment,
    OptimizeMpioPolicyParams
} from '../utils/common-types';
import { HttpErrorCodes, AuditStatus, SqlServerDeploymentModel, RESOURCESTYPE } from '../utils/consts';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import { getInstanceInfo, getResources } from './database/database-operations';
import { OPTIMIZE_STORAGE_PARAMS_SCRIPT } from './workloads/mssql/continuous-optimization-scripts';
import { getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { getJobs, registerJob, updateJobDetails } from './database/job-operations';
import {
    getTimeDifferenceInMinutes,
    isDemo,
    sleep,
    sqlResponseParsing,
    convertToBytes,
    sizeInGigaBytes,
    getResourceNameFromTags
} from '../utils/utils';
import {
    driftAssessmentDataCollection,
    getHeadroomDrift,
    getLogVolumeDrift,
    getTempDbVolumeDrift
} from './cont-opt-assessment-operations';
import { describeFSx, describeFSxStorageVirtualMachines, updateFsxCapacity, updateFsxVolumeSize } from '../lib/aws/fsx';
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
import {
    OptimizeStorageRequestParamsType,
    SizingViolationResponseType
} from '../routes/types/continuous-optimization.types';
import { getFsxVolumeDetails, getFsxnVolIdsFromOntapVolIds } from './aws/fsx-operations';
import { CHECK_MPIO_POLICY, REMEDIATE_MPIO_POLICY } from './workloads/mssql/mpio-remediation-scripts';
import { describeInstance } from '../lib/aws/ec2';

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

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Assessment for ${serverNameWithHostName} after optimization`,
        description: `Assessment for ${serverNameWithHostName} after optimization`,
        startTime: Date.now(),
        type: JOBTYPE.OPTIMIZATION,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        parentJobId
    });

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
        serverNameWithHostName
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
        serverNameWithHostName
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
            awsAccountId
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
                        parentJobId,
                        serverNameWithHostName,
                        databaseHostId,
                        databaseInstanceId
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
                        parentJobId,
                        serverNameWithHostName,
                        databaseHostId,
                        databaseInstanceId
                    );
                    break;
                }
                default:
                    throw createError('Invalid optimization type');
            }
        }
        jobStatus = JOBSTATUS.COMPLETED;
        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } catch (error) {
        errorMessage = `Error while optimizing sizing: ${error}`;
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
            let newFsxStorageCapacity = totalVolumeSizeInBytes / 0.64;
            const increase = ((newFsxStorageCapacity - ssdStorageCapacityInBytes) / ssdStorageCapacityInBytes) * 100;
            // increase newFsxStorageCapactiy so that increment is atleast 10%
            newFsxStorageCapacity = increase > 10 ? newFsxStorageCapacity : ssdStorageCapacityInBytes * 1.1;

            const newFsxStorageCapactiyGiB = sizeInGigaBytes(newFsxStorageCapacity, 'B');
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
        await updateJobDetails(accountId, credentialsId, region, jobId, {
            status: jobStatus || JOBSTATUS.COMPLETED,
            endTime: Date.now(),
            error: errorMessage
        });
    }
}

async function resizeLogLun(
    credentialsId: string,
    region: string,
    svmName: string,
    fileSystemId: string,
    lunUuid: string,
    requiredLogVolumeSizeMB: number,
    activeNodeInstanceId: string
) {
    logger.info('Resizing log LUN ', {
        credentialsId,
        region,
        svmName,
        fileSystemId,
        lunUuid,
        requiredLogVolumeSizeMB,
        activeNodeInstanceId
    });

    const apiEndpoint = `/storage/luns/${lunUuid}`;

    const ssmCommand = OPTIMIZE_STORAGE_PARAMS_SCRIPT({
        fsxId: fileSystemId,
        region,
        apiEndpoint,
        apiQueryFilter: '',
        apiBody: JSON.stringify({ space: { size: 21474836480 } })
    });
    try {
        await callSsmExecution(
            credentialsId,
            region,
            [ssmCommand, '$null = (echo "RESCAN" | diskpart)'],
            activeNodeInstanceId
        );
    } catch (error) {
        throw createError(400, `Error while resizing log LUN ${error}`);
    }
}

async function logDriveOptimization(
    accountId: string,
    credentialsId: string,
    region: string,
    fileSystemId: string,
    logDriveDetails: any,
    parentJobId: string,
    serverNameWithHostName: string,
    databaseHostId: string,
    databaseInstanceId: string
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
        databaseInstanceId
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
    let jobStatus;
    let errorMessage;
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

            const {
                sqlAuthEnabled,
                activeNodeInstanceId,
                fsxId,
                instanceId,
                instanceName,
                databaseType,
                awsAccountId
            } = await activeSqlNodeDetails(credentialsId, region, accountId, databaseHostId, databaseInstanceId);

            if (activeNodeInstanceId) {
                await Promise.all(
                    underProvisionedDrives.map(async (drive: SizingViolationResponseType) => {
                        const { dataDriveTotalSizeMB = 0, lunUuid, ontapVolumeUuid, svmName } = drive;
                        if (dataDriveTotalSizeMB > 0) {
                            const requiredLogVolumeSizeMB = dataDriveTotalSizeMB * 0.25; // Increase log volume to 25% of data volume
                            const requiredLogVolumeSizeBytes = convertToBytes(requiredLogVolumeSizeMB, 'MiB') || 0;
                            const [matchingFsxVolumeId] =
                                Object.entries(uuidVolumeIdMap).find(
                                    ([, ontapVolumeId]) => ontapVolumeId === ontapVolumeUuid
                                ) || [];
                            const existingVolumeDetails = underProvisionedVolumeDetails.find(
                                volume => volume.VolumeId === matchingFsxVolumeId
                            );
                            if (
                                existingVolumeDetails?.OntapConfiguration?.SizeInBytes &&
                                existingVolumeDetails.OntapConfiguration.SizeInBytes < requiredLogVolumeSizeBytes &&
                                matchingFsxVolumeId
                            ) {
                                await updateFsxVolumeSize(
                                    credentialsId,
                                    region,
                                    accountId,
                                    matchingFsxVolumeId,
                                    requiredLogVolumeSizeBytes
                                );
                                logger.info(`Log volume size increased to ${requiredLogVolumeSizeBytes} bytes.`);

                                /*
                                dataVolSize  = dataLun + 10% dataLun = 1.1 dataLun
                                dataLunSize = dataVolSize / 1.1
                                logLunSize = 25% dataLunSize
                                logLunSize = 25% (dataVolSize / 1.1)  = .227 dataVolSize
                                */
                                const logLunSizeBytes = convertToBytes(dataDriveTotalSizeMB * 0.227, 'MiB') || 0;
                                await resizeLogLun(
                                    credentialsId,
                                    region,
                                    svmName!,
                                    fileSystemId,
                                    lunUuid!,
                                    logLunSizeBytes,
                                    activeNodeInstanceId
                                );

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
                            } else {
                                errorMessage =
                                    'Some log drives configuration changed since we last assessed, no action required for those';
                                jobStatus = JOBSTATUS.WARNING;
                            }
                        } else {
                            throw createError(400, 'Data drive size is unavailable, cannot calculate log drive size');
                        }
                    })
                );
                jobStatus = JOBSTATUS.COMPLETED;

                updateLongRunningAuditGroup(AuditStatus.SUCCESS, errorMessage);
            } else {
                errorMessage = `Unable to get active node instance id or svm details associated with log LUN, cannot optimize log drive size for database instance ${databaseInstanceId}`;
                jobStatus = JOBSTATUS.WARNING;
            }
        } else {
            errorMessage = 'Log drives are not under provisioned, no action required';
            jobStatus = JOBSTATUS.WARNING;
        }
    } catch (error) {
        errorMessage = `Error while optimizing log volume sizing ${error}`;
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
    parentJobId: string,
    serverNameWithHostName: string,
    databaseHostId: string,
    databaseInstanceId: string
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
        databaseInstanceId
    });
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
        const { dataDriveTotalSizeMB, tempdbPercent, ontapVolumeUuid } = getTempDbVolumeDrift(
            tempDbDriveDetails,
            AssessmentStatus.UNDER_PROVISIONED,
            'tempdb-drive-size'
        );

        if (tempdbPercent < 10) {
            const defaultDataDriveSizeBytes = convertToBytes(dataDriveTotalSizeMB, 'MiB') || 0;

            const requiredTempDbVolumeSizeBytes = defaultDataDriveSizeBytes * 0.1; // Increase tempDB volume to 10% of data volume

            // get the volume ID from the drive details, make a get call to check if the volume size is less than requiredTempDbVolumeSizeBytes and update the volume size
            const {
                volumeIds: [tempDbFsxVolumeId]
            } = await getFsxnVolIdsFromOntapVolIds(credentialsId, region, accountId, [ontapVolumeUuid]);

            const [existingVolumeDetails] = await getFsxVolumeDetails(credentialsId, region, accountId, [
                tempDbFsxVolumeId
            ]);
            if (
                existingVolumeDetails?.OntapConfiguration?.SizeInBytes &&
                existingVolumeDetails.OntapConfiguration.SizeInBytes < requiredTempDbVolumeSizeBytes &&
                tempDbFsxVolumeId
            ) {
                await updateFsxVolumeSize(
                    credentialsId,
                    region,
                    accountId,
                    tempDbFsxVolumeId,
                    requiredTempDbVolumeSizeBytes
                );
                const {
                    sqlAuthEnabled,
                    activeNodeInstanceId,
                    fsxId,
                    instanceId,
                    instanceName,
                    databaseType,
                    awsAccountId
                } = await activeSqlNodeDetails(credentialsId, region, accountId, databaseHostId, databaseInstanceId);

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
            } else {
                errorMessage = 'TempDB drive volume size changed since we last assessed, no action required';
                jobStatus = JOBSTATUS.WARNING;
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
        database_instances: { database_instance_name: instanceName } = {},
        resource: { resource_name: sqlServerName } = {}
    } = persistedConfigurationData;
    const storageAssessmentConfigData = configData as unknown as StorageAssessment;
    const { filesystemId } = storageAssessmentConfigData;

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
        sqlDeploymentType !== SqlServerDeploymentModel.SQL_STANDALONE_SHORT
            ? `Setting MPIO policy to Round Robin on ${serverNameWithHostName}, rebooting instance and changing cluster ownership on ${
                  runningOnPrimaryNode ? 'primary node' : 'standby node'
              }.`
            : `Setting MPIO policy to Round Robin on ${serverNameWithHostName} and rebooting instance.`;
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
        // Set MPIO policy to Round Robin and reboot instance
        const ssmCommand = REMEDIATE_MPIO_POLICY(optimizeMpioPolicyParams, runningOnPrimaryNode);
        await callSsmExecution(
            credentialsId,
            region,
            [ssmCommand],
            runningOnPrimaryNode ? activeNodeInstanceId! : standbyNodeInstanceId!
        );
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
        await validateAndRemediateMpioPolicy(optimizeMpioPolicyParams, true);

        if (sqlDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT) {
            // For standby node
            // Check if MPIO policy is set to Round Robin
            // Case Not set to RR on standby
            // 1. Check if ownership was changed from primary to standby, if yes change back to primary
            // 2. Reboot instance
            // Case set to RR on standby
            // 1. Check if ownership was changed from primary to standby, if yes change back to primary. Else no action needed
            await validateAndRemediateMpioPolicy(optimizeMpioPolicyParams, false);
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
            standbyNodeName
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

export { optimizeStorage, optimizeSizing, optimizeOperatingSystemSettings };
