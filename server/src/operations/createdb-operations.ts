import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import getLogger from '../utils/logger';
import {
    GET_DEFAULT_DRIVES,
    GET_ACTIVE_NODE_DRIVE_INFO,
    GET_DEFAULT_COLLATION,
    GET_STANDBY_NODE_DRIVE_LIST
} from './workloads/mssql/ssm-script-utils';
import { checkDatabaseExists, getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { convertGiBToBytes, sleep, sqlResponseParsing } from '../utils/utils';
import {
    ACCOUNT_ID,
    COMPLETE,
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    DatabaseTypes,
    HttpErrorCodes,
    RESOURCESTYPE,
    SSM_COMMAND_CACHE_TYPE
} from '../utils/consts';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import { getResources } from './database/database-operations';
import { getFsxStorageCapacity } from './aws/fsx-operations';
import {
    DatabaseCreateResponseType,
    DriveInfoResponseBodyType,
    FileConfigType
} from '../routes/types/database-hosts.types';
import { getJobs, registerJob, updateJobDetails } from './database/job-operations';
import { Metadata } from '../utils/common-types';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import { describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { updateUserDBIntoResourceData } from './demo-operations';
import { resetCache } from '../utils/cache';
import { CLEANUPSCRIPT, CONFIGURELUNSCRIPT, CREATEDBSCRIPT, INITIALIZEDBSCRIPT } from './workloads/mssql/const';
import { MS_SQL_2016, MS_SQL_2022, MS_SQL_2017 } from './workloads/mssql/createdb-collations';
import { updateResourceMetaData } from '../lib/database/db';

const logger = getLogger();

async function getDefaultDrives(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    executionTimeout?: string
) {
    logger.info('Getting MSSQL default data and log drives', { credentialsId, region, activeNodeInstanceId });
    const defaultDrivesCommand = [GET_DEFAULT_DRIVES];

    const defaultDriveResponse = await callSsmExecution(
        credentialsId,
        region,
        defaultDrivesCommand,
        activeNodeInstanceId,
        undefined,
        false,
        executionTimeout
    );

    const [parsedDefaultDataDrive, parsedDefaultLogDrive] = defaultDriveResponse
        ? sqlResponseParsing(defaultDriveResponse)
        : [];

    const currentDataDrive =
        parsedDefaultDataDrive && !parsedDefaultDataDrive.includes('error')
            ? sqlResponseParsing(parsedDefaultDataDrive)[0].CurrentDataDrive
            : '';

    const currentLogDrive =
        parsedDefaultLogDrive && !parsedDefaultLogDrive.includes('error')
            ? sqlResponseParsing(parsedDefaultLogDrive)[0].CurrentLogDrive
            : '';
    logger.debug('MSSQL default data and log drives response', { currentDataDrive, currentLogDrive });
    return { currentDataDrive, currentLogDrive };
}

async function getDriveInfoFromNodes(
    credentialsId: string,
    region: string,
    sqlDeploymentType: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId: string,
    executionTimeout?: string
) {
    logger.info('Getting existing drives info on node', {
        credentialsId,
        region,
        activeNodeInstanceId,
        standbyNodeInstanceId
    });
    const activeNodeDriveInfoCommand = [GET_ACTIVE_NODE_DRIVE_INFO(sqlDeploymentType)];
    const standbyNodeDriveListCommand = [GET_STANDBY_NODE_DRIVE_LIST];

    const existingDriveActiveNodePromise = callSsmExecution(
        credentialsId,
        region,
        activeNodeDriveInfoCommand,
        activeNodeInstanceId,
        undefined,
        false,
        executionTimeout
    );

    // Getting list of drives present on standby node to eliminate presenting existing drive letter as available drive letter
    const existingDriveStandbyNodePromise =
        sqlDeploymentType === 'FCI'
            ? callSsmExecution(
                  credentialsId,
                  region,
                  standbyNodeDriveListCommand,
                  standbyNodeInstanceId!,
                  undefined,
                  false,
                  executionTimeout
              )
            : Promise.resolve();

    const [existingDriveActiveNodeResponse, existingDriveStandbyNodeResponse] = await Promise.all([
        existingDriveActiveNodePromise,
        existingDriveStandbyNodePromise
    ]);

    const parsedActiveNodeResponse = sqlResponseParsing(existingDriveActiveNodeResponse!);
    const parsedstandbyNodeResponse = existingDriveStandbyNodeResponse!
        ? sqlResponseParsing(existingDriveStandbyNodeResponse!)
        : undefined;

    const activeNodeExistingDrives = Array.isArray(parsedActiveNodeResponse)
        ? parsedActiveNodeResponse
        : [parsedActiveNodeResponse];

    const standbyNodeExistingDrives = Array.isArray(parsedstandbyNodeResponse?.DriveLetters)
        ? parsedstandbyNodeResponse?.DriveLetters
        : [parsedstandbyNodeResponse?.DriveLetters];

    const updatedExitingDrives = [
        ...activeNodeExistingDrives
            .map(item => {
                // At rare situation we are not getting any other information than Manufacturer, So handling that scenario by checking whether the disk info also available
                if (item.LogicalDisk) {
                    return {
                        driveLetter: item.LogicalDisk?.charAt(0),
                        availableSize: item.FileSystem,
                        isNetappDrive: item.Manufacturer?.includes('NETAPP') ?? false,
                        ...(sqlDeploymentType === 'FCI' && {
                            isDriveClustered: item.Owner?.includes('SQL Server') ?? false
                        })
                    };
                }
                return null;
            })
            .filter(Boolean),
        ...(standbyNodeExistingDrives !== undefined && sqlDeploymentType === 'FCI'
            ? standbyNodeExistingDrives
                  .filter((item: any) => !activeNodeExistingDrives.some(obj => obj.LogicalDisk === item))
                  .map((item: string) => ({
                      driveLetter: item?.charAt(0),
                      availableSize: 0,
                      isNetappDrive: false,
                      ...(sqlDeploymentType === 'FCI' && { isDriveClustered: false })
                  }))
            : [])
    ];

    // Constructing list of available drive letters
    const availableDriveLetters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).filter(
        letter => letter >= 'D' && !updatedExitingDrives.some(obj => obj.driveLetter === letter)
    );

    logger.debug('Existing drives info', { updatedExitingDrives, availableDriveLetters });
    return { updatedExitingDrives, availableDriveLetters };
}

async function getDriveInfoFromSSM(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    sqlDeploymentType: string,
    node1InstanceId: string,
    node2InstanceId?: string,
    executionTimeout?: string
) {
    logger.info('Getting drive information from SSM', {
        accountId,
        databaseHostId,
        credentialsId,
        sqlDeploymentType,
        node1InstanceId,
        node2InstanceId
    });
    // Check SSM Connection status
    const { isSSMConnected, activeNodeInstanceId, standbyNodeInstanceId } = await getActiveSqlNode(
        credentialsId,
        region!,
        node1InstanceId,
        node2InstanceId
    );

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        const errorMessage = `Unable to access drive details for host ${databaseHostId} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }

    if (sqlDeploymentType === 'FCI' && standbyNodeInstanceId) {
        const connectionStatus = await getSSMConnectionStatus(credentialsId, region!, node2InstanceId!);
        if (connectionStatus.Status !== ConnectionStatus.CONNECTED) {
            const errorMessage = `Unable to connect to node to access drive details for host ${databaseHostId} in account ${accountId}`;
            logger.error(errorMessage);
            throw createError(errorMessage);
        }
    }

    let getDriveInfoFromNodesResponse;
    let getDefaultDrivesResponse;
    try {
        // Not caching any ssm response as multiple creation will require real time data
        [getDriveInfoFromNodesResponse, getDefaultDrivesResponse] = await Promise.all([
            getDriveInfoFromNodes(
                credentialsId,
                region,
                sqlDeploymentType,
                activeNodeInstanceId as string,
                standbyNodeInstanceId!,
                executionTimeout
            ),
            getDefaultDrives(credentialsId, region, activeNodeInstanceId as string, executionTimeout)
        ]);
    } catch (error) {
        const errorMessage = `Unable to get drive information ${error}.`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
    return { getDriveInfoFromNodesResponse, getDefaultDrivesResponse };
}

async function getDriveInfo(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    executionTimeout?: string
): Promise<DriveInfoResponseBodyType> {
    logger.info(
        'Fetching drive details and storage capacity of the database host',
        accountId,
        databaseHostId,
        credentialsId,
        region
    );

    const {
        items: [resourceDetail]
    } = await getResources(accountId, databaseHostId, credentialsId, region, RESOURCESTYPE.MSSQL);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const { co_relation_id: fileSystemId, metadata } = resourceDetail;
    const { node1InstanceId, node2InstanceId, sqlDeploymentType } = metadata as unknown as Metadata;

    let fsxStorageCapacity;
    let driveResponse;
    try {
        [fsxStorageCapacity, driveResponse] = await Promise.all([
            getFsxStorageCapacity(credentialsId, region!, fileSystemId!),
            getDriveInfoFromSSM(
                accountId,
                databaseHostId,
                credentialsId,
                region,
                sqlDeploymentType!,
                node1InstanceId,
                node2InstanceId,
                executionTimeout
            )
        ]);
    } catch (error) {
        const errorMessage = `Unable to get drive information and FSx storage capacity. ${error}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    const { getDriveInfoFromNodesResponse, getDefaultDrivesResponse } = driveResponse;
    const { storage } = fsxStorageCapacity ?? {};

    const response: DriveInfoResponseBodyType = {
        existingDriveInfo: getDriveInfoFromNodesResponse.updatedExitingDrives,
        availableDriveLetters: getDriveInfoFromNodesResponse.availableDriveLetters,
        ...(storage && { fsxStorageCapacity: storage * 1024 * 1024 * 1024 }),
        ...(getDefaultDrivesResponse.currentDataDrive && {
            defaultDataDrive: getDefaultDrivesResponse.currentDataDrive
        }),
        ...(getDefaultDrivesResponse.currentLogDrive && {
            defaultLogDrive: getDefaultDrivesResponse.currentLogDrive
        })
    };

    return response;
}

async function deployDatabase(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    databaseName: string,
    dataFileConfig: FileConfigType,
    logFileConfig: FileConfigType,
    collation: string
): Promise<DatabaseCreateResponseType> {
    logger.info('Deploy new database', {
        accountId,
        databaseHostId,
        credentialsId,
        region,
        databaseName,
        dataFileConfig,
        logFileConfig,
        collation
    });

    const {
        items: [resourceDetail]
    } = await getResources(accountId, databaseHostId);

    const {
        resource_id: resourceId,
        co_relation_id: fileSystemId,
        metadata,
        resource_name: sqlServerName
    } = resourceDetail;
    const { node1InstanceId, node2InstanceId, fsxSvmId, sqlDeploymentType } = metadata as unknown as Metadata;
    const isClustered = sqlDeploymentType === 'FCI' ? 'true' : 'false';

    if (!credentialsId || !region || !node1InstanceId) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get resource  information');
    }

    // check whether any jobs on the same resource running
    const filterParams = {
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        typeFilter: JOBTYPE.CREATE_RESOURCE
    };
    const {
        items: [job]
    } = await getJobs(accountId, credentialsId, region, filterParams);

    if (job) {
        // Calculate the time difference in minutes
        const timeDifferenceInMilliseconds = Math.abs(Date.now() - job.startTime);
        const timeDifferenceInMinutes = Math.floor(timeDifferenceInMilliseconds / (1000 * 60));
        // workaround to allow the user to create database when there is a job stuck in progress for a very long time
        if (timeDifferenceInMinutes <= 15) {
            throw createError(
                412,
                `A database creation operation for ${sqlServerName} is already in progress with job ID ${job.id}`
            );
        }
    }

    // create the parent job for database deployment
    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: `Creating user database ${databaseName} on the SQL Server host ${sqlServerName}`,
        startTime: Date.now(),
        description: `Creating user database ${databaseName} on the SQL Server host ${sqlServerName}`
    });

    invokeSSMForDatabaseDeployment(
        credentialsId,
        region,
        databaseName,
        dataFileConfig,
        logFileConfig,
        collation,
        fileSystemId,
        isClustered,
        sqlServerName,
        node1InstanceId,
        fsxSvmId,
        jobId,
        resourceId,
        node2InstanceId,
        metadata as Metadata
    );
    return { jobId };
}

async function invokeSSMForDatabaseDeployment(
    credentialsId: string,
    region: string,
    databaseName: string,
    dataFileConfig: FileConfigType,
    logFileConfig: FileConfigType,
    collation: string,
    fileSystemId: string | null,
    isClustered: string,
    sqlServerName: string | null,
    node1InstanceId: string,
    fsxSvmId: string | undefined,
    parentJobId: string,
    resourceId: string,
    node2InstanceId?: string,
    metaData?: Metadata
) {
    logger.info(
        'invoke SSM for database deployment',
        credentialsId,
        region,
        databaseName,
        dataFileConfig,
        logFileConfig,
        collation,
        node1InstanceId,
        node2InstanceId,
        fsxSvmId,
        fileSystemId,
        resourceId,
        isClustered,
        parentJobId
    );

    const accountId: string = getAsyncLocalStorageResource(ACCOUNT_ID);

    const { fileName: dataFileName, drive: dataDrive, isExisting: isDataDriveExists } = dataFileConfig;
    const { fileName: logFileName, drive: logDrive, isExisting: isLogDriveExists } = logFileConfig;

    const dataVolumeSize = dataFileConfig.volumeSize * 1074; // converting from GiB to MBs
    const logVolumeSize = logFileConfig.volumeSize * 1074; // converting from GiB to MBs

    const dataDrivePath = `${dataDrive}:\\${DatabaseTypes.MS_SQL_SERVER}\\data\\${dataFileName}`;
    const logDrivePath = `${logDrive}:\\${DatabaseTypes.MS_SQL_SERVER}\\log\\${logFileName}`;

    let sqlVirtualMachineName;
    let activeNodeId;

    try {
        const { isSSMConnected, activeNodeInstanceId } = await getActiveSqlNode(
            credentialsId,
            region!,
            node1InstanceId,
            node2InstanceId
        );
        if (!isSSMConnected || activeNodeInstanceId === undefined) {
            const errorMessage = `Error while creating database for ${accountId} ${resourceId} due to SSM connection issues.`;
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
        }

        await validateParams(
            accountId,
            resourceId,
            credentialsId,
            region,
            databaseName,
            dataFileConfig,
            logFileConfig,
            fileSystemId as string,
            isClustered,
            sqlServerName as string,
            parentJobId,
            activeNodeInstanceId as string,
            collation
        );

        const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
            credentialsId,
            region,
            fileSystemId as string
        );

        const svmList = fsxSVMs?.filter(svm => svm.StorageVirtualMachineId === fsxSvmId) || [];
        const [{ Name: sqlVMName }] = svmList;

        sqlVirtualMachineName = sqlVMName;
        activeNodeId = activeNodeInstanceId;

        if (isDataDriveExists && isLogDriveExists) {
            // When the user selected drive as existing, we will only execute the create database script on the drive
            await createDatabase(
                accountId,
                credentialsId,
                resourceId,
                region,
                parentJobId,
                activeNodeInstanceId as string,
                sqlServerName,
                databaseName,
                dataDrivePath,
                logDrivePath,
                collation
            );
            await updateJobDetails(accountId, credentialsId, region, parentJobId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now(),
                error: undefined
            });

            if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
                // this is used to retreive the newly created user databases in database list for demo using meta data
                await updateUserDBIntoResourceData(accountId, resourceId, databaseName, metaData as Metadata);
            }

            // clearning all the ssm command cache so that we will get the fresh data once the database is created
            resetCache(SSM_COMMAND_CACHE_TYPE);
        } else {
            // New Drive selected, Will execute all the 3 scripts
            const {
                Resources: { Igroup: iGroup, FSxDataVolumeName: fsxDataVolumeName, FSxLogVolumeName: fsxLogVolumeName }
            } = await configureLuns(
                accountId,
                credentialsId,
                region,
                parentJobId,
                activeNodeInstanceId as string,
                sqlServerName,
                fileSystemId,
                sqlVMName,
                dataVolumeSize,
                logVolumeSize,
                (!isLogDriveExists).toString(),
                (!isDataDriveExists).toString()
            );
            // its required to sleep for 45 seconds so that initialization script will go through.. the ontap LUN configure can take time depending on busy system for the multiple API calls, and the disk initialize may take time to discover the created LUNs
            if (process.env.NODE_ENV !== 'demo' && process.env.NODE_ENV !== 'simulator') {
                await sleep(45000);
            }

            await newDBInitialization(
                accountId,
                credentialsId,
                region,
                parentJobId,
                activeNodeInstanceId as string,
                sqlServerName,
                databaseName,
                isClustered,
                dataDrive,
                logDrive,
                (!isLogDriveExists).toString(),
                (!isDataDriveExists).toString(),
                iGroup,
                fsxDataVolumeName,
                fsxLogVolumeName
            );

            await createDatabase(
                accountId,
                credentialsId,
                resourceId,
                region,
                parentJobId,
                activeNodeInstanceId as string,
                sqlServerName,
                databaseName,
                dataDrivePath,
                logDrivePath,
                collation,
                iGroup,
                fsxDataVolumeName,
                fsxLogVolumeName
            );

            await updateJobDetails(accountId, credentialsId, region, parentJobId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now(),
                error: undefined
            });

            await updateCreateDbMetrics(accountId, resourceId, metaData as Metadata);

            if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
                // this is used to retreive the newly created user databases in database list for demo using meta data
                await updateUserDBIntoResourceData(accountId, resourceId, databaseName, metaData as Metadata);
            }

            // clearning all the ssm command cache so that we will get the fresh data once the database is created
            resetCache(SSM_COMMAND_CACHE_TYPE);
        }
    } catch (err: any) {
        logger.error(
            `Error while creating database ${databaseName} in host ${resourceId} in account ${accountId}`,
            err,
            err.data
        );
        // Clean up script will only be executed when the configure lun script is provisioned
        if (err.data && err.data?.iGroup) {
            const {
                data: { iGroup, fsxDataVolumeName, fsxLogVolumeName }
            } = err;
            await cleanUpDatabaseDeployment(
                accountId,
                credentialsId,
                resourceId,
                region,
                fileSystemId,
                sqlVirtualMachineName,
                fsxDataVolumeName,
                fsxLogVolumeName,
                iGroup,
                activeNodeId as string,
                sqlServerName,
                parentJobId,
                databaseName,
                isClustered
            );
        }

        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: err?.message
        });
    }
}

async function updateCreateDbMetrics(accountId: string, resourceId: string, metaData: Metadata) {
    logger.debug('Update create database metrics for resource', resourceId);
    metaData.createDbMetrics = metaData.createDbMetrics || { numberofUserDbsCreated: 0 };
    metaData.createDbMetrics.numberofUserDbsCreated += 1;
    await updateResourceMetaData(accountId, resourceId, metaData);
}

async function createDatabase(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    region: string,
    parentJobId: string,
    activeNodeInstanceId: string,
    sqlServerName: string | null,
    databaseName: string,
    dataDrivePath: string,
    logDrivePath: string,
    collation: string,
    iGroup?: string,
    fsxDataVolumeName?: string,
    fsxLogVolumeName?: string
) {
    logger.info('Creating Database', {
        accountId,
        credentialsId,
        resourceId,
        region,
        parentJobId,
        activeNodeInstanceId,
        sqlServerName,
        databaseName,
        dataDrivePath,
        logDrivePath,
        collation,
        iGroup,
        fsxDataVolumeName,
        fsxLogVolumeName
    });

    let createDatabaseCommand;
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        createDatabaseCommand = [
            `${CREATEDBSCRIPT} -SQLServer Draculla  -DBName tempdb9  -DataPath J:\\MSSQL\\data\\tempdb9_data.mdf  -LogPath K:\\MSSQL\\data\\tempdb9_log.ldf`
        ];
    } else {
        createDatabaseCommand = [
            `${CREATEDBSCRIPT} -SQLServer ${sqlServerName}  -DBName ${databaseName}  -DataPath ${dataDrivePath}  -LogPath ${logDrivePath} -Collation ${collation}`
        ];
    }

    // child job creation
    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: 'Creating Database',
        parentJobId,
        description: `Creating database ${databaseName} with provided data and log file paths.`,
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        const createDatabaseResponse = await callSsmExecution(
            credentialsId,
            region,
            createDatabaseCommand,
            activeNodeInstanceId,
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );
        logger.debug('Create database is done', createDatabaseResponse);
        const parsedDBResponse = createDatabaseResponse ? sqlResponseParsing(createDatabaseResponse) : {};

        if (parsedDBResponse?.Status === COMPLETE) {
            status = JOBSTATUS.COMPLETED;
        } else {
            status = JOBSTATUS.FAILED;
            errMsg = parsedDBResponse.Message;
            const exception = JSON.stringify(parsedDBResponse?.Exception);
            logger.error(`Exception for create db ${parsedDBResponse.Message} ${exception}`);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errMsg}.`, {
                data: { iGroup, fsxDataVolumeName, fsxLogVolumeName }
            });
        }
        return parsedDBResponse;
    } catch (err: any) {
        // child job failed
        const errorMsg = `Error while creating database ${databaseName} in host ${resourceId} in account ${accountId}.`;
        logger.error(errorMsg, err);
        errMsg = `${errorMsg}  ${err?.message}`;
        status = JOBSTATUS.FAILED;
        if (!err.data) {
            err.data = { iGroup, fsxLogVolumeName, fsxDataVolumeName };
        }
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg, { data: err.data });
    } finally {
        // child job update
        await updateJobDetails(accountId, credentialsId, region, childJobId, {
            status,
            endTime: Date.now(),
            ...(errMsg && { error: errMsg })
        });
    }
}

async function configureLuns(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    activeNodeInstanceId: string,
    sqlServerName: string | null,
    fileSystemId: string | null,
    sqlVMName: string | undefined,
    dataVolumeSize: number,
    logVolumeSize: number,
    isLogDriveExists: string,
    isDataDriveExists: string
) {
    logger.info('Configure Luns', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        activeNodeInstanceId,
        sqlServerName,
        fileSystemId,
        sqlVMName,
        dataVolumeSize,
        logVolumeSize,
        isLogDriveExists,
        isDataDriveExists
    });

    let configureLuncommands;
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        configureLuncommands = [
            `${CONFIGURELUNSCRIPT} -FileSystemId fs-0d5efc3057c4f12cb -SQLVMName wlmdb_sqlsvm_1708791218786  -FSxDataLunSize 1074  -FSxLogLunSize 1074 -LogNew false -DataNew false`
        ];
    } else {
        configureLuncommands = [
            `pwsh -Command {$WarningPreference = 'SilentlyContinue';${CONFIGURELUNSCRIPT} -FileSystemId ${fileSystemId} -SQLVMName ${sqlVMName}  -FSxDataLunSize ${dataVolumeSize}  -FSxLogLunSize ${logVolumeSize} -LogNew ${isLogDriveExists} -DataNew ${isDataDriveExists}}`
        ];
    }

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: 'Configuring storage',
        parentJobId,
        description: 'Configuring storage on FSx for NetApp ONTAP with recommended best practices.',
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        const configureLunresponse = await callSsmExecution(
            credentialsId,
            region,
            configureLuncommands,
            activeNodeInstanceId,
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );
        logger.debug('Configure luns is done', configureLunresponse);
        const parsedLunsResponse = configureLunresponse ? sqlResponseParsing(configureLunresponse) : {};

        if (parsedLunsResponse?.Status === COMPLETE) {
            status = JOBSTATUS.COMPLETED;
        } else {
            status = JOBSTATUS.FAILED;
            errMsg = parsedLunsResponse.Message;
            const exception = JSON.stringify(parsedLunsResponse?.Exception);
            logger.error(`Exception for configure lun ${parsedLunsResponse.Message} ${exception}`);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errMsg}.`, {
                data: {
                    iGroup: parsedLunsResponse?.Resources?.Igroup,
                    fsxLogVolumeName: parsedLunsResponse?.Resources?.FSxLogVolumeName,
                    fsxDataVolumeName: parsedLunsResponse?.Resources?.FSxDataVolumeName
                }
            });
        }

        return parsedLunsResponse;
    } catch (err: any) {
        const errorMsg = `Error while configuring storage in account ${accountId}.`;
        logger.error(errorMsg, err);
        errMsg = `${errorMsg}  ${err?.message}`;
        status = JOBSTATUS.FAILED;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg, { data: err.data });
    } finally {
        // child job failed
        await updateJobDetails(accountId, credentialsId, region, childJobId, {
            status,
            endTime: Date.now(),
            ...(errMsg && { error: errMsg })
        });
    }
}

async function newDBInitialization(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    activeNodeInstanceId: string,
    sqlServerName: string | null,
    databaseName: string,
    isClustered: string,
    dataDrive: string,
    logDrive: string,
    isLogDriveExists: string,
    isDataDriveExists: string,
    iGroup: string,
    fsxDataVolumeName: string,
    fsxLogVolumeName: string
) {
    logger.info('Initialising new database', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        activeNodeInstanceId,
        sqlServerName,
        databaseName,
        isClustered,
        dataDrive,
        logDrive,
        isLogDriveExists,
        isDataDriveExists,
        iGroup,
        fsxDataVolumeName,
        fsxLogVolumeName
    });

    let dbInitializecommands;
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        dbInitializecommands = [
            `${INITIALIZEDBSCRIPT} -DBName tempdb9  -IsClustered false  -DataDrive J  -LogDrive K -LogNew true -DataNew true`
        ];
    } else {
        dbInitializecommands = [
            `${INITIALIZEDBSCRIPT} -DBName ${databaseName}  -IsClustered ${isClustered}  -DataDrive ${dataDrive}  -LogDrive ${logDrive} -LogNew ${isLogDriveExists} -DataNew ${isDataDriveExists}`
        ];
    }

    const description =
        isClustered === 'true'
            ? 'Attaching iSCSI disks to Windows host, initializing drives, and assigning to SQL role in Windows cluster'
            : 'Attaching iSCSI disks to Windows host and initializing drives';

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: 'New iSCSI Disk Initialization',
        parentJobId,
        description,
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        const newDBInitializeresponse = await callSsmExecution(
            credentialsId,
            region,
            dbInitializecommands,
            activeNodeInstanceId,
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );
        logger.debug('New DB initialize is successfully done', newDBInitializeresponse);

        const parsedDBInitializationResponse = newDBInitializeresponse
            ? sqlResponseParsing(newDBInitializeresponse)
            : {};

        if (parsedDBInitializationResponse?.Status === COMPLETE) {
            status = JOBSTATUS.COMPLETED;
        } else {
            status = JOBSTATUS.FAILED;
            errMsg = parsedDBInitializationResponse.Message;
            const exception = JSON.stringify(parsedDBInitializationResponse?.Exception);
            logger.error(`Exception for db initialize  ${parsedDBInitializationResponse.Message} ${exception}`);

            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errMsg}.`, {
                data: { iGroup, fsxLogVolumeName, fsxDataVolumeName }
            });
        }
        return parsedDBInitializationResponse;
    } catch (err: any) {
        const errorMsg = `Error while initializing new database ${databaseName} in account ${accountId}.`;
        logger.error(errorMsg, err);
        errMsg = `${errorMsg}  ${err?.message}`;
        status = JOBSTATUS.FAILED;
        if (!err.data) {
            err.data = { iGroup, fsxLogVolumeName, fsxDataVolumeName };
        }
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg, { data: err.data });
    } finally {
        // child job failed
        await updateJobDetails(accountId, credentialsId, region, childJobId, {
            status,
            endTime: Date.now(),
            ...(errMsg && { error: errMsg })
        });
    }
}

async function cleanUpDatabaseDeployment(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    region: string,
    fileSystemId: string | null,
    sqlVMName: string | undefined,
    dataVolumeName: string,
    logVolumeName: string,
    iGroup: string,
    activeNodeInstanceId: string,
    sqlServerName: string | null,
    parentJobId: string,
    databaseName: string,
    isClustered: string
) {
    logger.info('Cleaning up the database deployment', {
        accountId,
        credentialsId,
        resourceId,
        region,
        fileSystemId,
        sqlVMName,
        dataVolumeName,
        logVolumeName,
        iGroup,
        activeNodeInstanceId,
        sqlServerName,
        parentJobId,
        databaseName,
        isClustered
    });

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: 'Cleaning up',
        parentJobId,
        description: `Database creation failed. Cleaning up resources in FSx for NetApp ONTAP and in host ${resourceId}`,
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        let cleaupCommand;
        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            cleaupCommand = [
                `${CLEANUPSCRIPT} -FileSystemId fs-0d5efc3057c4f12cb -SQLVMName wlmdb_sqlsvm_1708791218786  -FSxDataVolumeName wlmdb_sqldata_1708948249  -FSxLogVolumeName wlmdb_sqllog_1708948249 -IGROUP wlmdb_sqligroup_1708791218786`
            ];
        } else {
            cleaupCommand = [
                `pwsh -Command {$WarningPreference = 'SilentlyContinue';${CLEANUPSCRIPT} -FileSystemId ${fileSystemId} -SQLVMName ${sqlVMName}  -FSxDataVolumeName ${dataVolumeName}  -FSxLogVolumeName ${logVolumeName} -IGROUP ${iGroup} -DBName ${databaseName} -IsClustered ${isClustered}}`
            ];
        }

        const cleanUpResponse = await callSsmExecution(
            credentialsId,
            region,
            cleaupCommand,
            activeNodeInstanceId,
            accountId,
            false
        );

        const parsedCleanUpResponse = cleanUpResponse ? sqlResponseParsing(cleanUpResponse) : {};
        status = parsedCleanUpResponse?.Status === COMPLETE ? JOBSTATUS.COMPLETED : JOBSTATUS.FAILED;
        errMsg = parsedCleanUpResponse.Message;

        return parsedCleanUpResponse;
    } catch (err: any) {
        const errorMsg = `Error while cleaning up resources in FSx for NetApp ONTAP and in host ${resourceId} in account ${accountId}.`;
        logger.error(errorMsg, err);
        errMsg = `${errorMsg}  ${err?.message}`;
        status = JOBSTATUS.FAILED;
    } finally {
        // child job failed
        await updateJobDetails(accountId, credentialsId, region, childJobId, {
            status,
            endTime: Date.now(),
            ...(errMsg && { error: errMsg })
        });
    }
}

async function validateParams(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    databaseName: string,
    dataFileConfig: FileConfigType,
    logFileConfig: FileConfigType,
    fileSystemId: string,
    isClustered: string,
    sqlServerName: string,
    parentJobId: string,
    activeNodeInstanceId: string,
    collation: string
) {
    logger.info('validating parameters for database user creation', {
        accountId,
        databaseHostId,
        credentialsId,
        region,
        databaseName,
        dataFileConfig,
        logFileConfig,
        fileSystemId,
        sqlServerName,
        parentJobId,
        collation
    });

    const {
        fileName: dataFileName,
        drive: dataDrive,
        isExisting: isDataDriveExists,
        volumeSize: dataVolumeSize
    } = dataFileConfig;
    const {
        fileName: logFileName,
        drive: logDrive,
        isExisting: isLogDriveExists,
        volumeSize: logVolumeSize
    } = logFileConfig;

    const dataGibIntoBytes = convertGiBToBytes(dataVolumeSize);
    const logGibIntoBytes = convertGiBToBytes(logVolumeSize);

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: sqlServerName as string,
        name: 'Database Validation',
        parentJobId,
        description: `Validating parameters for database ${databaseName}.`,
        startTime: Date.now()
    });

    let status;
    let errMsg;

    try {
        if (!isDataDriveExists && !isLogDriveExists) {
            if (dataDrive === logDrive) {
                throw createError(412, 'Data and log file drive letters should be different for new drives');
            }
        }

        await checkDatabaseExists(accountId, credentialsId, region, databaseHostId, databaseName, activeNodeInstanceId);

        if (!collation) {
            throw createError(412, 'Collation should not be empty');
        }

        const { collationList } = await getCollationDetails(accountId, databaseHostId, credentialsId, region);

        const collationExists = collationList?.some(item => item?.name?.toLowerCase() === collation.toLowerCase());

        if (!collationExists) {
            throw createError(412, `Selected collation ${collation} is not available`);
        }

        const { existingDriveInfo, availableDriveLetters } = await getDriveInfo(
            accountId,
            databaseHostId,
            credentialsId,
            region,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );

        // check whether the drive selection detail is right
        await Promise.all([
            checkDriveExists(
                existingDriveInfo,
                availableDriveLetters,
                dataDrive,
                isDataDriveExists,
                dataGibIntoBytes,
                isClustered,
                dataFileName,
                'data'
            ),
            checkDriveExists(
                existingDriveInfo,
                availableDriveLetters,
                logDrive,
                isLogDriveExists,
                logGibIntoBytes,
                isClustered,
                logFileName,
                'log'
            )
        ]);
        status = JOBSTATUS.COMPLETED;
    } catch (error: any) {
        const errorMsg = `Error while validating parameters in database ${databaseName} in host ${databaseHostId} in account ${accountId}.`;
        logger.error(errorMsg, error);
        errMsg = error?.message;
        status = JOBSTATUS.FAILED;
        throw createError(error.statusCode || 412, `${errorMsg} ${errMsg}`);
    } finally {
        // child job failed
        await updateJobDetails(accountId, credentialsId, region, childJobId, {
            status,
            endTime: Date.now(),
            ...(errMsg && { error: errMsg })
        });
    }
}

async function checkDriveExists(
    existingDriveInfo: Array<{
        driveLetter: string;
        availableSize: number;
        isNetappDrive: boolean;
        isDriveClustered?: boolean;
    }>,
    availableDriveLetters: Array<string>,
    selectedDrive: string,
    isDriveExists: boolean,
    volumeSizeInBytes: number,
    isClustered: string,
    fileName: string,
    driveType: string
) {
    logger.info(
        'checking whether the drive exists',
        existingDriveInfo,
        availableDriveLetters,
        selectedDrive,
        isDriveExists,
        volumeSizeInBytes,
        isClustered,
        fileName,
        driveType
    );

    const restrictedDrives = ['A', 'B'];

    if (restrictedDrives.includes(selectedDrive)) {
        throw createError(412, `Selected ${driveType} drive ${selectedDrive} is not a valid drive`);
    }

    const regex = /^[A-Z]{1}$/; // Allows only single Capital Alphabetical letter
    if (!regex.test(selectedDrive)) {
        throw createError(412, `Selected ${driveType} drive ${selectedDrive} is not a valid drive`);
    }

    if (!fileName) {
        throw createError(412, `Selected ${driveType} drive ${fileName} should not be empty`);
    } else {
        const splitRegEx = /(.+)\.(.+)$/;
        const [, name, extension] = splitRegEx.exec(fileName) || [];
        if (extension && driveType === 'data' && extension !== 'mdf') {
            throw createError(412, `Selected ${driveType} drive file is not having a valid extension`);
        }
        if (extension && driveType === 'log' && extension !== 'ldf') {
            throw createError(412, `Selected ${driveType} drive file is not having a valid extension`);
        }
        const fileNameRegEx = /^[a-zA-Z0-9_]+$/;
        if (!fileNameRegEx.test(name)) {
            throw createError(
                412,
                `Selected ${driveType} file names can only contain alphanumeric characters, including letters, numbers and underscores`
            );
        }
        if (name.length > 128) {
            throw createError(
                412,
                `Selected ${driveType} file name should have names that are no more than 128 characters long`
            );
        }
    }

    if (isDriveExists) {
        const matchedExistingDrive = existingDriveInfo?.find(drive => drive.driveLetter === selectedDrive);
        if (!matchedExistingDrive) {
            throw createError(412, `Selected ${driveType} drive letter ${selectedDrive} does not exist`);
        }
        if (!matchedExistingDrive.isNetappDrive) {
            throw createError(412, `Selected ${driveType} drive ${selectedDrive} is not a NetApp drive`);
        }
        if (isClustered === 'true' && !matchedExistingDrive.isDriveClustered) {
            throw createError(
                412,
                `Selected ${driveType} drive ${selectedDrive} is non clustered drive or drive not part of SQL server`
            );
        }
        if (matchedExistingDrive.availableSize < volumeSizeInBytes) {
            throw createError(412, `Selected ${driveType} drive ${selectedDrive} does not have sufficient capacity`);
        }
    } else {
        const matchedAvailableDrive = availableDriveLetters?.includes(selectedDrive);
        if (!matchedAvailableDrive) {
            throw createError(412, `Selected ${driveType} drive ${selectedDrive} is not available for creation`);
        }
    }
    return true;
}

async function getCollationDetails(accountId: string, databaseHostId: string, credentialsId: string, region: string) {
    logger.info('Getting collation details from the database host', {
        accountId,
        databaseHostId,
        credentialsId,
        region
    });

    try {
        const {
            items: [resourceDetail]
        } = await getResources(accountId, databaseHostId, credentialsId, region, RESOURCESTYPE.MSSQL);

        if (isEmpty(resourceDetail)) {
            const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
        }

        const { metadata } = resourceDetail;
        const { node1InstanceId, node2InstanceId, sqlDeploymentType } = metadata as unknown as Metadata;

        // Check SSM Connection status
        const { isSSMConnected, activeNodeInstanceId, standbyNodeInstanceId } = await getActiveSqlNode(
            credentialsId,
            region,
            node1InstanceId,
            node2InstanceId
        );

        if (!isSSMConnected && activeNodeInstanceId === undefined) {
            const errorMessage = `Unable to get collation details for host ${databaseHostId} in account ${accountId} due to SSM connection issues.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        if (sqlDeploymentType === 'FCI' && standbyNodeInstanceId) {
            const connectionStatus = await getSSMConnectionStatus(credentialsId, region!, node2InstanceId!);
            if (connectionStatus.Status !== ConnectionStatus.CONNECTED) {
                const errorMessage = `Unable to connect to node to get collation details for host ${databaseHostId} in account ${accountId}`;
                logger.error(errorMessage);
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
            }
        }

        const { defaultCollation, mssqlVersion } = await getDefaultCollationAndVersion(
            credentialsId,
            region,
            activeNodeInstanceId as string
        );

        // This regular expression matches four digits in a row, which is the pattern for a year.
        const regex = /\b\d{4}\b/;

        const [match] = mssqlVersion.match(regex);
        switch (match) {
            case '2016':
                return {
                    collationList: MS_SQL_2016,
                    defaultCollation
                };
            case '2017':
                return {
                    collationList: MS_SQL_2017,
                    defaultCollation
                };
            case '2019':
            case '2022':
                return {
                    collationList: MS_SQL_2022,
                    defaultCollation
                };
            default:
                return {
                    collationList: MS_SQL_2022,
                    defaultCollation
                };
        }
    } catch (error: any) {
        const errorMessage = `Unable to get collation information. ${error?.message}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function getDefaultCollationAndVersion(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    executionTimeout?: string
) {
    logger.info('Getting MSSQL default collation', { credentialsId, region, activeNodeInstanceId });
    const defaultCollationCommand = [GET_DEFAULT_COLLATION];

    const defaultCollationResponse = await callSsmExecution(
        credentialsId,
        region,
        defaultCollationCommand,
        activeNodeInstanceId,
        undefined,
        false,
        executionTimeout
    );

    const [defaultCollation, mssqlVersion] = defaultCollationResponse
        ? sqlResponseParsing(defaultCollationResponse)
        : [];

    logger.debug('MSSQL default collation response', { defaultCollation, mssqlVersion });
    return { defaultCollation, mssqlVersion };
}

export {
    deployDatabase,
    getDriveInfo,
    createDatabase,
    newDBInitialization,
    configureLuns,
    cleanUpDatabaseDeployment,
    getCollationDetails
};
