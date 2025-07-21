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
import { checkDatabaseExists, getActiveSqlNode, ActiveSqlNodeDetails } from './workloads/mssql/mssql-operations';
import {
    convertGiBToBytes,
    sqlResponseParsing,
    getCollationForMSSQLVersion,
    getDatabaseInstanceName,
    isDemo,
    getOriginalDatabaseInstanceName,
    retryWithDelay
} from '../utils/utils';
import {
    ACCOUNT_ID,
    COMPLETE,
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    DEFAULT_INSTANCE_NAME,
    DatabaseTypes,
    HttpErrorCodes,
    RESOURCESTYPE,
    SQL_SERVICE_STATE,
    SSM_COMMAND_CACHE_TYPE,
    DEFAULT_MSSQL_INSTANCE_NAME,
    AuditStatus
} from '../utils/consts';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import {
    getInstanceInfo,
    getResources,
    populateDbInstances,
    updateResourceMetaData
} from './database/database-operations';
import { getFsxStorageCapacity } from './aws/fsx-operations';
import {
    DatabaseCreateResponseType,
    DriveInfoResponseBodyType,
    FileConfigType
} from '../routes/types/database-hosts.types';
import { getJobs, registerJob, updateJobDetails } from './database/job-operations';
import { DatabaseInstance, Metadata, DatabaseInstanceMetadata } from '../utils/common-types';
import { getAsyncLocalStorageResource } from '../utils/async-local-storage';
import { describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { updateUserDBIntoInstanceTable, updateUserDBIntoResourceData } from './demo-operations';
import { resetCache } from '../utils/cache';
import { CLEANUPSCRIPT, CONFIGURELUNSCRIPT, CREATEDBSCRIPT, INITIALIZEDBSCRIPT } from './workloads/mssql/const';
import { cleanupResources } from './workloads/mssql/createdb-scripts';
import { checkScriptNeedsUpdate, copyScriptsToHost } from './resource-operations';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import { CHECK_POWERSHELL7_AVAILABLE, IS_PS7_AVAILABLE } from './workloads/mssql/discover-consts';

const logger = getLogger();

interface SqlInstance {
    name: string;
    executableName: string;
    sqlAuthEnabled: boolean;
}
const isDemoFlow = isDemo();

async function getDefaultDrives(
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    instanceName: string,
    executableInstanceName: string,
    isSqlAuthEnabled: boolean,
    executionTimeout?: string
) {
    const ssmComment = 'Getting MSSQL default data and log drives';
    logger.info('Getting MSSQL default data and log drives', { credentialsId, region, activeNodeInstanceId });
    let defaultDrivesCommand = [GET_DEFAULT_DRIVES(instanceName, executableInstanceName, isSqlAuthEnabled)];

    if (isDemoFlow) {
        defaultDrivesCommand = [GET_DEFAULT_DRIVES(DEFAULT_INSTANCE_NAME, DEFAULT_MSSQL_INSTANCE_NAME, true)];
    }

    const defaultDriveResponse = await callSsmExecution(
        credentialsId,
        region,
        defaultDrivesCommand,
        activeNodeInstanceId,
        ssmComment,
        undefined,
        false,
        executionTimeout
    );

    const parsedDefaultDriveResponse = defaultDriveResponse ? sqlResponseParsing(defaultDriveResponse) : '';

    const parsedCurrentDrive =
        parsedDefaultDriveResponse && !parsedDefaultDriveResponse.includes('error')
            ? sqlResponseParsing(parsedDefaultDriveResponse)[0]
            : '';

    const currentDataDrive = (parsedCurrentDrive?.DefaultDataDrive || [])[0] || '';
    const currentLogDrive = (parsedCurrentDrive?.DefaultLogDrive || [])[0] || '';

    logger.debug('MSSQL default data and log drives response', { currentDataDrive, currentLogDrive });
    return { currentDataDrive, currentLogDrive };
}

async function getDriveInfoFromNodes(
    credentialsId: string,
    region: string,
    sqlDeploymentType: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId: string,
    executionTimeout?: string,
    forSandbox: boolean = false,
    instanceName = DEFAULT_INSTANCE_NAME
) {
    logger.info('Getting existing drives info on node', {
        credentialsId,
        region,
        activeNodeInstanceId,
        standbyNodeInstanceId
    });
    const activeNodeDriveInfoCommand = [GET_ACTIVE_NODE_DRIVE_INFO(sqlDeploymentType, instanceName)];
    const standbyNodeDriveListCommand = [GET_STANDBY_NODE_DRIVE_LIST];

    const existingDriveActiveNodePromise = callSsmExecution(
        credentialsId,
        region,
        activeNodeDriveInfoCommand,
        activeNodeInstanceId,
        'Get active standby node drive info',
        undefined,
        false,
        executionTimeout
    );
    // Getting list of drives present on standby node to eliminate presenting existing drive letter as available drive letter
    const existingDriveStandbyNodePromise =
        sqlDeploymentType === 'FCI' && !forSandbox && standbyNodeInstanceId
            ? callSsmExecution(
                  credentialsId,
                  region,
                  standbyNodeDriveListCommand,
                  standbyNodeInstanceId,
                  'Get standby node drive list',
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
                        ...(sqlDeploymentType === 'FCI' &&
                            !isDemoFlow && {
                                isClusteredWithSelectedInstance: item.Owner === `SQL Server (${instanceName})`
                            }),
                        ...(sqlDeploymentType === 'FCI' &&
                            isDemoFlow && {
                                isClusteredWithSelectedInstance: item.Owner?.includes('SQL Server ') ?? false
                            })
                    };
                }
                return null;
            })
            .filter(Boolean),
        ...(standbyNodeExistingDrives !== undefined && sqlDeploymentType === 'FCI' && !forSandbox
            ? standbyNodeExistingDrives
                  .filter((item: any) => !activeNodeExistingDrives.some(obj => obj.LogicalDisk === item))
                  .map((item: string) => ({
                      driveLetter: item?.charAt(0),
                      availableSize: 0,
                      isNetappDrive: false,
                      ...(sqlDeploymentType === 'FCI' && { isClusteredWithSelectedInstance: false })
                  }))
            : [])
    ];

    // Constructing list of available drive letters

    const availableDriveLetters = !forSandbox
        ? Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).filter(
              letter => letter >= 'D' && !updatedExitingDrives.some(obj => obj.driveLetter === letter)
          )
        : [];

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
    executionTimeout?: string,
    forSandbox: boolean = false,
    instanceDetail?: DatabaseInstance,
    activeNodeInstance?: ActiveSqlNodeDetails
) {
    logger.info('Getting drive information from SSM', {
        accountId,
        databaseHostId,
        credentialsId,
        sqlDeploymentType,
        node1InstanceId,
        node2InstanceId,
        forSandbox,
        instanceDetail: instanceDetail?.database_instance_name
    });

    let isSSMConnected;
    let activeNodeInstanceId;
    let standbyNodeInstanceId;
    let instanceName;
    let instancesDetails;

    if (activeNodeInstance && activeNodeInstance.activeNodeInstanceId) {
        ({ isSSMConnected, activeNodeInstanceId, standbyNodeInstanceId, instanceName, instancesDetails } =
            activeNodeInstance);
    }

    if (
        isSSMConnected === undefined ||
        !activeNodeInstanceId ||
        (sqlDeploymentType === 'FCI' && !standbyNodeInstanceId) ||
        !instanceName ||
        !instancesDetails ||
        !instancesDetails?.length
    ) {
        // Check SSM Connection status
        ({ isSSMConnected, activeNodeInstanceId, standbyNodeInstanceId, instanceName, instancesDetails } =
            await getActiveSqlNode(credentialsId, region, { node1InstanceId, node2InstanceId }));
    }

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        const errorMessage = `Unable to access drive details for host ${databaseHostId} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }

    let isSqlAuthEnabled =
        instancesDetails && instanceDetail
            ? instancesDetails.some(
                  instance =>
                      instance.instanceName === instanceDetail.database_instance_name &&
                      instance.sqlAuthEnabled === true
              )
            : false;
    let actualInstanceName = getOriginalDatabaseInstanceName(instanceName);
    if (!activeNodeInstance && instanceDetail && instancesDetails) {
        const { database_instance_name: selectedInstanceName, is_default: isDefault } = instanceDetail;

        const isInstanceRunning = instancesDetails.some(
            instance =>
                (isDemoFlow
                    ? instance.instanceName.includes(instanceDetail.database_instance_name)
                    : instance.instanceName === instanceDetail.database_instance_name) &&
                instance.instanceState === SQL_SERVICE_STATE.RUNNING
        );

        if (!isInstanceRunning) {
            const errorMessage = `Unable to access drive details for host ${databaseHostId} in account ${accountId} instance ${instanceDetail.database_instance_name} is not running.`;
            logger.error(errorMessage);
            throw createError(errorMessage);
        }
        instanceName = getDatabaseInstanceName(selectedInstanceName, isDefault);
        actualInstanceName = selectedInstanceName;
        isSqlAuthEnabled = instancesDetails.some(
            instance =>
                instance.instanceName === instanceDetail.database_instance_name && instance.sqlAuthEnabled === true
        );
    }

    if (sqlDeploymentType === 'FCI' && !forSandbox && standbyNodeInstanceId) {
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
                executionTimeout,
                forSandbox,
                instanceDetail?.database_instance_name
            ),
            forSandbox
                ? Promise.resolve()
                : getDefaultDrives(
                      credentialsId,
                      region,
                      activeNodeInstanceId as string,
                      actualInstanceName!,
                      instanceName,
                      isSqlAuthEnabled,
                      executionTimeout
                  )
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
    forSandbox: boolean = false,
    executionTimeout?: string,
    databaseInstanceId?: string,
    activeNodeDetails?: ActiveSqlNodeDetails
): Promise<DriveInfoResponseBodyType> {
    logger.info('Fetching drive details and storage capacity of the database host', {
        accountId,
        databaseHostId,
        credentialsId,
        region,
        forSandbox,
        databaseInstanceId,
        activeNodeDetails: activeNodeDetails?.activeNodeInstanceId
    });

    const {
        items: [resourceDetail]
    } = await getResources({
        accountId,
        resourceId: databaseHostId,
        credentialsId,
        region,
        resourceType: RESOURCESTYPE.MSSQL,
        includeDatabaseInstances: true
    });

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    await populateDbInstances(resourceDetail);
    const { database_instances: dbInstances, metadata } = resourceDetail;
    let fsxIds = dbInstances?.map(dbInstance => dbInstance.fsxn_ids) || [];
    fsxIds = [...new Set(fsxIds?.flat())];
    const { node1InstanceId, node2InstanceId, sqlDeploymentType } = metadata as unknown as Metadata;

    // Handling the case when /register does not register standby node in case of FCI deployments
    if (sqlDeploymentType === 'FCI' && (!node1InstanceId || !node2InstanceId)) {
        logger.error('One or both nodes are not registered for FCI deployment', {
            sqlDeploymentType,
            node1InstanceId,
            node2InstanceId
        });
        throw createError(HttpErrorCodes.VALIDATION_ERROR, 'One or both nodes are not registered for FCI deployment');
    }

    let instanceDetail;
    let fsxId = fsxIds.length > 0 ? fsxIds[0] : undefined;
    if (databaseInstanceId) {
        const instances = dbInstances?.filter(instance => instance.database_instance_id === databaseInstanceId);
        instanceDetail =
            instances && instances.length > 0
                ? instances[0]
                : await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);

        ({ fsxn_ids: fsxId } = instanceDetail as unknown as DatabaseInstance);
    }

    let fsxStorageCapacity;
    let driveResponse;
    try {
        if (!fsxId) {
            const errorMessage = `No FSx file system found for database host ${databaseHostId} in account ${accountId}.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
        }
        [fsxStorageCapacity, driveResponse] = await Promise.all([
            forSandbox ? Promise.resolve() : getFsxStorageCapacity(credentialsId, region!, fsxId!),
            getDriveInfoFromSSM(
                accountId,
                databaseHostId,
                credentialsId,
                region,
                sqlDeploymentType!,
                node1InstanceId,
                node2InstanceId,
                executionTimeout,
                forSandbox,
                instanceDetail as unknown as DatabaseInstance,
                activeNodeDetails
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
        ...{ availableDriveLetters: getDriveInfoFromNodesResponse.availableDriveLetters },
        ...(storage && { fsxStorageCapacity: storage * 1024 * 1024 * 1024 }),
        ...(!forSandbox &&
            getDefaultDrivesResponse?.currentDataDrive && {
                defaultDataDrive: getDefaultDrivesResponse.currentDataDrive
            }),
        ...(!forSandbox &&
            getDefaultDrivesResponse?.currentLogDrive && {
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
    collation: string,
    databaseInstanceId?: string
): Promise<DatabaseCreateResponseType> {
    logger.info('Deploy new database', {
        accountId,
        databaseHostId,
        credentialsId,
        region,
        databaseName,
        dataFileConfig,
        logFileConfig,
        collation,
        databaseInstanceId
    });

    try {
        const {
            items: [resourceDetail]
        } = await getResources({ accountId, resourceId: databaseHostId });

        let {
            resource_id: resourceId,
            co_relation_id: fileSystemId,
            metadata,
            resource_name: sqlServerName
        } = resourceDetail;
        const { node1InstanceId, node2InstanceId, sqlDeploymentType } = metadata as unknown as Metadata;

        if (!credentialsId || !region || !node1InstanceId) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get resource  information');
        }
        let instanceDetail;
        let isClustered;
        let fsxSvmId;
        let databaseDeploymentType;
        let fsxSvmDetails;
        let instanceName;

        if (databaseInstanceId) {
            instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
            ({
                fsxn_ids: fileSystemId,
                fsx_svm_id: fsxSvmDetails,
                database_deployment_type: databaseDeploymentType,
                database_instance_name: instanceName
            } = instanceDetail as unknown as DatabaseInstance);

            isClustered = databaseDeploymentType === 'FCI' ? 'true' : 'false';
            fsxSvmId = (fsxSvmDetails as unknown as Record<string, string>)[fileSystemId as string];
        } else {
            isClustered = sqlDeploymentType === 'FCI' ? 'true' : 'false';
            ({ fsxSvmId } = metadata as unknown as Metadata);
        }
        const serverNameWithHostName = instanceName ? `${sqlServerName}\\${instanceName}` : (sqlServerName as string);

        // check whether any jobs on the same resource running
        const filterParams = {
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: serverNameWithHostName as string,
            typeFilter: JOBTYPE.CREATE_RESOURCE,
            credentialsId,
            region
        };
        const {
            items: [job]
        } = await getJobs(accountId, filterParams);

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

        updateLongRunningAuditGroup(undefined, undefined, serverNameWithHostName);

        // create the parent job for database deployment
        const { id: jobId } = await registerJob(accountId, credentialsId, region, {
            type: JOBTYPE.CREATE_RESOURCE,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: serverNameWithHostName,
            name: `Creating user database ${databaseName} on the SQL Server instance ${serverNameWithHostName}`,
            startTime: Date.now(),
            description: `Creating user database ${databaseName} on the SQL Server instance ${serverNameWithHostName}`
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
            serverNameWithHostName,
            node2InstanceId,
            metadata as Metadata,
            instanceDetail as unknown as DatabaseInstance
        );
        return { jobId };
    } catch (err: any) {
        const errorMsg = `Error while creating user database ${databaseName} in host ${databaseHostId} in account ${accountId}. ${err?.message}`;
        logger.error(errorMsg, err);
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMsg);
        throw createError(err.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
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
    serverNameWithHostName: string,
    node2InstanceId?: string,
    metaData?: Metadata,
    instanceDetail?: DatabaseInstance
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
        serverNameWithHostName,
        isClustered,
        parentJobId
    );

    const accountId: string = getAsyncLocalStorageResource(ACCOUNT_ID);

    const {
        fileName: dataFileName,
        drive: dataDrive,
        isExisting: isDataDriveExists,
        isVirtualMount: isDataVirtualMount
    } = dataFileConfig;
    const {
        fileName: logFileName,
        drive: logDrive,
        isExisting: isLogDriveExists,
        isVirtualMount: isLogVirtualMount
    } = logFileConfig;

    const dataVolumeSize = dataFileConfig.volumeSize * 1074; // converting from GiB to MBs
    const logVolumeSize = logFileConfig.volumeSize * 1074; // converting from GiB to MBs

    // constructing the path for data and log file based on virtual mount selected or not
    const virtualDataFileName = dataFileName.split('.')[0];
    const virtualLogFileName = logFileName.split('.')[0];
    const dataDrivePath = isDataVirtualMount
        ? `${dataDrive}:\\${virtualDataFileName}\\${DatabaseTypes.MS_SQL_SERVER}\\data\\${dataFileName}`
        : `${dataDrive}:\\${DatabaseTypes.MS_SQL_SERVER}\\data\\${dataFileName}`;
    const logDrivePath = isLogVirtualMount
        ? `${logDrive}:\\${virtualLogFileName}\\${DatabaseTypes.MS_SQL_SERVER}\\log\\${logFileName}`
        : `${logDrive}:\\${DatabaseTypes.MS_SQL_SERVER}\\log\\${logFileName}`;

    let sqlVirtualMachineName;
    let activeNodeId;
    let instanceNameForScript = DEFAULT_INSTANCE_NAME;
    let isDefaultInstance = 'true';
    let isSSMConnected;
    let activeNodeInstanceId;
    let standbyNodeInstanceId;
    let sqlInstanceName;
    let instancesDetails;
    let databaseInstanceId;
    let isSqlAuthEnabled = false;
    try {
        ({
            isSSMConnected,
            activeNodeInstanceId,
            standbyNodeInstanceId,
            instanceName: sqlInstanceName,
            instancesDetails
        } = await getActiveSqlNode(credentialsId, region, { node1InstanceId, node2InstanceId }));
        if (!isSSMConnected || activeNodeInstanceId === undefined || sqlInstanceName === undefined) {
            const errorMessage = `Error while creating database for ${accountId} ${resourceId} due to SSM connection issues.`;
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `${errorMessage}`);
        }
        if (instanceDetail && instancesDetails) {
            const { database_instance_name: selectedInstanceName, is_default: isDefault } = instanceDetail;
            isDefaultInstance = isDefault ? 'true' : 'false';
            instanceNameForScript = selectedInstanceName;

            const runningInstance = instancesDetails.find(
                instance =>
                    (isDemoFlow
                        ? instance.instanceName.includes(instanceDetail.database_instance_name)
                        : instance.instanceName === instanceDetail.database_instance_name) &&
                    instance.instanceState === SQL_SERVICE_STATE.RUNNING
            );

            if (isEmpty(runningInstance) && selectedInstanceName) {
                const errorMessage = `Unable to access drive details in account ${accountId} for instance ${sqlInstanceName} is not running.`;
                logger.error(errorMessage);
                throw createError(errorMessage);
            }
            sqlInstanceName = getDatabaseInstanceName(selectedInstanceName, isDefault);
            databaseInstanceId = instanceDetail.database_instance_id;
            isSqlAuthEnabled = runningInstance.sqlAuthEnabled || false;
        }

        if (isClustered === 'true' && standbyNodeInstanceId) {
            const connectionStatus = await getSSMConnectionStatus(credentialsId, region!, standbyNodeInstanceId);
            if (connectionStatus.Status !== ConnectionStatus.CONNECTED) {
                const errorMessage = `Unable to connect to node to access IQN info for host ${databaseName} in account ${accountId}`;
                logger.error(errorMessage);
                throw createError(errorMessage);
            }
        }
        const activeNodeDetails = {
            isSSMConnected,
            activeNodeInstanceId,
            standbyNodeInstanceId,
            instanceName: sqlInstanceName,
            instancesDetails
        };

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
            collation,
            { name: instanceNameForScript, executableName: sqlInstanceName, sqlAuthEnabled: isSqlAuthEnabled },
            serverNameWithHostName,
            activeNodeDetails as ActiveSqlNodeDetails,
            databaseInstanceId
        );

        const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
            credentialsId,
            region,
            [fileSystemId as string],
            { useCache: true }
        );

        const svmList = fsxSVMs?.filter(svm => svm.StorageVirtualMachineId === fsxSvmId) || [];
        const sqlVMName = svmList[0]?.Name;

        sqlVirtualMachineName = sqlVMName;
        activeNodeId = activeNodeInstanceId;

        if (isDataDriveExists && isLogDriveExists && !isDataVirtualMount && !isLogVirtualMount) {
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
                collation,
                { name: instanceNameForScript, executableName: sqlInstanceName, sqlAuthEnabled: isSqlAuthEnabled },
                serverNameWithHostName
            );
            await updateJobDetails(accountId, parentJobId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now(),
                error: undefined
            });
            updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            if (isDemoFlow) {
                // this is used to retreive the newly created user databases in database list for demo using meta data
                await updateUserDBIntoResourceData(
                    accountId,
                    credentialsId,
                    resourceId,
                    databaseName,
                    metaData as Metadata
                );
                if (instanceDetail) {
                    const { metadata: instanceMetadata, database_instance_id: instanceId } = instanceDetail!;

                    updateUserDBIntoInstanceTable(
                        accountId,
                        instanceId,
                        databaseName,
                        instanceMetadata as DatabaseInstanceMetadata
                    );
                }
            }

            // clearning all the ssm command cache so that we will get the fresh data once the database is created
            resetCache(SSM_COMMAND_CACHE_TYPE);
        } else {
            let standbyIqnResponse;
            if (isClustered === 'true' && standbyNodeInstanceId !== undefined) {
                const standbyIqnCommand = ['(Get-InitiatorPort).NodeAddress'];
                try {
                    standbyIqnResponse = await callSsmExecution(
                        credentialsId,
                        region,
                        standbyIqnCommand,
                        standbyNodeInstanceId,
                        'Get IQN for standby node',
                        accountId,
                        false,
                        CUSTOM_SSM_EXECUTION_TIMEOUT
                    );
                } catch (error) {
                    const errorMessage = `Failed to fetch standby IQN value' for host ${databaseName} in account ${accountId}, ${error}`;
                    logger.error(errorMessage);
                    throw createError(errorMessage);
                }
            }
            const standbyIqn = standbyIqnResponse ? standbyIqnResponse.replaceAll('\r\n', '') : undefined;
            // New Drive selected, Will execute all the 3 scripts
            const {
                Resources: {
                    Igroup: iGroup,
                    FSxDataVolumeName: fsxDataVolumeName,
                    FSxLogVolumeName: fsxLogVolumeName,
                    DataSerial: dataSerial,
                    LogSerial
                }
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
                isLogVirtualMount ? isLogDriveExists.toString() : (!isLogDriveExists).toString(),
                isDataVirtualMount ? isDataDriveExists.toString() : (!isDataDriveExists).toString(),
                serverNameWithHostName,
                standbyIqn
            );

            let isVirtualMountSelected = 'false';
            if (isLogVirtualMount || isDataVirtualMount) {
                isVirtualMountSelected = 'true';
            }

            const customSSMTimeoutValue = getCustomSSMTimeout(dataFileConfig.volumeSize, logFileConfig.volumeSize);
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
                isLogVirtualMount ? isLogDriveExists.toString() : (!isLogDriveExists).toString(),
                isDataVirtualMount ? isDataDriveExists.toString() : (!isDataDriveExists).toString(),
                iGroup,
                fsxDataVolumeName,
                fsxLogVolumeName,
                dataSerial,
                LogSerial,
                isVirtualMountSelected,
                instanceNameForScript,
                isDefaultInstance,
                serverNameWithHostName,
                customSSMTimeoutValue
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
                { name: instanceNameForScript, executableName: sqlInstanceName, sqlAuthEnabled: isSqlAuthEnabled },
                serverNameWithHostName,
                iGroup,
                fsxDataVolumeName,
                fsxLogVolumeName
            );

            await updateJobDetails(accountId, parentJobId, {
                status: JOBSTATUS.COMPLETED,
                endTime: Date.now(),
                error: undefined
            });
            updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            await updateCreateDbMetrics(accountId, credentialsId, resourceId, metaData as Metadata);

            if (isDemoFlow) {
                // this is used to retreive the newly created user databases in database list for demo using meta data
                await updateUserDBIntoResourceData(
                    accountId,
                    credentialsId,
                    resourceId,
                    databaseName,
                    metaData as Metadata
                );

                if (instanceDetail) {
                    const { metadata: instanceMetadata, database_instance_id: instanceId } = instanceDetail!;

                    updateUserDBIntoInstanceTable(
                        accountId,
                        instanceId,
                        databaseName,
                        instanceMetadata as DatabaseInstanceMetadata
                    );
                }
            }

            // clearning all the ssm command cache so that we will get the fresh data once the database is created
            resetCache(SSM_COMMAND_CACHE_TYPE);
        }
    } catch (err: any) {
        logger.error(
            `Error while creating database ${databaseName} in host ${resourceId} in account ${accountId} `,
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
                isClustered,
                serverNameWithHostName,
                instanceNameForScript,
                isDefaultInstance,
                `${dataDrivePath},${logDrivePath}`
            );
        }
        updateLongRunningAuditGroup(AuditStatus.FAILED, err?.message, serverNameWithHostName);
        await updateJobDetails(accountId, parentJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: err?.message
        });
    }
}

async function updateCreateDbMetrics(accountId: string, credentialsId: string, resourceId: string, metaData: Metadata) {
    logger.debug('Update create database metrics for resource', resourceId);
    metaData.createDbMetrics = metaData.createDbMetrics || { numberofUserDbsCreated: 0 };
    metaData.createDbMetrics.numberofUserDbsCreated += 1;
    await updateResourceMetaData(accountId, credentialsId, resourceId, metaData);
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
    sqlInstance: SqlInstance,
    serverNameWithHostName: string,
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
        fsxLogVolumeName,
        sqlInstance,
        serverNameWithHostName
    });

    let createDatabaseCommand;
    const { name: instanceName, executableName: instanceExecutableName, sqlAuthEnabled } = sqlInstance;

    if (isDemoFlow) {
        createDatabaseCommand = [
            `${CREATEDBSCRIPT} -SQLServer Draculla  -DBName tempdb9  -DataPath J:\\MSSQL\\data\\tempdb9_data.mdf  -LogPath K:\\MSSQL\\data\\tempdb9_log.ldf`
        ];
    } else if (sqlAuthEnabled) {
        createDatabaseCommand = [
            `${CREATEDBSCRIPT} -SQLServer ${sqlServerName}  -DBName ${databaseName}  -DataPath ${dataDrivePath}  -LogPath ${logDrivePath} -Collation ${collation} -SqlInstanceName ${instanceExecutableName} -InstanceName ${instanceName} -ResourceID ${activeNodeInstanceId}`
        ];
    } else {
        createDatabaseCommand = [
            `${CREATEDBSCRIPT} -SQLServer ${sqlServerName}  -DBName ${databaseName}  -DataPath ${dataDrivePath}  -LogPath ${logDrivePath} -Collation ${collation} -SqlInstanceName ${instanceExecutableName} -InstanceName ${instanceName}`
        ];
    }

    // child job creation
    const jobDescription = `Creating database ${databaseName} with provided data and log file paths.`;
    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        name: 'Creating Database',
        parentJobId,
        description: jobDescription,
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        const createDatabaseResponse = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                createDatabaseCommand,
                activeNodeInstanceId,
                jobDescription,
                accountId,
                false,
                CUSTOM_SSM_EXECUTION_TIMEOUT
            ),
            3,
            5000
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
        await updateJobDetails(accountId, childJobId, {
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
    isDataDriveExists: string,
    serverNameWithHostName: string,
    standbyIqn?: string
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
        isDataDriveExists,
        standbyIqn,
        serverNameWithHostName
    });

    let configureLuncommands;
    if (isDemoFlow) {
        configureLuncommands = [
            `${CONFIGURELUNSCRIPT} -FileSystemId fs-0d5efc3057c4f12cb -SQLVMName wlmdb_sqlsvm_1708791218786  -FSxDataLunSize 1074  -FSxLogLunSize 1074 -LogNew false -DataNew false`
        ];
    } else if (standbyIqn) {
        configureLuncommands = [
            `$env:path = $env:path + ";C:\\Program Files\\PowerShell\\7";pwsh -Command {$WarningPreference = 'SilentlyContinue';${CONFIGURELUNSCRIPT} -FileSystemId ${fileSystemId} -SQLVMName ${sqlVMName}  -FSxDataLunSize ${dataVolumeSize}  -FSxLogLunSize ${logVolumeSize} -LogNew ${isLogDriveExists} -DataNew ${isDataDriveExists} -StandbyIQN ${standbyIqn}}`
        ];
    } else {
        configureLuncommands = [
            `$env:path = $env:path + ";C:\\Program Files\\PowerShell\\7";pwsh -Command {$WarningPreference = 'SilentlyContinue';${CONFIGURELUNSCRIPT} -FileSystemId ${fileSystemId} -SQLVMName ${sqlVMName}  -FSxDataLunSize ${dataVolumeSize}  -FSxLogLunSize ${logVolumeSize} -LogNew ${isLogDriveExists} -DataNew ${isDataDriveExists}}`
        ];
    }

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        name: 'Configuring storage',
        parentJobId,
        description: 'Configuring storage on FSx for NetApp ONTAP with recommended best practices.',
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        const configureLunresponse = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                configureLuncommands,
                activeNodeInstanceId,
                'Configuring LUNs',
                accountId,
                false,
                CUSTOM_SSM_EXECUTION_TIMEOUT
            ),
            3,
            5000
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
        await updateJobDetails(accountId, childJobId, {
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
    fsxLogVolumeName: string,
    dataSerial: string,
    logSerial: string,
    isVirtualMountSelected: string,
    instanceName: string,
    isDefaultInstance: string,
    serverNameWithHostName: string,
    customSSMTimeoutValue?: string
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
        fsxLogVolumeName,
        dataSerial,
        logSerial,
        isVirtualMountSelected,
        instanceName,
        isDefaultInstance,
        serverNameWithHostName,
        customSSMTimeoutValue
    });
    let dbInitializecommands;
    if (isDemoFlow) {
        dbInitializecommands = [
            `${INITIALIZEDBSCRIPT} -DBName tempdb9  -IsClustered false  -DataDrive J  -LogDrive K -LogNew true -DataNew true`
        ];
    } else {
        dbInitializecommands = [
            `${INITIALIZEDBSCRIPT} -DBName ${databaseName}  -IsClustered ${isClustered}  -DataDrive ${dataDrive}  -LogDrive ${logDrive} -LogNew ${isLogDriveExists} -DataNew ${isDataDriveExists} -DataSerial '${dataSerial}' -LogSerial '${logSerial}' -Virtualmount '${isVirtualMountSelected}' -InstanceName '${instanceName}' -isDefaultInstance '${isDefaultInstance}'`
        ];
    }

    const description =
        isClustered === 'true'
            ? 'Attaching iSCSI disks to Windows host, initializing drives, and assigning to SQL role in Windows cluster'
            : 'Attaching iSCSI disks to Windows host and initializing drives';

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        name: 'New iSCSI Disk Initialization',
        parentJobId,
        description,
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        const newDBInitializeresponse = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                dbInitializecommands,
                activeNodeInstanceId,
                description,
                accountId,
                false,
                customSSMTimeoutValue || CUSTOM_SSM_EXECUTION_TIMEOUT
            ),
            3,
            5000
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
        await updateJobDetails(accountId, childJobId, {
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
    isClustered: string,
    serverNameWithHostName: string,
    instanceNameForScript: string,
    isDefaultInstance: string,
    filePaths?: string
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
        isClustered,
        serverNameWithHostName,
        instanceNameForScript,
        isDefaultInstance
    });

    const jobDescription = `Database creation failed. Cleaning up resources in FSx for NetApp ONTAP and in instance ${serverNameWithHostName}`;
    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        name: 'Cleaning up',
        parentJobId,
        description: jobDescription,
        startTime: Date.now()
    });

    let status;
    let errMsg;
    try {
        let cleaupCommand;
        if (isDemoFlow) {
            cleaupCommand = [
                `${CLEANUPSCRIPT} -FileSystemId fs-0d5efc3057c4f12cb -SQLVMName wlmdb_sqlsvm_1708791218786  -FSxDataVolumeName wlmdb_sqldata_1708948249  -FSxLogVolumeName wlmdb_sqllog_1708948249 -IGROUP wlmdb_sqligroup_1708791218786`
            ];
        } else {
            // cleaupCommand = [
            //     `${CLEANUPSCRIPT} -FileSystemId ${fileSystemId} -SQLVMName ${sqlVMName}  -FSxDataVolumeName ${dataVolumeName}  -FSxLogVolumeName ${logVolumeName} -IGROUP ${iGroup} -DBName ${databaseName} -IsClustered ${isClustered} -InstanceName ${instanceNameForScript} -IsDefaultInstance ${isDefaultInstance} -FilePathString '${filePaths}'}`
            // ];

            cleaupCommand = [
                cleanupResources(
                    fileSystemId!,
                    sqlVMName!,
                    iGroup,
                    databaseName,
                    isClustered,
                    instanceNameForScript,
                    isDefaultInstance,
                    filePaths!,
                    dataVolumeName,
                    logVolumeName
                )
            ];
        }

        const cleanUpResponse = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                cleaupCommand,
                activeNodeInstanceId,
                jobDescription,
                accountId,
                false
            ),
            3,
            5000
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
        await updateJobDetails(accountId, childJobId, {
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
    collation: string,
    sqlInstance: SqlInstance,
    serverNameWithHostName: string,
    activeNodeDetails: ActiveSqlNodeDetails,
    databaseInstanceId?: string
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
        collation,
        sqlInstance,
        serverNameWithHostName
    });

    const {
        fileName: dataFileName,
        drive: dataDrive,
        isExisting: isDataDriveExists,
        volumeSize: dataVolumeSize,
        isVirtualMount: isDataVirtualMount
    } = dataFileConfig;
    const {
        fileName: logFileName,
        drive: logDrive,
        isExisting: isLogDriveExists,
        volumeSize: logVolumeSize,
        isVirtualMount: isLogVirtualMount
    } = logFileConfig;

    const dataGibIntoBytes = convertGiBToBytes(dataVolumeSize);
    const logGibIntoBytes = convertGiBToBytes(logVolumeSize);
    const { name: instanceName, executableName, sqlAuthEnabled } = sqlInstance;

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.CREATE_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
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

        // // Check if PS7 is installed
        const ps7AvailabilityResponse = await callSsmExecution(
            credentialsId,
            region,
            CHECK_POWERSHELL7_AVAILABLE,
            activeNodeInstanceId,
            'Check PowerShell 7 availability',
            accountId,
            false
        );

        let isPS7Available = true;
        try {
            const parsedResponse = JSON.parse(ps7AvailabilityResponse);
            isPS7Available = parsedResponse?.[IS_PS7_AVAILABLE];
        } catch (error: any) {
            logger.error('Error parsing PowerShell 7 availability response:', error);
        }

        if (!isPS7Available) {
            throw createError(HttpErrorCodes.VALIDATION_ERROR, 'PowerShell 7 is unavailable on the system.');
        }

        const databaseExists = await checkDatabaseExists(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseName,
            activeNodeInstanceId,
            instanceName,
            executableName,
            databaseInstanceId,
            sqlAuthEnabled
        );

        if (databaseExists) {
            throw createError(412, `Provided database ${databaseName} already exists`);
        }

        if (!collation) {
            throw createError(412, 'Collation should not be empty');
        }

        const { collationList } = await getCollationDetails(
            accountId,
            databaseHostId,
            credentialsId,
            region,
            undefined,
            activeNodeInstanceId,
            { name: instanceName, executableName, sqlAuthEnabled }
        );

        const collationExists = collationList?.some(item => item?.name?.toLowerCase() === collation.toLowerCase());

        if (!collationExists) {
            throw createError(412, `Selected collation ${collation} is not available`);
        }

        if ((isDataVirtualMount || isLogVirtualMount) && (!isDataDriveExists || !isLogDriveExists)) {
            throw createError(412, 'Virtual Mount should not be selected for new data/log drives');
        }

        const { existingDriveInfo, availableDriveLetters } = await getDriveInfo(
            accountId,
            databaseHostId,
            credentialsId,
            region,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT,
            databaseInstanceId,
            activeNodeDetails
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
                isDataVirtualMount,
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
                isLogVirtualMount,
                'log'
            )
        ]);
        try {
            const scriptsNeedUpdate = await checkScriptNeedsUpdate(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId
            );
            if (scriptsNeedUpdate) {
                logger.info('Scripts need to be updated:', activeNodeInstanceId);
                const scriptUpdateResponse = await copyScriptsToHost(
                    accountId,
                    credentialsId,
                    region,
                    activeNodeInstanceId
                );
                if (scriptUpdateResponse?.includes('failureInfo')) {
                    const errorMessage = `Failed to update scripts at node '${activeNodeInstanceId}'. Reason: failed to copy database operation artifacts. Error: ${scriptUpdateResponse}`;
                    logger.error(errorMessage);
                    throw createError(errorMessage);
                }
                logger.info('Scripts are updated successfully:', activeNodeInstanceId);
            }
        } catch (error) {
            logger.error(error);
        }
        status = JOBSTATUS.COMPLETED;
    } catch (error: any) {
        const errorMsg = `Error while validating parameters in database ${databaseName} in host ${databaseHostId} in account ${accountId}.`;
        logger.error(errorMsg, error);
        errMsg = error?.message;
        status = JOBSTATUS.FAILED;
        throw createError(error.statusCode || 412, `${errorMsg} ${errMsg}`);
    } finally {
        // child job failed
        await updateJobDetails(accountId, childJobId, {
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
        isClusteredWithSelectedInstance?: boolean;
    }>,
    availableDriveLetters: Array<string>,
    selectedDrive: string,
    isDriveExists: boolean,
    volumeSizeInBytes: number,
    isClustered: string,
    fileName: string,
    isVirtualMount: boolean,
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
        isVirtualMount,
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
            throw createError(412, `Selected ${driveType} drive ${selectedDrive} is not a NetApp iSCSI drive`);
        }
        if (isClustered === 'true' && !matchedExistingDrive.isClusteredWithSelectedInstance) {
            throw createError(
                412,
                `Selected ${driveType} drive ${selectedDrive} is non clustered drive or drive not part of SQL server`
            );
        }
        if (!isVirtualMount && matchedExistingDrive.availableSize < volumeSizeInBytes) {
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

async function getCollationForInstance(
    credentialsId: string,
    region: string,
    activeNode: string,
    sqlInstance: SqlInstance
) {
    const { defaultCollation, mssqlVersion } = await getDefaultCollationAndVersion(
        credentialsId,
        region,
        activeNode,
        sqlInstance
    );

    return getCollationForMSSQLVersion(mssqlVersion, defaultCollation);
}

async function getCollationDetails(
    accountId: string,
    databaseHostId: string,
    credentialsId: string,
    region: string,
    databaseInstanceId?: string,
    activeNode?: string,
    sqlInstance?: SqlInstance
) {
    logger.info('Getting collation details from the database host', {
        accountId,
        databaseHostId,
        credentialsId,
        region,
        databaseInstanceId
    });

    try {
        if (activeNode && sqlInstance) {
            return getCollationForInstance(credentialsId, region, activeNode as string, sqlInstance);
        }
        const {
            items: [resourceDetail]
        } = await getResources({
            accountId,
            resourceId: databaseHostId,
            credentialsId,
            region,
            resourceType: RESOURCESTYPE.MSSQL
        });

        if (isEmpty(resourceDetail)) {
            const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
        }

        let instanceDetail: any;
        if (databaseInstanceId) {
            instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
        }

        const { metadata } = resourceDetail;
        const { node1InstanceId, node2InstanceId, sqlDeploymentType } = metadata as unknown as Metadata;

        // Check SSM Connection status
        const { isSSMConnected, activeNodeInstanceId, standbyNodeInstanceId, instanceName, instancesDetails } =
            await getActiveSqlNode(credentialsId, region, { node1InstanceId, node2InstanceId });

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

        let sqlInstanceName = instanceName;
        let executableName = DEFAULT_MSSQL_INSTANCE_NAME;
        let sqlAuthEnabled = false;
        if (instanceDetail && instancesDetails) {
            const { database_instance_name: selectedInstanceName, is_default: isDefault } = instanceDetail;

            const runningInstance = instancesDetails.find(
                instance =>
                    (isDemoFlow
                        ? instance.instanceName.includes(instanceDetail.database_instance_name)
                        : instance.instanceName === instanceDetail.database_instance_name) &&
                    instance.instanceState === SQL_SERVICE_STATE.RUNNING
            );

            if (isEmpty(runningInstance) && selectedInstanceName) {
                const errorMessage = `Unable to access drive details in account ${accountId} for instance ${sqlInstanceName} is not running.`;
                logger.error(errorMessage);
                throw createError(errorMessage);
            }
            sqlAuthEnabled = runningInstance.sqlAuthEnabled;
            executableName = getDatabaseInstanceName(selectedInstanceName, isDefault);
            sqlInstanceName = selectedInstanceName;
        }
        return getCollationForInstance(credentialsId, region, activeNodeInstanceId as string, {
            name: sqlInstanceName,
            executableName,
            sqlAuthEnabled
        });
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
    sqlInstance: SqlInstance,
    executionTimeout?: string
) {
    const ssmComment = 'Getting MSSQL default collation';
    logger.info(ssmComment, { credentialsId, region, activeNodeInstanceId });
    const { name: instanceName, executableName, sqlAuthEnabled } = sqlInstance;

    let defaultCollationCommand = [GET_DEFAULT_COLLATION(instanceName, executableName, sqlAuthEnabled)];

    if (isDemoFlow) {
        defaultCollationCommand = [GET_DEFAULT_COLLATION('MSSQLSERVER', '$env:computername', false)];
    }

    const defaultCollationResponse = await callSsmExecution(
        credentialsId,
        region,
        defaultCollationCommand,
        activeNodeInstanceId,
        ssmComment,
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

/**
 * Minimum timeout value for SSM execution is 3 minutes
 * It gets increased by 3 minutes for every 100 GB of volume size
 * Maximum timeout value is 1 hour
 */
function getCustomSSMTimeout(dataVolumeSize: number, logVolumeSize: number) {
    logger.debug('Calculating custom SSM timeout based on volume size', {
        dataVolumeSize,
        logVolumeSize
    });

    const ONE_HOUR = 60 * 60;
    const maxVolumeSize = Math.max(dataVolumeSize, logVolumeSize);
    const derivedTimeout =
        maxVolumeSize > 100 ? Math.ceil(Number(maxVolumeSize) / 100) * 3 * 60 : Number(CUSTOM_SSM_EXECUTION_TIMEOUT);
    const maxCustomTimeout = Math.min(derivedTimeout, ONE_HOUR);
    return maxCustomTimeout ? String(maxCustomTimeout) : CUSTOM_SSM_EXECUTION_TIMEOUT;
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
