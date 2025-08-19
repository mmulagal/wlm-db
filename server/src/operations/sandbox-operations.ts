import { ConnectionStatus } from '@aws-sdk/client-ssm';
import throat from 'throat';
import { compact, isEmpty, uniq, uniqBy } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../utils/logger';
import { listResources } from '../lib/database/db';
import {
    ACCOUNTID,
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    DEFAULT_INSTANCE_NAME,
    DEFAULT_MSSQL_INSTANCE_NAME,
    HttpErrorCodes,
    RESOURCESTYPE,
    SANDBOX_API_SIZE,
    SSM_COMMAND_CACHE_TYPE,
    SandboxLifecycleAction,
    SANDBOX_LIFECYCLE_REFRESH,
    SQL_SERVICE_STATE,
    AuditStatus
} from '../utils/consts';
import {
    createVolumeClone as CreateVolumeCloneScript,
    getDbMappedOntapVolumes,
    cleanUpOntapResources,
    addExtendedProperties,
    createClonedDb as createCloneDbScript,
    mountPointQuery,
    getStorageSavingsFromOntap,
    detachDbAndRemoveAccessPath,
    addAccessPathAndAttachDb,
    splitFlexCloneVolumes,
    deleteExtendedPropertiesScript,
    checkDatabaseIntegrityScript,
    getSnapshotsToClone,
    getConnectionInfo,
    invokeVirtualMountScript
} from './workloads/mssql/sandbox-scripts';
import { DatabaseInstance, Metadata, ResourceDetails, Sandbox, DatabaseInstanceMetadata } from '../utils/common-types';
import {
    ActiveSqlNodeDetails,
    checkDatabaseExists,
    getActiveSqlNode,
    getSqlServerVersion
} from './workloads/mssql/mssql-operations';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import { getDatabaseInstanceName, isDemo, retryWithDelay, sleep, sqlResponseParsing } from '../utils/utils';
import { DatabaseMountPointResponseType, SandboxInfoResponseType } from '../routes/types/sandbox.types';
import {
    getPaginatedDatabaseInstances,
    getResources,
    updateInstanceMetadata,
    updateResourceMetaData
} from './database/database-operations';
import { updateParentJobStatus, registerJob, updateJobDetails } from './database/job-operations';
import {
    updateSandboxDBIntoInstanceData,
    updateSandboxDBIntoResourceData,
    updateUserDBIntoInstanceTable,
    updateUserDBIntoResourceData
} from './demo-operations';
import { resetCache } from '../utils/cache';
import { describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { getDriveInfo } from './createdb-operations';
import { sqlQueryExecution, sqlQueryExecutionWithAuth } from './workloads/mssql/ssm-script-utils';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import { GET_SANDBOXES } from './workloads/mssql/queries';
import { DatabaseInstanceRecord } from '../lib/database/db-types';

const logger = getLogger();
const TIME_WINDOW = 60; // 60 seconds

const isDemoFlow = isDemo();
interface SandboxObject {
    sandbox_properties: { name: string; value: string }[];
}

type sandboxType = SandboxObject & { database_name: string };

function getProperty(item: SandboxObject, propertyName: string) {
    const property = item.sandbox_properties.find((prop: { name: string }) => prop.name === propertyName);
    return property ? property.value : '';
}

function getSourceDetails(obj: SandboxObject) {
    const source = getProperty(obj, 'source');
    return source.split('|');
}

function getClonedByTagValue(accountId: string, credentialsId: string) {
    logger.debug('Get cloned by tag value', accountId, credentialsId);

    const accId = accountId.split('-')[1];
    const credIdWithUnderScore = credentialsId.replace(/-/g, '_');

    return `netapp_wf_${accId}_${credIdWithUnderScore}`;
}

async function getSandboxDetails(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceDetails: ResourceDetails,
    managedInstances?: DatabaseInstance[]
) {
    logger.info('Get sandbox details of host:', resourceDetails.resource_id, accountId, credentialsId, region);
    const { metadata, resource_id: resourceId, resource_name: resourceName } = resourceDetails;
    const { node1InstanceId, node2InstanceId, sandboxes } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId, instancesDetails } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId,
        node2InstanceId,
        resourceId
    });

    if (isEmpty(managedInstances)) {
        const managedResult = await getPaginatedDatabaseInstances(accountId, {
            credentialsId,
            resourceId
        });
        managedInstances = Array.isArray(managedResult)
            ? (managedResult as DatabaseInstance[])
            : (managedResult.items as DatabaseInstance[]);
    }

    const instances =
        instancesDetails
            // Filter by running and managed instances
            ?.filter(
                instance =>
                    instance.instanceState === SQL_SERVICE_STATE.RUNNING &&
                    managedInstances?.some(
                        managedInstance => managedInstance.database_instance_name === instance.instanceName
                    )
            )
            .map(instance => ({
                // Add databaseInstanceId to the instance
                ...instance,
                databaseInstanceId: managedInstances?.find(
                    managedInstance => managedInstance.database_instance_name === instance.instanceName
                )?.database_instance_id
            })) || [];

    const errorResponse = (errorMessage: any) => [
        {
            databaseHostName: resourceDetails.resource_name!,
            databaseHostId: resourceDetails.resource_id!,
            error: errorMessage
        }
    ];

    if (instances.length === 0) {
        return errorResponse('No running instances found for the host.');
    }

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        const errorMessage = `Unable to get sandbox details for host ${resourceDetails.resource_id} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        return errorResponse(errorMessage);
    }

    let sandboxInfo: SandboxInfoResponseType[] = [];

    const instanceNames = instances.map(instance => instance.instanceName);
    const isSqlAuthEnabled = instances.some(instance => instance.sqlAuthEnabled);
    let command = [sqlQueryExecutionWithAuth(instanceNames, GET_SANDBOXES, isSqlAuthEnabled)];

    if (isDemoFlow) {
        command = [sqlQueryExecutionWithAuth([DEFAULT_INSTANCE_NAME], GET_SANDBOXES)];
    }

    const response = await callSsmExecution(
        credentialsId,
        region,
        command,
        activeNodeInstanceId!,
        'Get sandbox details',
        undefined,
        true,
        undefined,
        true
    );

    try {
        const parsedResponse = response ? sqlResponseParsing(response) : {};

        instances.forEach(instance => {
            const parsedInstanceResponse = parsedResponse?.[instance.instanceName];
            if (typeof parsedInstanceResponse === 'string' && parsedInstanceResponse.includes('error')) {
                const errorMessage = `Error fetching sandbox details for host: ${resourceId},${instance.instanceName},${accountId}${parsedInstanceResponse}.`;
                // logger.error(errorMessage);
                sandboxInfo.push(
                    ...errorResponse(errorMessage).map(item => ({
                        ...item,
                        databaseInstanceName: instance.instanceName,
                        databaseInstanceId: instance.databaseInstanceId
                    }))
                );
            }

            if (!parsedInstanceResponse) {
                const errorMessage = `No sandboxes created for the instance:${instance.InstanceName} ,${resourceName},${accountId}.`;
                logger.error(errorMessage);
                sandboxInfo.push(
                    ...errorResponse(errorMessage).map(item => ({
                        ...item,
                        databaseInstanceName: instance.instanceName,
                        databaseInstanceId: instance.databaseInstanceId
                    }))
                );
                return;
            }

            if (Array.isArray(parsedInstanceResponse)) {
                const filteredSandboxItems = parsedInstanceResponse.filter((item: sandboxType) =>
                    item.sandbox_properties.some((prop: any) => prop.name === ACCOUNTID && prop.value === accountId)
                );

                filteredSandboxItems.forEach((item: sandboxType) => {
                    const sources = getSourceDetails(item);

                    const databaseObject = {
                        sandboxName: item.database_name,
                        databaseHostName: resourceDetails.resource_name!,
                        databaseHostId: resourceDetails.resource_id!,
                        databaseInstanceName: instance.instanceName,
                        databaseInstanceId: instance.databaseInstanceId,
                        sourceDatabaseHostName: sources[0],
                        sourceDatabaseInstanceName: sources[1],
                        sourceDatabaseName: sources[2],
                        createdAt: parseInt(getProperty(item, 'createdAt') || String(Date.now()), 10),
                        updatedAt: parseInt(getProperty(item, 'updatedAt') || String(Date.now()), 10),
                        tag: getProperty(item, 'tag')
                    };

                    sandboxInfo.push(databaseObject);
                });
            }
            return sandboxInfo;
        });
    } catch (err) {
        logger.error(`Error fetching sandbox details for host: ${resourceId},${accountId}${err}.`);
    }

    if (isDemoFlow && sandboxes) {
        const demoSandboxInfo = (managedInstances || []).flatMap(instance => {
            const {
                database_instance_id: databaseInstanceId,
                metadata: instanceMetadata,
                database_instance_name: databaseInstanceName
            } = instance as DatabaseInstance;
            const updatedDatabaseInstanceName = databaseInstanceName.replace(resourceName!, '');
            const instanceSandboxes = (instanceMetadata as DatabaseInstanceMetadata)?.sandboxes || [];
            if (instanceSandboxes.length === 0) {
                return [];
            }
            return instanceSandboxes.map(sandbox => {
                const { databaseName: sandboxName, source, createdAt, updatedAt, tag } = sandbox;
                const databaseObject = {
                    sandboxName,
                    databaseHostName: resourceDetails.resource_name!,
                    databaseHostId: resourceDetails.resource_id!,
                    databaseInstanceName: updatedDatabaseInstanceName,
                    sourceDatabaseHostName: source.split('|')[0],
                    sourceDatabaseInstanceName: source.split('|')[1],
                    sourceDatabaseName: source.split('|')[2],
                    createdAt,
                    updatedAt,
                    tag,
                    databaseInstanceId
                };
                return databaseObject;
            });
        });

        if (demoSandboxInfo.length > 0) {
            sandboxInfo = sandboxInfo.concat(demoSandboxInfo);
        }
    }
    return sandboxInfo;
}

async function getSandboxesInfo(accountId: string, credentialsId: string, region: string, nextToken?: string) {
    logger.info('Get Sandboxes Info', accountId, credentialsId, region, nextToken);
    const resourceDetails = await listResources({
        accountId,
        credentialIds: credentialsId,
        region,
        resourceType: RESOURCESTYPE.MSSQL,
        metaFilters: isDemoFlow ? undefined : { sandboxCreated: true },
        pageSize: SANDBOX_API_SIZE,
        nextToken,
        includeDatabaseInstances: true
    });

    if (isEmpty(resourceDetails)) {
        logger.info(`No successfully deployed database hosts found for account ${accountId}.`);
        return { count: 0, items: [], nextToken: '' };
    }

    const managedInstancesMap = new Map(
        resourceDetails.map(r => [r.resource_id, (r as any)?.database_instances?.flat()])
    );

    try {
        let sandboxes: SandboxInfoResponseType[] = [];

        await Promise.all(
            resourceDetails.map(async (resourceDetail: ResourceDetails) => {
                const sandboxDetails = await getSandboxDetails(
                    accountId,
                    credentialsId,
                    region,
                    resourceDetail,
                    managedInstancesMap.get(resourceDetail?.resource_id)
                );
                if (sandboxDetails && sandboxDetails.length) {
                    sandboxes = sandboxes.concat(sandboxDetails);
                }
            })
        );

        return {
            count: sandboxes.length,
            items: sandboxes,
            nextToken:
                resourceDetails?.length === SANDBOX_API_SIZE
                    ? resourceDetails[resourceDetails.length - 1].id
                    : undefined
        };
    } catch (err) {
        const errorMessage = `Error fetching Sandboxes info. ${err}.`;
        logger.error(errorMessage);
    }
}

async function getSandboxInfoByInstanceId(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Get Sandboxes Info by Instance Id', accountId, credentialsId, region);

    const managedResult = await getPaginatedDatabaseInstances(accountId, {
        credentialsId,
        region,
        resourceId: databaseHostId,
        databaseInstanceId,
        shouldIncludeResource: true
    });
    const managedInstances = Array.isArray(managedResult) ? managedResult : managedResult.items;
    const [managedInstance] = managedInstances;

    if (isEmpty(managedInstance)) {
        logger.error('No managed instance found for the given database host ID.');
        return {
            count: 0,
            items: []
        };
    }
    const sandboxes = await getSandboxDetails(accountId, credentialsId, region, managedInstance.resource, [
        managedInstance
    ]);

    return {
        count: sandboxes?.length,
        items: sandboxes
    };
}

async function getSandboxSavings(accountId: string, credentialsId: string, region: string) {
    try {
        logger.info('Get sandbox savings', { accountId, credentialsId, region });

        const savingsData = {
            consumedStorage: 0,
            savedStorage: 0,
            sandboxSavingsPercentage: 0
        };

        const resourceDetails = await listResources({
            accountId,
            credentialIds: credentialsId,
            region,
            resourceType: RESOURCESTYPE.MSSQL,
            metaFilters: isDemoFlow
                ? undefined
                : {
                      sandboxCreated: true
                  },
            includeDatabaseInstances: true
        });

        if (isEmpty(resourceDetails)) {
            logger.info(`No successfully deployed database hosts found for account ${accountId}.`);
            return savingsData;
        }

        const fsxGroups: { [key: string]: ResourceDetails[] } = {};

        resourceDetails.forEach(resource => {
            const dbResource = resource as ResourceDetails & { database_instances?: DatabaseInstanceRecord[] };
            dbResource?.database_instances?.forEach(instance => {
                const fsxId = instance.fsxn_ids;
                if (fsxId) {
                    fsxGroups[fsxId] = fsxGroups[fsxId] || [];
                    fsxGroups[fsxId].push(resource);
                }
            });
        });

        await Promise.all(
            Object.keys(fsxGroups).map(
                throat(10, async fsxId => {
                    for await (const resourceDetail of fsxGroups[fsxId]) {
                        const { metadata } = resourceDetail;
                        const { node1InstanceId, node2InstanceId, sandboxes } = metadata as unknown as Metadata;

                        try {
                            const [ssmStatus1, ssmStatus2] = await Promise.all([
                                getSSMConnectionStatus(credentialsId, region, node1InstanceId),
                                node2InstanceId
                                    ? getSSMConnectionStatus(credentialsId, region, node1InstanceId)
                                    : Promise.resolve({ Status: ConnectionStatus.NOT_CONNECTED })
                            ]);

                            if (
                                ssmStatus1.Status === ConnectionStatus.CONNECTED ||
                                ssmStatus2.Status === ConnectionStatus.CONNECTED
                            ) {
                                let command = [
                                    getStorageSavingsFromOntap(
                                        fsxId,
                                        region,
                                        getClonedByTagValue(accountId, credentialsId)
                                    )
                                ];

                                // DEMO FSX ID AND REGION
                                if (isDemoFlow) {
                                    command = [
                                        getStorageSavingsFromOntap(
                                            'test-fsx',
                                            'us-east-1',
                                            'netapp_wf_test_account_test_cred'
                                        )
                                    ];
                                }

                                const response = await callSsmExecution(
                                    credentialsId,
                                    region,
                                    command,
                                    (ssmStatus1.Status === ConnectionStatus.CONNECTED
                                        ? node1InstanceId
                                        : node2InstanceId) as string,
                                    'Get storage savings',
                                    accountId
                                );

                                if (response && !response.includes('error')) {
                                    let { savedStorage, consumedStorage } = sqlResponseParsing(response);

                                    // Increase storage savings per sandbox for demo
                                    if (isDemoFlow) {
                                        savedStorage *= sandboxes?.length || 0;
                                        consumedStorage *= sandboxes?.length || 0;
                                    }

                                    savingsData.consumedStorage +=
                                        typeof consumedStorage === 'number' ? consumedStorage : 0;
                                    savingsData.savedStorage += typeof savedStorage === 'number' ? savedStorage : 0;

                                    const totalStorage = savingsData.consumedStorage + savingsData.savedStorage;
                                    savingsData.sandboxSavingsPercentage =
                                        totalStorage > 0 ? (savingsData.savedStorage * 100) / totalStorage : 0;
                                }
                                break;
                            }
                        } catch (e) {
                            logger.error(`Falied to fetch storage saving for fsx: ${fsxId}`, e);
                        }
                    }
                })
            )
        );

        return savingsData;
    } catch (e) {
        logger.error('Error while fetching storage savings', e);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Error while fetching storage savings ${accountId}, ${e}`
        );
    }
}

interface DbInfo {
    database: string;
    instance: string;
    host: string;
}

interface VolumeLunMap {
    fileName: string;
    fileId: string | number;
    fileType: string | number;
    volumeName: string;
    lunPath: string;
    lunSerialNumber: string;
    volumeUuid: string;
    svm: string;
    parentSvm?: string;
    parentVolume?: string;
    parentVolumeUuid?: string;
    parentSnapshot?: string;
    splitEstimate?: number;
}

interface VolumeLunMapping {
    collation?: string;
    data: Array<VolumeLunMap>;
    log: Array<VolumeLunMap>;
}

interface HostAndDbInfo extends DbInfo {
    resourceName: string;
    instanceName: string;
    fsxId: string;
    svm: string;
    activeNodeInstanceId: string;
    metadata: Metadata;
    databaseInstanceName?: string;
    instanceMetadata?: DatabaseInstanceMetadata;
    activeNodeDetails?: ActiveSqlNodeDetails;
    databaseInstanceId?: string;
    sqlAuthEnabled?: boolean;
}

interface ClonedVolume {
    volumeName: string;
    volumeId: string;
    lunSerialNumber: string;
}
interface ClonedVolumes {
    log: Array<ClonedVolume>;
    data: Array<ClonedVolume>;
}

interface MountPoints {
    dataDrive: string;
    logDrive: string;
}

async function createSandbox(
    accountId: string,
    credentialsId: string,
    region: string,
    source: DbInfo,
    dest: DbInfo,
    tag: string,
    mountPoints: MountPoints
) {
    logger.info({ source, dest, mountPoints });

    Object.entries(mountPoints).forEach(([key, value]) => {
        mountPoints[key as keyof MountPoints] = value.toUpperCase();
    });
    try {
        const { srcDetails, destDetails } = await runSandboxPreValidations(
            accountId,
            credentialsId,
            region,
            source,
            dest
        );

        logger.info({ srcDetails, destDetails });
        if (isDemo()) {
            srcDetails.databaseInstanceName = srcDetails.databaseInstanceName.replace(srcDetails.resourceName, '');
            destDetails.databaseInstanceName = destDetails.databaseInstanceName.replace(srcDetails.resourceName, '');
        }

        const job = await registerJob(accountId, credentialsId, region, {
            name: `Create sandbox ${dest.database} in the database instance ${destDetails.resourceName}\\${destDetails.databaseInstanceName}`,
            description: `Create sandbox ${dest.database} in the database instance ${destDetails.resourceName}\\${destDetails.databaseInstanceName}`,
            resourceName: dest.database,
            initiator: 'SYSTEM',
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.SANDBOX
        });

        updateLongRunningAuditGroup(
            undefined,
            undefined,
            `${destDetails.resourceName}\\${destDetails.databaseInstanceName}`
        );

        startSandboxCreation(
            accountId,
            credentialsId,
            region,
            job.id,
            srcDetails,
            destDetails as HostAndDbInfo,
            tag,
            mountPoints
        );

        return { jobId: job.id };
    } catch (err: any) {
        const errorMsg = `Error while creating sandbox ${dest.database}. ${err?.message}`;
        logger.error(errorMsg, err);
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMsg);
        throw createError(err.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}

async function startSandboxCreation(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    srcDetails: HostAndDbInfo,
    destDetails: HostAndDbInfo,
    tag: string,
    mountPoints: MountPoints
) {
    logger.info('Start sandbox creation process', { tag });
    let errorMsg;
    let status: string;

    let clonedVolumes;
    let mountPaths;
    const fileSuffix = '-sandbox';

    try {
        await validateCloneParams(accountId, credentialsId, region, parentJobId, srcDetails, destDetails, mountPoints);

        const mappings = (await getMappings(
            accountId,
            credentialsId,
            region,
            parentJobId,
            srcDetails,
            destDetails.database
        )) as VolumeLunMapping;

        logger.debug({ mappings });

        clonedVolumes = (await createVolumeClone(
            accountId,
            credentialsId,
            region,
            parentJobId,
            srcDetails,
            destDetails,
            mappings
        )) as ClonedVolumes;

        mountPaths = (await invokeVirtualMount(
            accountId,
            credentialsId,
            region,
            parentJobId,
            srcDetails,
            destDetails,
            mappings,
            clonedVolumes,
            mountPoints
        )) as { files: Array<string> };

        const mappingData = [...mappings.data, ...mappings.log];

        const fileDataArr = mountPaths.files.map(path => {
            const fileData = mappingData.find(vol => {
                const oldFileName = vol.fileName.split('\\').pop();
                const newFileName = path.split('\\').pop();
                return oldFileName === newFileName;
            });
            return {
                filePath: path,
                fileId: fileData?.fileId || 0,
                fileType: fileData?.fileType || 0
            };
        });

        await createCloneDb(
            accountId,
            credentialsId,
            region,
            parentJobId,
            destDetails,
            {
                dataPath: fileDataArr
                    .filter(file => Number(file.fileType) === 0)
                    .sort((a, b) => Number(a.fileId) - Number(b.fileId))
                    .map(pathObj => pathObj.filePath),
                logPath: fileDataArr
                    .filter(file => Number(file.fileType) === 1)
                    .sort((a, b) => Number(a.fileId) - Number(b.fileId))
                    .map(pathObj => pathObj.filePath)
            },
            mappings.collation,
            fileSuffix
        );

        await createExtendedProperties(accountId, credentialsId, region, parentJobId, srcDetails, destDetails, {
            tag,
            cloned_by: 'netapp_wf',
            source: `${srcDetails.resourceName}|${srcDetails.databaseInstanceName}|${srcDetails.database}`,
            createdAt: Date.now(), // to be used for calculating age
            updatedAt: Date.now(), // to be used for getting the last update
            accountId
        });

        status = JOBSTATUS.COMPLETED;
        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } catch (e: any) {
        logger.error(e);
        errorMsg = e.message || 'Internal Server Error';
        status = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMsg);

        await startCleanup(
            accountId,
            credentialsId,
            region,
            parentJobId,
            srcDetails,
            destDetails,
            clonedVolumes
                ? uniq([...clonedVolumes.data.map(vol => vol.volumeId), ...clonedVolumes.log.map(vol => vol.volumeId)])
                : [],
            uniq(compact(mountPaths ? mountPaths.files : [])).map(file =>
                file.replace(/(\.mdf|\.ndf|\.ldf)/, `${fileSuffix}$1`)
            )
        );
    } finally {
        // clearning all the ssm command cache so that we will get the fresh data once the sandbox is created
        resetCache(SSM_COMMAND_CACHE_TYPE);
        await updateJobDetails(accountId, parentJobId, {
            error: errorMsg,
            status: status!,
            endTime: Date.now()
        });
    }
}

async function validateSelectedDrives(
    existingDriveInfo: Array<{
        driveLetter: string;
        availableSize: number;
        isNetappDrive: boolean;
        isClusteredWithSelectedInstance?: boolean;
    }>,
    selectedDrive: string,
    metadata: Metadata
) {
    logger.info('checking whether the drive exists', existingDriveInfo, selectedDrive);

    const { sqlDeploymentType } = metadata as unknown as Metadata;
    const isClustered = sqlDeploymentType === 'FCI' ? 'true' : 'false';
    const restrictedDrives = ['A', 'B'];

    if (restrictedDrives.includes(selectedDrive)) {
        throw createError(412, `Selected drive ${selectedDrive} is not a valid drive`);
    }

    const regex = /^[D-Z]{1}$/; // Allows only single Capital Alphabetical letter

    if (!regex.test(selectedDrive)) {
        throw createError(412, `Selected drive ${selectedDrive} is not a valid drive`);
    }

    const matchedExistingDrive = existingDriveInfo?.find(drive => drive.driveLetter === selectedDrive);
    if (!matchedExistingDrive) {
        throw createError(412, `Selected drive letter ${selectedDrive} does not exist`);
    }
    if (!matchedExistingDrive.isNetappDrive) {
        throw createError(412, `Selected drive ${selectedDrive} is not a NetApp iSCSI drive`);
    }
    if (isClustered === 'true' && !matchedExistingDrive.isClusteredWithSelectedInstance) {
        throw createError(
            412,
            `Selected  drive ${selectedDrive} is non clustered drive or drive not part of SQL server`
        );
    }

    return true;
}

async function validateCloneParams(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    srcDetails: HostAndDbInfo,
    destDetails: HostAndDbInfo,
    mountPaths: MountPoints
) {
    logger.info('Validate clone params', { accountId, credentialsId, region, parentJobId, srcDetails, destDetails });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errMsg;

    const validationJob = await registerJob(accountId, credentialsId, region, {
        name: `Validate if sandbox ${destDetails.database} and mount point drives already exists`,
        description: `Validate if the sandbox ${destDetails.database} and mount point drives already exists in the database instance ${destDetails.resourceName}\\${destDetails.databaseInstanceName}`,
        startTime: Date.now(),
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: destDetails.database,
        parentJobId
    });

    try {
        if (srcDetails.host !== destDetails.host || srcDetails.instance !== destDetails.instance) {
            const [srcSqlServerVersion, destSqlServerVersion] = await Promise.all([
                getSqlServerVersion(
                    credentialsId,
                    region,
                    srcDetails.activeNodeInstanceId,
                    srcDetails.instanceName,
                    srcDetails.sqlAuthEnabled
                ),
                getSqlServerVersion(
                    credentialsId,
                    region,
                    destDetails.activeNodeInstanceId,
                    destDetails.instanceName,
                    destDetails.sqlAuthEnabled
                )
            ]);

            if (srcSqlServerVersion > destSqlServerVersion) {
                const errorMessage = 'Sandbox creation from higer SQL version to lower versions is not supported';
                logger.error(errorMessage);
                throw createError(errorMessage);
            }
        }
        const { existingDriveInfo } = await getDriveInfo(
            accountId,
            destDetails.host,
            credentialsId,
            region,
            true,
            CUSTOM_SSM_EXECUTION_TIMEOUT,
            destDetails.instance,
            destDetails.activeNodeDetails
        );

        const [destDatabaseExists, srcDatabaseExists] = await Promise.all([
            checkDatabaseExists(
                accountId,
                credentialsId,
                region,
                destDetails.host,
                destDetails.database,
                destDetails.activeNodeInstanceId,
                destDetails.databaseInstanceName,
                destDetails.instanceName,
                destDetails.databaseInstanceId,
                destDetails.sqlAuthEnabled
            ),
            checkDatabaseExists(
                accountId,
                credentialsId,
                region,
                srcDetails.host,
                srcDetails.database,
                srcDetails.activeNodeInstanceId,
                srcDetails.databaseInstanceName,
                srcDetails.instanceName,
                srcDetails.databaseInstanceId,
                srcDetails.sqlAuthEnabled
            )
        ]);

        if (destDatabaseExists) {
            throw createError(
                412,
                `Database ${destDetails.database} already exists on destination host ${destDetails.resourceName}\\${destDetails.databaseInstanceName}`
            );
        }

        if (!srcDatabaseExists && !isDemoFlow) {
            throw createError(
                412,
                `Database ${srcDetails.database} does not exists on source host ${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`
            );
        }

        const dataDriveExistsPromise = validateSelectedDrives(
            existingDriveInfo,
            mountPaths.dataDrive,
            destDetails.metadata
        );

        const logDriveExistsPromise =
            mountPaths.dataDrive === mountPaths.logDrive
                ? Promise.resolve
                : validateSelectedDrives(existingDriveInfo, mountPaths.logDrive, destDetails.metadata);

        try {
            await Promise.all([dataDriveExistsPromise, logDriveExistsPromise]);
        } catch (err) {
            const errorMessage = `Drive validation failed: ${err}`;
            logger.error(errorMessage);
            throw createError(errorMessage);
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(e);
        errMsg = `Validate failed: ${e.message}`;
        status = JOBSTATUS.FAILED;
        throw createError(e.statusCode, errMsg);
    } finally {
        await updateJobDetails(accountId, validationJob.id, {
            error: errMsg,
            status,
            endTime: Date.now()
        });
    }
}

async function getMappings(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    srcDetails: HostAndDbInfo,
    sandboxName: string,
    isSandboxOptimizeFlow: boolean = false
) {
    logger.info('Get volume mappings', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        srcDetails,
        isSandboxOptimizeFlow
    });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const mappingJob = await registerJob(accountId, credentialsId, region, {
        name: `Get volume LUN mapping for the source database ${srcDetails.database}`,
        description: `Get the volume LUN mapping for the source database ${srcDetails.database} in the database instance ${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`,
        startTime: Date.now(),
        status,
        type: isSandboxOptimizeFlow ? JOBTYPE.WELL_ARCHITECTED : JOBTYPE.SANDBOX,
        resourceName: srcDetails.database,
        parentJobId
    });

    try {
        const { fsxId, database, activeNodeInstanceId, databaseInstanceName, instanceName, sqlAuthEnabled } =
            srcDetails;

        let command = [
            getDbMappedOntapVolumes(
                fsxId,
                region,
                database,
                databaseInstanceName,
                instanceName,
                `Sandbox:${sandboxName}:`,
                sqlAuthEnabled
            )
        ];

        if (isDemoFlow) {
            command = [getDbMappedOntapVolumes('test-fsx', 'us-east-1', 'testdb')];
        }

        const mappings = await callSsmExecution(
            credentialsId,
            region,
            command,
            activeNodeInstanceId,
            'Get volume mappings',
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );

        if (!mappings) {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to get volume lun mapping for the database'
            );
        }

        status = JOBSTATUS.COMPLETED;
        const parsedResp = sqlResponseParsing(mappings);

        if (parsedResp.error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedResp.error);
        }
        return parsedResp;
    } catch (e: any) {
        logger.error(e);

        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    } finally {
        await updateJobDetails(accountId, mappingJob.id, {
            error: errorMsg,
            status,
            endTime: Date.now()
        });
    }
}

async function createVolumeClone(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    srcDetails: HostAndDbInfo,
    destDetails: HostAndDbInfo,
    mapping: VolumeLunMapping,
    snapshot?: string,
    isSandboxOptimizeFlow: boolean = false
) {
    logger.info('Create volume clone', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        mapping,
        snapshot
    });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const createVolumeCloneJob = await registerJob(accountId, credentialsId, region, {
        description: 'Create ONTAP FlexClone volumes from the volumes mapped to the source SQL server',
        startTime: Date.now(),
        name: 'Create ONTAP FlexClone volumes',
        status,
        type: isSandboxOptimizeFlow ? JOBTYPE.WELL_ARCHITECTED : JOBTYPE.SANDBOX,
        resourceName: destDetails.database,
        parentJobId
    });

    try {
        const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
            credentialsId,
            region,
            [destDetails.fsxId],
            { useCache: true }
        );

        const svmList = fsxSVMs?.filter(svm => svm.StorageVirtualMachineId === destDetails.svm) || [];
        const sqlVMName = svmList[0]?.Name;

        let command = [
            CreateVolumeCloneScript(
                srcDetails.fsxId,
                region,
                JSON.stringify({
                    volumes: uniqBy(mapping.data, 'volumeUuid').map(({ volumeName, svm }) => ({ volumeName, svm })),
                    ...(snapshot && { snapshot })
                }),
                JSON.stringify({
                    volumes: uniqBy(mapping.log, 'volumeUuid').map(({ volumeName, svm }) => ({ volumeName, svm })),
                    ...(snapshot && { snapshot })
                }),
                [
                    `cloned_by=${getClonedByTagValue(accountId, credentialsId)}`,
                    `source=${destDetails.host}_${destDetails.instance}`.replace(/-/g, '_')
                ],
                sqlVMName!,
                destDetails.database,
                `Sandbox:${destDetails.database}:`
            )
        ];
        if (isDemoFlow) {
            command = [
                CreateVolumeCloneScript(
                    'test-fsx',
                    'us-east-1',
                    JSON.stringify({ volumeName: 'wlmdb_sqldata_1714098400', svm: 'wlmdb_sqlsvm_1714090636810' }),
                    JSON.stringify({ volumeName: 'wlmdb_sqllog_1714098400', svm: 'wlmdb_sqlsvm_1714090636810' }),
                    ['source=test-res-id', 'cloned_by=netapp_wf_test_account_test_cred'],
                    'target-svm',
                    'testdb'
                )
            ];
        }

        const clonedVolumes = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                command,
                destDetails.activeNodeInstanceId,
                'SandBox: Create Volume Clone',
                accountId,
                false,
                CUSTOM_SSM_EXECUTION_TIMEOUT
            ),
            3,
            5000
        );

        if (!clonedVolumes) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to create clone volume');
        }

        status = JOBSTATUS.COMPLETED;
        const parsedResp = sqlResponseParsing(clonedVolumes);

        if (parsedResp.error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedResp.error);
        }
        return parsedResp;
    } catch (e: any) {
        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    } finally {
        await updateJobDetails(accountId, createVolumeCloneJob.id, {
            error: errorMsg,
            status,
            endTime: Date.now()
        });
    }
}

async function invokeVirtualMount(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    srcDetails: HostAndDbInfo,
    destDetails: HostAndDbInfo,
    mappings: VolumeLunMapping,
    clonedVolumes: ClonedVolumes,
    mountPoints: MountPoints,
    isSandboxOptimizeFlow: boolean = false
) {
    logger.info('Invoke virtual mount', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        srcDetails,
        destDetails,
        mappings,
        clonedVolumes,
        mountPoints
    });

    let retries = 3;
    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const invokeMountJob = await registerJob(accountId, credentialsId, region, {
        name: 'Discover cloned LUNs and create virtual mount point',
        description: `Discover cloned LUNs and create virtual mount points in the database instance ${destDetails.resourceName}\\${destDetails.databaseInstanceName}`,
        startTime: Date.now(),
        status,
        type: isSandboxOptimizeFlow ? JOBTYPE.WELL_ARCHITECTED : JOBTYPE.SANDBOX,
        resourceName: destDetails.database,
        parentJobId
    });

    while (retries > 0) {
        retries -= 1;

        // its required to sleep for 30 seconds so that initialization script will go through.. the ontap LUN configure can take time depending on busy system for the multiple API calls, and the disk initialize may take time to discover the created LUNs
        if (process.env.NODE_ENV !== 'demo' && process.env.NODE_ENV !== 'simulator') {
            // eslint-disable-next-line no-await-in-loop
            await sleep(45000);
        }

        let i = 1;
        const fileLunMap: Array<{ fileName: string; lun: string; folderPath: string; label: string }> = [];
        mappings.data.forEach(vol => {
            const { fileName, volumeName } = vol;

            // We need the fileName from the mappings and the lun serial number from newly cloned volumes
            const clonedVol = clonedVolumes.data.find(dataVols => dataVols.volumeName.includes(volumeName));

            const existingFileLunMap = fileLunMap.find(({ lun }) => lun === clonedVol?.lunSerialNumber);

            fileLunMap.push({
                fileName: fileName.split('\\').pop() as string,
                lun: clonedVol?.lunSerialNumber as string,
                folderPath:
                    existingFileLunMap?.folderPath || `${mountPoints.dataDrive}:\\${destDetails.database}-Data-${i}`,
                label: existingFileLunMap?.label || `${destDetails.database}-Data-${i}`
            });

            i += 1;
        });

        i = 1;
        mappings.log.forEach(vol => {
            const { fileName, volumeName } = vol;

            const clonedVol = clonedVolumes.log.find(logVols => logVols.volumeName.includes(volumeName));

            const existingFileLunMap = fileLunMap.find(({ lun }) => lun === clonedVol?.lunSerialNumber);

            fileLunMap.push({
                fileName: fileName.split('\\').pop() as string,
                lun: clonedVol?.lunSerialNumber as string,
                folderPath:
                    existingFileLunMap?.folderPath || `${mountPoints.logDrive}:\\${destDetails.database}-Log-${i}`,
                label: existingFileLunMap?.label || `${destDetails.database}-Log-${i}`
            });

            i += 1;
        });

        try {
            const isDefaultSqlServerInstance: boolean = destDetails.databaseInstanceName === DEFAULT_INSTANCE_NAME;

            let command = [
                invokeVirtualMountScript(
                    destDetails.database,
                    JSON.stringify(fileLunMap),
                    destDetails.databaseInstanceName!,
                    isDefaultSqlServerInstance,
                    `Sandbox:${destDetails.database}:`
                )
            ];

            if (isDemoFlow) {
                command = [
                    invokeVirtualMountScript(
                        'test-clone',
                        JSON.stringify([
                            {
                                filePath: 'D:\\MSSQL\\data\\testdb_data.mdf',
                                folderName: 'D:\\MSSQL\\data',
                                lun: 'lWB44?VEq9vf'
                            },
                            {
                                filePath: 'E:\\MSSQL\\log\\testdb_log.ldf',
                                folderName: 'E:\\MSSQL\\log',
                                lun: 'lWB44?VEq9ve'
                            }
                        ]),
                        'MSSQLSERVER',
                        true,
                        'Sandbox'
                    )
                ];
            }

            // eslint-disable-next-line no-await-in-loop
            const resp = await callSsmExecution(
                credentialsId,
                region,
                command,
                destDetails.activeNodeInstanceId,
                'Discover LUN and add virtual mount points',
                accountId,
                false,
                CUSTOM_SSM_EXECUTION_TIMEOUT
            );

            if (!resp) {
                throw createError(
                    HttpErrorCodes.INTERNAL_SERVER_ERROR,
                    'Failed to get volume lun mapping for the database'
                );
            }

            const parsedResp = sqlResponseParsing(resp);

            if (parsedResp.error) {
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedResp.error);
            }

            status = JOBSTATUS.COMPLETED;
            return parsedResp;
        } catch (e: any) {
            logger.error(e);
            if (retries === 0) {
                status = JOBSTATUS.FAILED;
                errorMsg = e.message || 'Internal Server Error';
                throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
            }
        } finally {
            if (status === JOBSTATUS.FAILED || status === JOBSTATUS.COMPLETED) {
                // eslint-disable-next-line no-await-in-loop
                await updateJobDetails(accountId, invokeMountJob.id, {
                    error: errorMsg,
                    status,
                    endTime: Date.now()
                });
            }
        }
    }
}

async function createCloneDb(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    destDetails: HostAndDbInfo,
    mountPaths: { dataPath: Array<string>; logPath: Array<string> },
    collation?: string,
    fileSuffix = '',
    isSandboxOptimizeFlow: boolean = false
) {
    logger.info(
        'Create database clone',
        accountId,
        credentialsId,
        region,
        parentJobId,
        destDetails,
        mountPaths,
        collation,
        fileSuffix
    );

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const createCloneDbJob = await registerJob(accountId, credentialsId, region, {
        name: `Create sandbox ${destDetails.database}`,
        description: `Create sandbox ${destDetails.database} in the database instance ${destDetails.resourceName}\\${destDetails.databaseInstanceName}`,
        startTime: Date.now(),

        status,
        type: isSandboxOptimizeFlow ? JOBTYPE.WELL_ARCHITECTED : JOBTYPE.SANDBOX,
        resourceName: destDetails.database,
        parentJobId
    });

    try {
        let command = [
            // The instance name fix is temporary fix where the instance name is retrieved from the getActiveNode method since we are supporting only single instance. The instance value passed by the user in the body of API will ot be used. Once we support multiple instances this needs to be updated as well.
            createCloneDbScript(
                destDetails.database,
                destDetails.databaseInstanceName,
                destDetails.instanceName,
                mountPaths.dataPath,
                mountPaths.logPath,
                `Sandbox:${destDetails.database}:`,
                fileSuffix,
                destDetails.sqlAuthEnabled || false
            )
        ];

        if (isDemoFlow) {
            command = [
                createCloneDbScript(
                    'testdb',
                    DEFAULT_INSTANCE_NAME,
                    DEFAULT_MSSQL_INSTANCE_NAME,
                    ['S:\\testdb_clone-Data\\mssql\\data\\testdb.mdf'],
                    ['L:\\testdb_clone-Log\\mssql\\log\\testdb_log.ldf'],
                    '',
                    '',
                    false
                )
            ];
        }

        const resp = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                command,
                destDetails.activeNodeInstanceId,
                'Clone Database for sandbox',
                accountId,
                false,
                CUSTOM_SSM_EXECUTION_TIMEOUT
            ),
            3,
            5000
        );

        // We only get a response for  different server version or in case of error from query
        if (
            resp &&
            !resp.toLowerCase().includes('converting database') &&
            !resp.includes('running the upgrade step from version') &&
            !resp.includes('The Service Broker in database')
        ) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, resp);
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(e);

        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    } finally {
        await updateJobDetails(accountId, createCloneDbJob.id, {
            error: errorMsg,
            status,
            endTime: Date.now()
        });
    }
}

async function createExtendedProperties(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    srcDetails: HostAndDbInfo,
    destDetails: HostAndDbInfo,
    extendedProps: { [x: string]: number | string | boolean },
    isSandboxOptimizeFlow: boolean = false
) {
    logger.info('Create extended properties', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        srcDetails,
        destDetails,
        extendedProps
    });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const createExtendedPropertiesJob = await registerJob(accountId, credentialsId, region, {
        description: `Add extended properties to sandbox ${destDetails.database} in the database instance ${destDetails.resourceName}\\${destDetails.databaseInstanceName}`,
        startTime: Date.now(),
        name: `Add extended properties to sandbox ${destDetails.database}`,
        status,
        type: isSandboxOptimizeFlow ? JOBTYPE.WELL_ARCHITECTED : JOBTYPE.SANDBOX,
        resourceName: destDetails.database,
        parentJobId
    });

    try {
        let command = [
            addExtendedProperties(
                destDetails.database,
                destDetails.databaseInstanceName,
                destDetails.instanceName,
                extendedProps,
                destDetails.sqlAuthEnabled || false
            )
        ];

        if (isDemoFlow) {
            command = [
                addExtendedProperties(
                    'testdb',
                    DEFAULT_INSTANCE_NAME,
                    DEFAULT_MSSQL_INSTANCE_NAME,
                    {
                        tag: 'demo',
                        cloned_by: 'netapp_wf',
                        source: 'resource|instance|testdb'
                    },
                    false
                )
            ];
        }
        const resp = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                command,
                destDetails.activeNodeInstanceId,
                'Add extended properties to sandbox database'
            ),
            3,
            5000
        );

        // We only get a response in case of error from query
        if (resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, resp);
        }

        if (!destDetails.metadata.sandboxCreated) {
            await updateMetadataForSanbox(accountId, credentialsId, region, destDetails.host);
        }

        if (isDemoFlow) {
            // this is used to retreive the newly created user databases in database list for demo using meta data

            const props = {
                databaseName: destDetails.database,
                databaseInstanceId: destDetails.instance,
                ...extendedProps
            } as Sandbox;

            const updatedInstanceMetadata = await updateSandboxDBIntoInstanceData(
                accountId,
                srcDetails.host,
                props,
                srcDetails.instanceMetadata!
            );

            await updateInstanceMetadata(accountId, destDetails.instance, updatedInstanceMetadata);
            updateUserDBIntoInstanceTable(
                accountId,
                destDetails.instance,
                destDetails.database,
                updatedInstanceMetadata
            );

            const updatedMetadata: Metadata = await updateSandboxDBIntoResourceData(
                accountId,
                credentialsId,
                srcDetails.host,
                props,
                srcDetails.metadata
            );

            await updateUserDBIntoResourceData(
                accountId,
                credentialsId,
                srcDetails.host,
                destDetails.database,
                updatedMetadata
            );
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(e);

        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    } finally {
        await updateJobDetails(accountId, createExtendedPropertiesJob.id, {
            error: errorMsg,
            status,
            endTime: Date.now()
        });
    }
}

async function startCleanup(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    srcDetails: HostAndDbInfo,
    destDetails: HostAndDbInfo,
    volumeIds: Array<string>,
    filePaths: Array<string>,
    isOptimizeFlow: boolean = false,
    isSandboxOptimizeFlow: boolean = false
) {
    logger.info('Start cleanup', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        srcDetails,
        destDetails,
        volumeIds,
        filePaths,
        isOptimizeFlow,
        isSandboxOptimizeFlow
    });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;
    const name = isOptimizeFlow ? 'Clone' : 'sandbox';
    const jobType = isSandboxOptimizeFlow ? JOBTYPE.WELL_ARCHITECTED : JOBTYPE.SANDBOX;

    const cleanupJob = await registerJob(accountId, credentialsId, region, {
        description: `Clean up resources for ${name} ${destDetails.database} in the database instance ${destDetails.resourceName}\\${destDetails.databaseInstanceName}`,
        startTime: Date.now(),
        name: `Clean up resources for ${name} ${destDetails.database}`, // This exact name is used to mark the parent job status as failed if any of the child job fails
        status,
        type: jobType,
        resourceName: destDetails.database,
        parentJobId
    });

    try {
        let command = [
            cleanUpOntapResources(
                destDetails.fsxId,
                region,
                JSON.stringify(volumeIds),
                JSON.stringify(filePaths),
                destDetails.database,
                destDetails.instanceName,
                destDetails.databaseInstanceName,
                `SandBox:${destDetails.database}:`,
                destDetails.sqlAuthEnabled || false
            )
        ];

        if (isDemoFlow) {
            command = [
                cleanUpOntapResources(
                    'test-fsx',
                    'us-east-1',
                    JSON.stringify(['5c1075d2-03a0-11ef-a514-55070fbfcab1', '5ace31ea-03a0-11ef-a514-55070fbfcab1']),
                    JSON.stringify([
                        'S:\\testdb_clone-Data\\mssql\\data\\testdb.mdf',
                        'L:\\testdb_clone-Log\\mssql\\log\\testdb_log.ldf'
                    ]),
                    'testdb',
                    DEFAULT_MSSQL_INSTANCE_NAME,
                    DEFAULT_INSTANCE_NAME,
                    '',
                    false
                )
            ];
        }

        const resp = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                command,
                destDetails.activeNodeInstanceId,
                `Cleanup ${name} resources`,
                accountId,
                false,
                CUSTOM_SSM_EXECUTION_TIMEOUT
            ),
            3,
            5000
        );

        if (!resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to cleanup');
        }

        const jsonResp = sqlResponseParsing(resp);

        if (jsonResp.error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, jsonResp.error);
        }

        status = JOBSTATUS.COMPLETED;
        return jsonResp;
    } catch (e: any) {
        logger.error(`Failed to perform cleanup for ${name} ${destDetails.database}`);
        status = JOBSTATUS.FAILED;
        errorMsg = `Failed to clean up ${e.message}`;
        throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    } finally {
        await updateJobDetails(accountId, cleanupJob.id, {
            error: errorMsg,
            status,
            endTime: Date.now()
        });
    }
}

async function updateMetadataForSanbox(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string
) {
    logger.info('Updating metadata for sandbox operation', accountId, credentialsId, region, databaseHostId);
    const {
        items: [resourceDetail]
    } = await getResources({
        accountId,
        resourceId: databaseHostId
    });

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }
    const { metadata } = resourceDetail;

    const newMetadata = metadata as unknown as Metadata;
    newMetadata.sandboxCreated = true;
    try {
        await updateResourceMetaData(accountId, credentialsId, databaseHostId, newMetadata);
        logger.info('Metadata updated succesfully for sandbox operation', accountId, databaseHostId);
    } catch (err) {
        const errorMessage = `Failed to update metadata for sandbox operation, ${accountId}, ${databaseHostId}, ${err}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function updateMetadataForSanboxDeletion(
    accountId: string,
    credentialsId: string,
    region: string,
    resourceDetails: HostAndDbInfo,
    isSplit: boolean = false
) {
    logger.info('Updating metadata for sandbox operation', accountId, credentialsId, region);
    const {
        host: databaseHostId,
        database: databaseNameToRemove,
        instance: databaseInstanceId,
        instanceMetadata
    } = resourceDetails;
    const {
        items: [resourceDetail]
    } = await getResources({
        accountId,
        resourceId: databaseHostId
    });

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }
    const { metadata } = resourceDetail;
    const newMetadata = metadata as unknown as Metadata;

    const newInstanceMetadata = instanceMetadata as unknown as DatabaseInstanceMetadata;

    newInstanceMetadata.sandboxes = instanceMetadata?.sandboxes?.filter(
        sandbox => sandbox.databaseName !== databaseNameToRemove
    );

    newMetadata.sandboxes = newMetadata.sandboxes?.filter(sandbox => sandbox.databaseName !== databaseNameToRemove);

    if (!isSplit) {
        newMetadata.userDatabase = newMetadata.userDatabase?.filter(db => db.name !== databaseNameToRemove);
        newInstanceMetadata.userDatabase = newInstanceMetadata.userDatabase?.filter(
            db => db.name !== databaseNameToRemove
        );
    }

    try {
        await updateResourceMetaData(accountId, credentialsId, databaseHostId, newMetadata);
        await updateInstanceMetadata(accountId, databaseInstanceId, newInstanceMetadata);
        logger.info('Metadata updated succesfully for sandbox operation', accountId, databaseHostId);
    } catch (err) {
        const errorMessage = `Failed to update metadata for sandbox operation, ${accountId}, ${databaseHostId}, ${err}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function getSandboxConnectionString(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    sandboxName: string
) {
    logger.info('Get connection string', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        sandboxName
    });
    try {
        const source = { host: databaseHostId, instance: databaseInstanceId, database: sandboxName };

        const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, source, source);

        const { databaseInstanceName, activeNodeInstanceId, metadata, resourceName } = srcDetails;

        const { activeDirectoryName } = metadata;

        if (activeDirectoryName) {
            return {
                server: `${resourceName}.${activeDirectoryName}${
                    databaseInstanceName !== DEFAULT_INSTANCE_NAME ? `\\${databaseInstanceName}` : ''
                }`,
                database: sandboxName
            };
        }

        let command = [
            getConnectionInfo(
                databaseInstanceName === DEFAULT_INSTANCE_NAME ? '' : databaseInstanceName,
                srcDetails.sqlAuthEnabled
            )
        ];

        if (isDemoFlow) {
            command = [getConnectionInfo('MSSQLSERVER', false)];
        }

        const resp = await callSsmExecution(
            credentialsId,
            region,
            command,
            activeNodeInstanceId!,
            'Get sandbox database connection info'
        );

        if (!resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get the connection string');
        }

        const parsedResp = sqlResponseParsing(resp);

        if (parsedResp.error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedResp.error);
        }

        return {
            server: parsedResp.server,
            database: sandboxName
        };
    } catch (e: any) {
        logger.error(`Failed to get the connection string for sandbox ${sandboxName} in host ${databaseHostId}, ${e}`);
        throw createError(e.statusCode, e.message);
    }
}

async function getDatabaseMountPointInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    databaseName: string
) {
    logger.info(
        'Fetching mount point information',
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseInstanceId,
        databaseName
    );

    const src = { host: databaseHostId, instance: databaseInstanceId, database: databaseName };
    const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, src, src);

    try {
        if (isDemoFlow) {
            srcDetails.databaseInstanceName = 'MSSQLSERVER';
            databaseName = 'test-database';
        }

        let command = [
            sqlQueryExecution(
                srcDetails.databaseInstanceName,
                srcDetails.instanceName,
                mountPointQuery(databaseName),
                srcDetails.sqlAuthEnabled
            )
        ];

        if (isDemoFlow) {
            command = [sqlQueryExecution('MSSQLSERVER', '$env:computername', mountPointQuery('test-database'), true)];
        }

        const mountPoints = await callSsmExecution(
            credentialsId,
            region,
            command,
            srcDetails.activeNodeInstanceId,
            'Get database mount points'
        );
        if (!mountPoints) {
            throw createError('No mount points found.');
        }
        const parsedResp = sqlResponseParsing(mountPoints);

        const result: DatabaseMountPointResponseType = {
            databaseDataPath: [],
            databaseLogPath: []
        };

        parsedResp.forEach((item: { filepath: string; filetype: string }) => {
            const driveType = item.filetype === 'Data' ? 'databaseDataPath' : 'databaseLogPath';
            result[driveType].push(item.filepath);
        });
        if (isDemoFlow) {
            const updatedResult = {
                databaseDataPath: result.databaseDataPath.map((path: string) =>
                    path.replace('test-database', databaseName)
                ),
                databaseLogPath: result.databaseLogPath.map((path: string) =>
                    path.replace('test-database', databaseName)
                )
            };
            return updatedResult;
        }

        return result;
    } catch (err) {
        const errorMessage = `Failed to get mount point info for the database ${databaseName} in host ${databaseHostId}: ${err} `;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function deleteSandbox(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    databaseName: string
) {
    logger.info(
        `Delete sandbox ${databaseName} in database host ${databaseHostId}`,
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseName
    );

    try {
        const source = { host: databaseHostId, instance: databaseInstanceId, database: databaseName };
        const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, source, source);

        const job = await registerJob(accountId, credentialsId, region, {
            name: `Delete sandbox ${databaseName}`,
            description: `Delete sandbox ${databaseName} in the database instance ${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`,
            resourceName: databaseName,
            initiator: 'SYSTEM',
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.SANDBOX
        });

        updateLongRunningAuditGroup(
            undefined,
            undefined,
            `${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`
        );

        performSandboxDeletion(accountId, region, credentialsId, job.id, srcDetails);

        return { jobId: job.id };
    } catch (err: any) {
        const errorMsg = `Error while deleting sandbox ${databaseName} in database host ${databaseHostId}. ${err?.message}`;
        logger.error(errorMsg, err);
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMsg);
        throw createError(err.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}

async function performSandboxDeletion(
    accountId: string,
    region: string,
    credentialsId: string,
    parentJobId: string,
    resDetails: HostAndDbInfo,
    isOptimizeFlow: boolean = false,
    isSandboxOptimizeFlow: boolean = false
) {
    let errorMsg;
    let status: string = JOBSTATUS.IN_PROGRESS;
    const name = isOptimizeFlow ? 'Clone' : 'sandbox';

    try {
        // Creating a validation job to accomodate more validations in the future in one job
        await validateDeleteSandboxParams(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resDetails,
            isOptimizeFlow,
            isSandboxOptimizeFlow
        );

        const mappings = (await getMappings(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resDetails,
            resDetails.database,
            isSandboxOptimizeFlow
        )) as VolumeLunMapping;

        await startCleanup(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resDetails,
            resDetails,
            uniq([...mappings.data.map(vol => vol.volumeUuid), ...mappings.log.map(vol => vol.volumeUuid)]),
            uniq([...mappings.data.map(map => map.fileName), ...mappings.log.map(map => map.fileName)]),
            isOptimizeFlow,
            isSandboxOptimizeFlow
        );
        status = JOBSTATUS.COMPLETED;
        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } catch (e: any) {
        logger.error(`Failed to delete the ${name}`, e);
        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMsg);
        if (isSandboxOptimizeFlow) {
            throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
        }
    } finally {
        await updateJobDetails(accountId, parentJobId, {
            status,
            error: errorMsg,
            endTime: Date.now()
        });
        if (isDemoFlow) {
            updateMetadataForSanboxDeletion(accountId, credentialsId, region, resDetails);
        }
    }
}

async function validateDeleteSandboxParams(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    resourceDetails: HostAndDbInfo,
    isOptimizeFlow: boolean = false,
    isSandboxOptimizeFlow: boolean = false
) {
    const name = isOptimizeFlow ? 'Clone' : 'sandbox';
    const jobType = isSandboxOptimizeFlow ? JOBTYPE.WELL_ARCHITECTED : JOBTYPE.SANDBOX;

    logger.info(`Validate delete ${name} params`, {
        accountId,
        credentialsId,
        region,
        parentJobId,
        resourceDetails,
        isOptimizeFlow
    });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const validationJob = await registerJob(accountId, credentialsId, region, {
        name: `Validate if ${name} ${resourceDetails.database} exists`,
        description: `Validate if the ${name} ${resourceDetails.database} exists in the database instance ${resourceDetails.resourceName}\\${resourceDetails.databaseInstanceName}`,
        startTime: Date.now(),
        status,
        type: jobType,
        resourceName: resourceDetails.database,
        parentJobId
    });

    try {
        const dbExists = await checkDatabaseExists(
            accountId,
            credentialsId,
            region,
            resourceDetails.host,
            resourceDetails.database,
            resourceDetails.activeNodeInstanceId,
            resourceDetails.databaseInstanceName,
            resourceDetails.instanceName,
            resourceDetails.databaseInstanceId,
            resourceDetails.sqlAuthEnabled
        );

        if (!dbExists && !isDemoFlow) {
            throw createError(
                412,
                `Database ${resourceDetails.database} does not exists on source host ${resourceDetails.resourceName}\\${resourceDetails.databaseInstanceName}`
            );
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(e);
        errorMsg = e.message || 'Internal Server Error';
        status = JOBSTATUS.FAILED;
        throw createError(e.statusCode, errorMsg);
    } finally {
        await updateJobDetails(accountId, validationJob.id, {
            error: errorMsg,
            status,
            endTime: Date.now()
        });
    }
}

async function getSandboxSplitEstimate(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    sandboxName: string
) {
    logger.info('Get split estimate of mapped volumes', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        sandboxName
    });

    const src = {
        host: databaseHostId,
        instance: databaseInstanceId,
        database: sandboxName
    };
    const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, src, src);

    const { fsxId, activeNodeInstanceId, databaseInstanceName, instanceName, sqlAuthEnabled } = srcDetails;

    let command = [
        getDbMappedOntapVolumes(
            fsxId,
            region,
            sandboxName,
            databaseInstanceName,
            instanceName,
            `Sandbox:${sandboxName}:`,
            sqlAuthEnabled
        )
    ];

    if (isDemoFlow) {
        command = [getDbMappedOntapVolumes('test-fsx', 'us-east-1', 'testdb')];
    }

    const mappings = await callSsmExecution(
        credentialsId,
        region,
        command,
        activeNodeInstanceId,
        'Get volume mappings',
        accountId,
        false
    );

    if (!mappings) {
        logger.error('Failed to get volume lun mapping for the database', { databaseHostId, sandboxName });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get volume lun mapping for the database');
    }

    const parsedResp = sqlResponseParsing(mappings);

    if (parsedResp?.error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedResp.error);
    }

    const mappingData = [...parsedResp.data, ...parsedResp.log];

    if (mappingData.some(vol => !vol.parentVolume)) {
        throw createError(
            HttpErrorCodes.VALIDATION_ERROR,
            'The sandbox seems to be already split and hence cannot be altered.'
        );
    }

    return mappingData.map((record: { volumeName: string; splitEstimate: number }) => ({
        name: record.volumeName,
        splitEstimate: record.splitEstimate || 0
    }));
}

async function updateSandboxLifeCycle(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    databaseName: string,
    action: string,
    snapshot?: string
) {
    logger.info(
        `Update Sandbox life cycle for ${databaseName} in database host ${databaseHostId}`,
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        databaseName,
        action,
        snapshot
    );

    try {
        const source = { host: databaseHostId, instance: databaseInstanceId, database: databaseName };
        const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, source, source);

        const job = await registerJob(accountId, credentialsId, region, {
            name: `${
                action === SANDBOX_LIFECYCLE_REFRESH
                    ? SandboxLifecycleAction.REFRESH
                    : SandboxLifecycleAction.REBASELINE
            } sandbox ${databaseName}`,
            description: `${
                action === SANDBOX_LIFECYCLE_REFRESH
                    ? SandboxLifecycleAction.REFRESH
                    : SandboxLifecycleAction.REBASELINE
            } sandbox ${databaseName} in the database instance ${srcDetails.resourceName}\\${
                srcDetails.databaseInstanceName
            }`,
            initiator: 'SYSTEM',
            type: JOBTYPE.SANDBOX,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: databaseName,
            startTime: Date.now()
        });

        updateLongRunningAuditGroup(
            undefined,
            undefined,
            `${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`
        );

        performLifecycleUpdate(accountId, credentialsId, region, job.id, srcDetails, action, snapshot);

        return { jobId: job.id };
    } catch (err: any) {
        const errorMsg = `Error while updating Sandbox life cycle for ${databaseName} in database host ${databaseHostId}. ${err?.message}`;
        logger.error(errorMsg, err);
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMsg);
        throw createError(err.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}

async function performLifecycleUpdate(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    resourceDetails: HostAndDbInfo,
    action: string,
    snapshot?: string,
    isSandboxOptimizeFlow: boolean = false
) {
    let errorMsg;
    let mappings: undefined | VolumeLunMapping;
    let clonedVolumes;
    let mountPaths;
    let sandboxUpdated = false;
    let sandboxDetached = false;
    const fileSuffix = '-sandbox';
    try {
        await validateLifeCycleParams(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            action,
            isSandboxOptimizeFlow
        );

        mappings = (await getMappings(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            resourceDetails.database,
            isSandboxOptimizeFlow
        )) as VolumeLunMapping;

        const mappingData = [...mappings.data, ...mappings.log];

        if (mappingData.some(vol => !vol.parentVolume)) {
            throw createError(
                HttpErrorCodes.VALIDATION_ERROR,
                'The sandbox seems to be already split and hence cannot be altered.'
            );
        }

        clonedVolumes = (await createVolumeClone(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            resourceDetails,
            {
                data: mappings.data.map(vol => ({ ...vol, volumeName: vol.parentVolume!, svm: vol.parentSvm! })),
                log: mappings.log.map(vol => ({ ...vol, volumeName: vol.parentVolume!, svm: vol.parentSvm! }))
            },
            action === SANDBOX_LIFECYCLE_REFRESH ? snapshot : mappings.data[0]?.parentSnapshot,
            isSandboxOptimizeFlow
        )) as ClonedVolumes;

        let extendedProps = (await detachSandboxAndAccessPath(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            mappings,
            isSandboxOptimizeFlow
        )) as Sandbox;

        sandboxDetached = true;

        mountPaths = (await invokeVirtualMount(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            resourceDetails,
            // Changing the file name to match parent file names and volume to match the parent volume name as refresh is done on parent db
            {
                ...mappings,
                data: mappings.data.map(vol => ({
                    ...vol,
                    volumeName: vol.parentVolume!,
                    fileName: vol.fileName.replace(`${fileSuffix}.mdf`, '.mdf').replace(`${fileSuffix}.ndf`, '.ndf')
                })),
                log: mappings.log.map(vol => ({
                    ...vol,
                    volumeName: vol.parentVolume!,
                    fileName: vol.fileName.replace(`${fileSuffix}.ldf`, '.ldf')
                }))
            },
            clonedVolumes,
            {
                dataDrive: mappings.data[0].fileName.split(':')[0],
                logDrive: mappings.log[0].fileName.split(':')[0]
            },
            isSandboxOptimizeFlow
        )) as { files: Array<string> };

        const fileDataArr = mountPaths.files.map(path => {
            const fileData = mappingData.find(vol => {
                const oldFileName = vol.fileName
                    .split('\\')
                    .pop()
                    ?.replace(`${fileSuffix}.mdf`, '.mdf')
                    .replace(`${fileSuffix}.ndf`, '.ndf')
                    .replace(`${fileSuffix}.ldf`, '.ldf');
                const newFileName = path.split('\\').pop();
                return oldFileName === newFileName;
            });
            return {
                filePath: path,
                fileId: fileData?.fileId || 0,
                fileType: fileData?.fileType || 0
            };
        });

        await createCloneDb(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            {
                dataPath: fileDataArr
                    .filter(file => Number(file.fileType) === 0)
                    .sort((a, b) => Number(a.fileId) - Number(b.fileId))
                    .map(pathObj => pathObj.filePath),
                logPath: fileDataArr
                    .filter(file => Number(file.fileType) === 1)
                    .sort((a, b) => Number(a.fileId) - Number(b.fileId))
                    .map(pathObj => pathObj.filePath)
            },
            undefined,
            fileSuffix,
            isSandboxOptimizeFlow
        );

        if (isDemoFlow) {
            const existingProps = resourceDetails.metadata.sandboxes?.find(
                ({ databaseName }) => databaseName === resourceDetails.database
            );
            if (existingProps) {
                extendedProps = existingProps;
            }
        }

        await createExtendedProperties(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            resourceDetails,
            {
                ...extendedProps,
                updatedAt: Date.now()
            },
            isSandboxOptimizeFlow
        );

        sandboxUpdated = true;

        // Clean up older volumes
        await startCleanup(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            resourceDetails,
            uniq([...mappings.data.map(vol => vol.volumeUuid), ...mappings.log.map(vol => vol.volumeUuid)]),
            []
        );

        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } catch (e: any) {
        logger.error(`Failed to perform lifecycle update for sandbox ${resourceDetails.database}`, e);
        errorMsg = e.message || 'Internal Server Error';
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMsg);
        // Clean up only when the sandbox is not updated
        if (!sandboxUpdated) {
            await startCleanup(
                accountId,
                credentialsId,
                region,
                parentJobId,
                resourceDetails,
                resourceDetails,
                clonedVolumes
                    ? uniq([
                          ...clonedVolumes.data.map(vol => vol.volumeId),
                          ...clonedVolumes.log.map(vol => vol.volumeId)
                      ])
                    : [],
                []
            );

            if (sandboxDetached && mappings) {
                await reAttachSandboxAndAccessPath(
                    accountId,
                    credentialsId,
                    region,
                    parentJobId,
                    resourceDetails,
                    mappings
                );
            }
        }
        if (isSandboxOptimizeFlow) {
            throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
        }
    } finally {
        // check any of the sub job has failure if so udpate the paraent job as warning which is completed with failure in status shown
        await updateParentJobStatus(accountId, parentJobId, true, errorMsg);
    }
}

async function validateLifeCycleParams(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    resourceDetails: HostAndDbInfo,
    action: string,
    isSandboxOptimizeFlow: boolean = false
) {
    logger.info(
        'Validate lifecycle parameters',
        accountId,
        credentialsId,
        region,
        parentJobId,
        resourceDetails,
        isSandboxOptimizeFlow
    );

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errMsg;

    const validationJob = await registerJob(accountId, credentialsId, region, {
        type: isSandboxOptimizeFlow ? JOBTYPE.WELL_ARCHITECTED : JOBTYPE.SANDBOX,
        status,
        name: `Validate ${
            action === SANDBOX_LIFECYCLE_REFRESH ? SandboxLifecycleAction.REFRESH : SandboxLifecycleAction.REBASELINE
        } parameters for sandbox ${resourceDetails.database}`,
        description: `Validate ${
            action === SANDBOX_LIFECYCLE_REFRESH ? SandboxLifecycleAction.REFRESH : SandboxLifecycleAction.REBASELINE
        } parameters for sandbox ${resourceDetails.database} in the database instance ${
            resourceDetails.resourceName
        }\\${resourceDetails.databaseInstanceName}`,
        resourceName: resourceDetails.database,
        startTime: Date.now(),
        parentJobId
    });

    try {
        const {
            host,
            database,
            activeNodeInstanceId,
            databaseInstanceName,
            databaseInstanceId,
            sqlAuthEnabled,
            instanceName
        } = resourceDetails;

        const dbExists = await checkDatabaseExists(
            accountId,
            credentialsId,
            region,
            host,
            database,
            activeNodeInstanceId!,
            databaseInstanceName,
            instanceName,
            databaseInstanceId,
            sqlAuthEnabled
        );

        if (!dbExists && !isDemoFlow) {
            throw createError(
                412,
                `Database ${resourceDetails.database} does not exists on host ${resourceDetails.resourceName}\\${resourceDetails}\\${resourceDetails.databaseInstanceName}`
            );
        }
        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(e);
        status = JOBSTATUS.FAILED;
        errMsg = `Validate failed: ${e.message}`;
        throw createError(e.statusCode, e.message);
    } finally {
        await updateJobDetails(accountId, validationJob.id, {
            error: errMsg,
            status,
            endTime: Date.now()
        });
    }
}

async function detachSandboxAndAccessPath(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    resourceDetails: HostAndDbInfo,
    mappings: VolumeLunMapping,
    isSandboxOptimizeFlow: boolean = false
) {
    logger.info('Detach sandbox and access path', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        resourceDetails,
        mappings
    });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errMsg;

    const detachJob = await registerJob(accountId, credentialsId, region, {
        name: `Detach sandbox and remove access path for ${resourceDetails.database}`,
        startTime: Date.now(),
        description: `Detach sandbox and access path for ${resourceDetails.database} in the database instance ${resourceDetails.resourceName}\\${resourceDetails.databaseInstanceName}`,
        status,
        type: isSandboxOptimizeFlow ? JOBTYPE.WELL_ARCHITECTED : JOBTYPE.SANDBOX,
        resourceName: resourceDetails.database,
        parentJobId
    });

    try {
        let command = [
            detachDbAndRemoveAccessPath(
                resourceDetails.database,
                JSON.stringify(
                    uniq([
                        ...mappings.data.map(vol => vol.lunSerialNumber),
                        ...mappings.log.map(vol => vol.lunSerialNumber)
                    ])
                ),
                JSON.stringify([...mappings.data.map(vol => vol.fileName), ...mappings.log.map(vol => vol.fileName)]),
                resourceDetails.instanceName,
                resourceDetails.databaseInstanceName,
                `SandBox:${resourceDetails.database}:`,
                resourceDetails.sqlAuthEnabled || false
            )
        ];

        if (isDemoFlow) {
            command = [
                detachDbAndRemoveAccessPath(
                    'test-db',
                    '["123456789", "987654321"]',
                    '["S:\\test-db-Data", "L:\\test-db-Log"]',
                    DEFAULT_MSSQL_INSTANCE_NAME,
                    DEFAULT_INSTANCE_NAME,
                    '',
                    false
                )
            ];
        }

        const resp = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                command,
                resourceDetails.activeNodeInstanceId,
                'Detach sandbox and access path',
                accountId,
                false,
                CUSTOM_SSM_EXECUTION_TIMEOUT
            ),
            3,
            5000
        );

        if (!resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Interval Server Error');
        }

        const jsonResp = sqlResponseParsing(resp);

        if (jsonResp.error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, jsonResp.error);
        }

        status = JOBSTATUS.COMPLETED;
        return jsonResp;
    } catch (e: any) {
        logger.error('Failed to detach sandbox and delete access path', e);
        status = JOBSTATUS.FAILED;
        errMsg = e.message || e || 'Internal Server Error';
        throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg);
    } finally {
        await updateJobDetails(accountId, detachJob.id, {
            status,
            endTime: Date.now(),
            error: errMsg
        });
    }
}

async function reAttachSandboxAndAccessPath(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    resourceDetails: HostAndDbInfo,
    mappings: VolumeLunMapping
) {
    logger.info('Re-attach sandbox and access path', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        resourceDetails,
        mappings
    });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errMsg;

    const reattachJob = await registerJob(accountId, credentialsId, region, {
        name: `Re-attach sandbox and access path for ${resourceDetails.database}`,
        startTime: Date.now(),
        description: `Re-attach sandbox and access path for ${resourceDetails.database} in the database instance ${resourceDetails.resourceName}\\${resourceDetails.databaseInstanceName}`,
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: resourceDetails.database,
        parentJobId
    });

    try {
        const fileLunMap: Array<{ lun: string; fileName: string; label: string; folderPath: string }> = [];

        mappings.data
            .sort((a, b) => Number(a.fileId) - Number(b.fileId))
            .forEach(vol => {
                const { fileName, lunSerialNumber } = vol;

                const folderPath = fileName.split('\\').slice(0, 2).join('\\');
                const label = folderPath.split('\\').pop() || `${resourceDetails.database}-Data`;

                fileLunMap.push({
                    fileName: fileName.split('\\')?.pop() as string,
                    lun: lunSerialNumber,
                    label,
                    folderPath
                });
            });

        mappings.log
            .sort((a, b) => Number(a.fileId) - Number(b.fileId))
            .forEach(vol => {
                const { fileName, lunSerialNumber } = vol;

                const folderPath = fileName.split('\\').slice(0, 2).join('\\');
                const label = folderPath.split('\\').pop() || `${resourceDetails.database}-Log`;

                fileLunMap.push({
                    fileName: fileName.split('\\')?.pop() as string,
                    lun: lunSerialNumber,
                    label,
                    folderPath
                });
            });

        let command = [
            invokeVirtualMountScript(
                resourceDetails.database,
                JSON.stringify(fileLunMap),
                resourceDetails.instanceName,
                resourceDetails.databaseInstanceName === DEFAULT_INSTANCE_NAME,
                `SandBox:${resourceDetails.database}:`
            )
        ];
        let resp = await callSsmExecution(
            credentialsId,
            region,
            command,
            resourceDetails.activeNodeInstanceId,
            'Discover LUN and add virtual mount points',
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );

        if (!resp) {
            logger.error('Failed to re-attach sandbox and add access path, SSM command response is empty');
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to re-attach: Internal Server Error');
        }

        const jsonResp = sqlResponseParsing(resp);

        if (jsonResp.error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, jsonResp.error);
        }

        command = [
            addAccessPathAndAttachDb(
                resourceDetails.database,
                JSON.stringify([
                    ...mappings.data
                        .map(({ fileName, fileId, fileType }) => ({
                            fileName,
                            fileId,
                            fileType
                        }))
                        .sort((a, b) => Number(a.fileId) - Number(b.fileId))
                        .map(({ fileName }) => fileName),
                    ...mappings.log
                        .map(({ fileName, fileId, fileType }) => ({
                            fileName,
                            fileId,
                            fileType
                        }))
                        .sort((a, b) => Number(a.fileId) - Number(b.fileId))
                        .map(({ fileName }) => fileName)
                ]),
                resourceDetails.instanceName,
                resourceDetails.databaseInstanceName,
                `SandBox:${resourceDetails.database}:`,
                resourceDetails.sqlAuthEnabled || false
            )
        ];

        resp = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                command,
                resourceDetails.activeNodeInstanceId,
                'Attach sandbox and add access path',
                accountId,
                false,
                CUSTOM_SSM_EXECUTION_TIMEOUT
            ),
            3,
            5000
        );

        // We only get a response for  different server version or in case of error from query
        if (
            resp &&
            !resp.toLowerCase().includes('converting database') &&
            !resp.includes('running the upgrade step from version') &&
            !resp.includes('The Service Broker in database')
        ) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, resp);
        }

        status = JOBSTATUS.COMPLETED;
        return jsonResp;
    } catch (e: any) {
        logger.error('Failed to re-attach sandbox and add access path', e);
        status = JOBSTATUS.FAILED;
        errMsg = e.message || e || 'Internal Server Error';
        throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg);
    } finally {
        await updateJobDetails(accountId, reattachJob.id, {
            status,
            endTime: Date.now(),
            error: errMsg
        });
    }
}

async function splitSandbox(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    databaseName: string
) {
    logger.info('Split sandbox', { accountId, credentialsId, region, databaseHostId, databaseName });

    const source = { host: databaseHostId, instance: databaseInstanceId, database: databaseName };
    const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, source, source);

    const job = await registerJob(accountId, credentialsId, region, {
        name: `Split sandbox ${databaseName} in the database instance ${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`,
        description: `Split sandbox ${databaseName} in the database instance ${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`,
        initiator: 'SYSTEM',
        type: JOBTYPE.SANDBOX,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: databaseName,
        startTime: Date.now()
    });

    updateLongRunningAuditGroup(undefined, undefined, `${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`);

    performSplitOperation(accountId, credentialsId, region, job.id, srcDetails);

    return { jobId: job.id };
}

async function performSplitOperation(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    resDetails: HostAndDbInfo
) {
    logger.info('Perform split operation', { accountId, region, credentialsId, parentJobId, resDetails });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errMsg;
    try {
        await validateSplitParams(accountId, credentialsId, region, parentJobId, resDetails);

        const mappings = (await getMappings(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resDetails,
            resDetails.database
        )) as VolumeLunMapping;

        const mappedVolumes = [...mappings.data, ...mappings.log];
        if (mappedVolumes.some(vol => !vol.parentVolume)) {
            throw createError(
                HttpErrorCodes.VALIDATION_ERROR,
                'The sandbox seems to be already split and hence cannot be altered.'
            );
        }

        await splitVolumes(
            accountId,
            credentialsId,
            region,
            parentJobId,
            [
                ...mappings.data.map(vol => ({ volumeId: vol.volumeUuid, volumeName: vol.volumeName })),
                ...mappings.log.map(vol => ({ volumeId: vol.volumeUuid, volumeName: vol.volumeName }))
            ],
            resDetails
        );

        await deleteExtendedProperties(accountId, credentialsId, region, parentJobId, resDetails);

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        status = JOBSTATUS.FAILED;
        errMsg = e.message || 'Internal Server Error';
    } finally {
        await updateJobDetails(accountId, parentJobId, {
            status,
            error: errMsg,
            endTime: Date.now()
        });
    }
}

async function validateSplitParams(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    resourceDetails: HostAndDbInfo
) {
    logger.info('Validate split parameters', { accountId, credentialsId, region, parentJobId, resourceDetails });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const validationJob = await registerJob(accountId, credentialsId, region, {
        description: `Validate if the sandbox ${resourceDetails.database} exists in the database instance ${resourceDetails.resourceName}\\${resourceDetails.databaseInstanceName}`,
        startTime: Date.now(),
        name: `Validate if sandbox ${resourceDetails.database} exists`,
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: resourceDetails.database,
        parentJobId
    });

    try {
        const {
            host,
            database,
            instanceName,
            activeNodeInstanceId,
            databaseInstanceId,
            databaseInstanceName,
            sqlAuthEnabled
        } = resourceDetails;

        const dbExists = await checkDatabaseExists(
            accountId,
            credentialsId,
            region,
            host,
            database,
            activeNodeInstanceId,
            databaseInstanceName,
            instanceName,
            databaseInstanceId,
            sqlAuthEnabled
        );

        if (!dbExists && !isDemoFlow) {
            throw createError(
                412,
                `Database ${resourceDetails.database} does not exists on source host ${resourceDetails.resourceName}\\${resourceDetails.databaseInstanceName}`
            );
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(e);
        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode, errorMsg);
    } finally {
        await updateJobDetails(accountId, validationJob.id, {
            error: errorMsg,
            status,
            endTime: Date.now()
        });
    }
}

async function splitVolumes(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    volumes: { volumeId: string; volumeName: string }[],
    resourceDetail: HostAndDbInfo
) {
    logger.info('Split volumes', { accountId, credentialsId, region, parentJobId, volumes, resourceDetail });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;
    const splitJob = await registerJob(accountId, credentialsId, region, {
        name: `Split volumes for sandbox ${resourceDetail.database}`,
        description: `Split volumes for sandbox ${resourceDetail.database} in the database instance ${resourceDetail.resourceName}\\${resourceDetail.databaseInstanceName}`,
        type: JOBTYPE.SANDBOX,
        status,
        resourceName: resourceDetail.database,
        startTime: Date.now(),
        parentJobId
    });

    try {
        const command = [
            splitFlexCloneVolumes(
                resourceDetail.fsxId,
                region,
                JSON.stringify(uniqBy(volumes, 'volumeId')),
                resourceDetail.instanceName,
                `Sandbox:${resourceDetail.database}:`
            )
        ];

        const resp = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                command,
                resourceDetail.activeNodeInstanceId,
                'Split volume for creating sandbox',
                accountId,
                false,
                CUSTOM_SSM_EXECUTION_TIMEOUT
            ),
            3,
            5000
        );

        if (!resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to split the volumes');
        }

        const parsedResp = sqlResponseParsing(resp);

        if (parsedResp.error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedResp.error);
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(`Failed to split the volume: ${e}`);
        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode, errorMsg);
    } finally {
        await updateJobDetails(accountId, splitJob.id, {
            status,
            error: errorMsg,
            endTime: Date.now()
        });
    }
}

async function deleteExtendedProperties(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    resourceDetail: HostAndDbInfo
) {
    logger.info('Delete extended properties', { accountId, credentialsId, region, parentJobId, resourceDetail });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const deleteJob = await registerJob(accountId, credentialsId, region, {
        name: `Delete extended properties for sandbox ${resourceDetail.database}`,
        startTime: Date.now(),
        description: `Delete extended properties for sandbox ${resourceDetail.database} in the database instance ${resourceDetail.resourceName}\\${resourceDetail.databaseInstanceName}`,
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: resourceDetail.database,
        parentJobId
    });

    try {
        let command = [
            deleteExtendedPropertiesScript(
                resourceDetail.database,
                resourceDetail.databaseInstanceName,
                resourceDetail.instanceName,
                ['cloned_by', 'source', 'createdAt', 'updatedAt', 'tag', 'accountId'],
                resourceDetail.sqlAuthEnabled || false
            )
        ];

        if (isDemoFlow) {
            command = [
                deleteExtendedPropertiesScript(
                    'test-db',
                    DEFAULT_INSTANCE_NAME,
                    DEFAULT_MSSQL_INSTANCE_NAME,
                    ['cloned_by', 'source', 'createdAt', 'updatedAt', 'tag', 'accountId'],
                    false
                )
            ];
        }

        const resp = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                command,
                resourceDetail.activeNodeInstanceId,
                'Remove extended properties'
            ),
            3,
            5000
        );

        if (resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete the extended properties');
        }

        if (isDemoFlow) {
            await updateMetadataForSanboxDeletion(accountId, credentialsId, region, resourceDetail, true);
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(`Failed to delete the extended properties: ${e}`);
        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode, errorMsg);
    } finally {
        await updateJobDetails(accountId, deleteJob.id, {
            status,
            error: errorMsg,
            endTime: Date.now()
        });
    }
}

async function checkDatabaseIntegrity(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    databaseName: string
) {
    logger.info('Check database integrity', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        databaseName
    });

    const source = { host: databaseHostId, instance: databaseInstanceId, database: databaseName };
    const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, source, source);

    const databaseDetails = await checkDatabaseExists(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseName,
        srcDetails.activeNodeInstanceId,
        srcDetails.databaseInstanceName,
        srcDetails.instanceName,
        srcDetails.databaseInstanceId,
        srcDetails.sqlAuthEnabled
    );

    updateLongRunningAuditGroup(undefined, undefined, `${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`);

    if (!databaseDetails && !isDemoFlow) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `Database ${databaseName} does not exists on source host ${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`
        );
    }

    const checkDataIntegrityJob = await registerJob(accountId, credentialsId, region, {
        name: `Check data integrity for sandbox ${databaseName} in the database instance ${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`,
        description: `Check data integrity for sandbox ${databaseName} in the database instance ${srcDetails.resourceName}\\${srcDetails.databaseInstanceName}`,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.SANDBOX,
        resourceName: databaseName
    });

    performIntegrityCheck(
        accountId,
        credentialsId,
        region,
        checkDataIntegrityJob.id,
        databaseName,
        srcDetails.databaseInstanceName,
        srcDetails.instanceName,
        srcDetails.activeNodeInstanceId,
        srcDetails.sqlAuthEnabled
    );

    return { jobId: checkDataIntegrityJob.id };
}

async function performIntegrityCheck(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    databaseName: string,
    instanceName: string,
    executableInstanceName: string,
    activeNodeInstanceId: string,
    sqlAuthEnabled: boolean
) {
    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;
    try {
        let command = [
            checkDatabaseIntegrityScript(
                databaseName,
                instanceName,
                executableInstanceName,
                `SandBox:${databaseName}:`,
                sqlAuthEnabled
            )
        ];

        if (isDemoFlow) {
            command = [checkDatabaseIntegrityScript('test-db', DEFAULT_INSTANCE_NAME, '.', '', false)];
        }

        const resp = await callSsmExecution(
            credentialsId,
            region,
            command,
            activeNodeInstanceId!,
            'Check database integrity'
        );

        if (resp) {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                `Database integrity issues found, please run the command "DBCC CHECKDB(${databaseName}) WITH NO_INFOMSGS, ALL_ERRORMSGS;" to check the errors.`
            );
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(`Failed to check data integrity: ${e}`);
        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode, errorMsg);
    } finally {
        await updateJobDetails(accountId, parentJobId, {
            status,
            error: errorMsg,
            endTime: Date.now()
        });
    }
}

async function getSandboxSnapshots(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    sandboxName: string,
    historical = false
) {
    logger.info('Get snapshots eligible for clone', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        sandboxName,
        historical
    });

    const source = { host: databaseHostId, instance: databaseInstanceId, database: sandboxName };
    const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, source, source);

    const { fsxId, activeNodeInstanceId, databaseInstanceName, instanceName, sqlAuthEnabled } = srcDetails;

    let mappingsCommand = [
        getDbMappedOntapVolumes(
            fsxId,
            region,
            sandboxName,
            databaseInstanceName,
            instanceName,
            `Sandbox:${sandboxName}:`,
            sqlAuthEnabled
        )
    ];

    if (isDemoFlow) {
        mappingsCommand = [getDbMappedOntapVolumes('test-fsx', 'us-east-1', 'testdb')];
    }

    const mappings = await callSsmExecution(
        credentialsId,
        region,
        mappingsCommand,
        activeNodeInstanceId,
        'Get volume mappings'
    );

    if (!mappings) {
        logger.error('Failed to get volume lun mapping for the database', { databaseHostId, sandboxName });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get volume lun mapping for the database');
    }

    const parsedMappingResponse = sqlResponseParsing(mappings);

    if (parsedMappingResponse.error) {
        logger.error(parsedMappingResponse.error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedMappingResponse.error);
    }

    const mappingData = [...parsedMappingResponse.data, ...parsedMappingResponse.log];

    if (mappingData.some(vol => !vol.parentVolume)) {
        const errorMessage = 'The underlying volume doesnot have parents, the volume seems to be already split';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    let snapshotsCommand = [
        getSnapshotsToClone(
            srcDetails.fsxId,
            region,
            JSON.stringify(mappingData.map(vol => vol.parentVolumeUuid)),
            mappingData[0].parentVolumeUuid,
            sandboxName,
            TIME_WINDOW
        )
    ];

    if (isDemoFlow) {
        snapshotsCommand = [
            getSnapshotsToClone(
                'test-fsx',
                'us-east-1',
                JSON.stringify(['5c1075d2-03a0-11ef-a514-55070fbfcab1', '5ace31ea-03a0-11ef-a514-55070fbfcab1']),
                '5c1075d2-03a0-11ef-a514-55070fbfcab1',
                'testdb1_clone'
            )
        ];
    }

    const snapshotResponse = await callSsmExecution(
        credentialsId,
        region,
        snapshotsCommand,
        srcDetails.activeNodeInstanceId,
        'Get snapshots to clone for sandbox',
        accountId,
        false
    );
    if (!snapshotResponse) {
        logger.error('Failed to get volume lun mapping for the database', { databaseHostId, sandboxName });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get volume lun mapping for the database');
    }

    const parsedSnapshotResponse = sqlResponseParsing(snapshotResponse);

    if (parsedSnapshotResponse.error) {
        logger.error(parsedSnapshotResponse.error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedSnapshotResponse.error);
    }

    const { snapshots } = parsedSnapshotResponse;

    logger.debug('Snapshots eligible for clone', snapshots);

    return snapshots.map((snapshot: { name: string; created: string }) => ({
        name: snapshot.name,
        created: new Date(snapshot.created).valueOf()
    }));
}

async function runSandboxPreValidations(
    accountId: string,
    credentialsId: string,
    region: string,
    source: DbInfo,
    dest: DbInfo
) {
    logger.info('Run sandbox pre-validations', { accountId, credentialsId, region, source, dest });

    const [[srcResourceDetail], srcInstanceResult, [destResourceDetailTemp], destInstanceResult] = await Promise.all([
        listResources({ accountId, resourceId: source.host }),
        getPaginatedDatabaseInstances(accountId, {
            credentialsId,
            resourceId: source.host,
            databaseInstanceId: source.instance
        }),
        source.host === dest.host ? Promise.resolve([]) : listResources({ accountId, resourceId: dest.host }),
        source.host === dest.host && source.instance === dest.instance
            ? Promise.resolve([])
            : getPaginatedDatabaseInstances(accountId, {
                  credentialsId,
                  resourceId: dest.host,
                  databaseInstanceId: dest.instance
              })
    ]);

    const srcInstances = Array.isArray(srcInstanceResult) ? srcInstanceResult : srcInstanceResult.items;
    const destInstances = Array.isArray(destInstanceResult) ? destInstanceResult : destInstanceResult.items;
    const [srcInstanceDetail] = srcInstances;
    const [destInstanceDetailTemp] = destInstances;

    let destResourceDetail = destResourceDetailTemp;
    let destInstanceDetail = destInstanceDetailTemp;

    if (source.host === dest.host) {
        destResourceDetail = srcResourceDetail;
    }

    if (source.host === dest.host && source.instance === dest.instance) {
        destInstanceDetail = srcInstanceDetail;
    }

    if (isEmpty(srcResourceDetail)) {
        throw createError(HttpErrorCodes.NOT_FOUND, `No database host by id ${source.host} for ${accountId} is found.`);
    }

    if (isEmpty(destResourceDetail)) {
        throw createError(HttpErrorCodes.NOT_FOUND, `No database host by id ${dest.host} for ${accountId} is found.`);
    }

    if (isEmpty(srcInstanceDetail)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No database host instance by id ${source.instance} for ${accountId} is found.`
        );
    }

    if (isEmpty(destInstanceDetail)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No database host instance by id ${dest.instance} for ${accountId} is found.`
        );
    }

    if (srcInstanceDetail.fsxn_ids !== destInstanceDetail.fsxn_ids) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            'The source and destination resource instances should be connected to the same FSx'
        );
    }

    const { node1InstanceId: srcNode1, node2InstanceId: srcNode2 } = srcResourceDetail.metadata as unknown as Metadata;
    const { node1InstanceId: destNode1, node2InstanceId: destNode2 } =
        destResourceDetail.metadata as unknown as Metadata;

    let [srcStatus, destStatus] = await Promise.all([
        getActiveSqlNode(credentialsId, region, {
            node1InstanceId: srcNode1,
            node2InstanceId: srcNode2,
            resourceId: source.host
        }),
        source.host === dest.host
            ? Promise.resolve(
                  {} as {
                      isSSMConnected: boolean;
                      activeNodeInstanceId: string;
                      standbyNodeInstanceId: string | undefined;
                      instanceName: string;
                      instancesDetails: { instanceId: string; state: string }[];
                  }
              )
            : getActiveSqlNode(credentialsId, region, {
                  node1InstanceId: destNode1,
                  node2InstanceId: destNode2,
                  resourceId: dest.host
              })
    ]);

    if (source.host === dest.host) {
        destStatus = srcStatus;
    }

    if (!srcStatus.isSSMConnected) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'SSM connection could not be established with the source host'
        );
    }

    if (!destStatus.isSSMConnected) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'SSM connection could not be established with the destination host'
        );
    }

    const srcInstance = srcStatus.instancesDetails?.find(
        instance =>
            (isDemoFlow
                ? instance.instanceName.includes(srcInstanceDetail.database_instance_name)
                : instance.instanceName === srcInstanceDetail.database_instance_name) &&
            instance.instanceState === SQL_SERVICE_STATE.RUNNING
    );

    const destInstance = destStatus.instancesDetails?.find(
        instance =>
            (isDemoFlow
                ? instance.instanceName.includes(destInstanceDetail.database_instance_name)
                : instance.instanceName === destInstanceDetail.database_instance_name) &&
            instance.instanceState === SQL_SERVICE_STATE.RUNNING
    );

    if (!srcInstance || !destInstance) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Source or destination instance is not running, please check the instance status'
        );
    }

    const { metadata: srcInstanceMetadata } = srcInstanceDetail as { metadata: DatabaseInstanceMetadata };
    const { metadata: destInstanceMetadata } = destInstanceDetail as { metadata: DatabaseInstanceMetadata };

    return {
        srcDetails: {
            ...source,
            resourceName: srcResourceDetail.resource_name!,
            svm: (srcInstanceDetail.fsx_svm_id as Record<string, string>)[srcInstanceDetail.fsxn_ids as string],
            fsxId: srcInstanceDetail.fsxn_ids!,
            activeNodeInstanceId: srcStatus.activeNodeInstanceId!,
            metadata: srcResourceDetail.metadata as unknown as Metadata,
            databaseInstanceName: srcInstanceDetail.database_instance_name,
            instanceName: getDatabaseInstanceName(
                srcInstanceDetail.database_instance_name,
                srcInstanceDetail.is_default
            ),
            instanceMetadata: srcInstanceMetadata,
            databaseInstanceId: srcInstanceDetail.database_instance_id,
            sqlAuthEnabled: Boolean(srcInstance.sqlAuthEnabled)
        },
        destDetails: {
            ...dest,
            resourceName: destResourceDetail.resource_name!,
            svm: (destInstanceDetail.fsx_svm_id as Record<string, string>)[destInstanceDetail.fsxn_ids as string],
            fsxId: destInstanceDetail.fsxn_ids!,
            activeNodeInstanceId: destStatus.activeNodeInstanceId!,
            metadata: destResourceDetail.metadata as unknown as Metadata,
            databaseInstanceName: destInstanceDetail.database_instance_name, // e.g. 'MSSQLSERVER', 'KFSQLSERVER'
            // executable instance path required for '-S'. eg. "$env:COMPUTERNAME\KFSQLSERVER", "$env:COMPUTERNAME"
            instanceName: getDatabaseInstanceName(
                destInstanceDetail.database_instance_name,
                destInstanceDetail.is_default
            ),
            instanceMetadata: destInstanceMetadata,
            activeNodeDetails: destStatus,
            databaseInstanceId: (destInstanceDetail as DatabaseInstance).database_instance_id,
            sqlAuthEnabled: Boolean(destInstance.sqlAuthEnabled)
        }
    };
}

export {
    getSandboxesInfo,
    getSandboxSavings,
    createSandbox,
    getDatabaseMountPointInfo,
    getSandboxConnectionString,
    deleteSandbox,
    getSandboxSplitEstimate,
    updateSandboxLifeCycle,
    splitSandbox,
    checkDatabaseIntegrity,
    getSandboxSnapshots,
    getSourceDetails,
    getProperty,
    performSandboxDeletion,
    runSandboxPreValidations,
    performLifecycleUpdate,
    getSandboxInfoByInstanceId
};
