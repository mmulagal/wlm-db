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
    AuditStatus,
    SqlServerDeploymentModel
} from '../utils/consts';
import {
    IS_DEMO_FLOW,
    extractErrorMessage,
    getDatabaseInstanceName,
    retryWithDelay,
    sleep,
    sqlResponseParsing
} from '../utils/utils';
import {
    setLunSignature as setLunSignatureScript,
    getDbMappedOntapVolumes,
    releaseSandboxClusterResources,
    dropSandboxDatabaseFiles,
    addExtendedProperties,
    createClonedDb as createCloneDbScript,
    mountPointQuery,
    detachDbAndRemoveAccessPath,
    addAccessPathAndAttachDb,
    deleteExtendedPropertiesScript,
    checkDatabaseIntegrityScript,
    getConnectionInfo,
    invokeVirtualMountScript
} from './workloads/mssql/sandbox-scripts';
import {
    buildOntapProxyBase,
    collectAllOntapRecords,
    getLunBySerialNumber,
    getVolumeByName,
    deleteOntapVolumeByUuid,
    patchOntapVolumeTags,
    getOntapJobStatusForBase,
    findIgroupForInitiators,
    createOntapLunMapping,
    type ProxyOperationBaseOpts
} from '../lib/ontap/ontap-gateway';
import { callProxyForwarder } from '../lib/cloud-manager/proxy-forwarder';
import { DatabaseInstance, Metadata, ResourceDetails, Sandbox, DatabaseInstanceMetadata } from '../utils/common-types';
import {
    ActiveSqlNodeDetails,
    checkDatabaseExists,
    getActiveSqlNode,
    getSqlServerVersion
} from './workloads/mssql/mssql-operations';
import { callSsmExecution } from './aws/ssm-operations';
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
import { assertVolumesHaveNoSnapmirror } from './continuous-optimization/ontap-operations';

const logger = getLogger();
const TIME_WINDOW = 60; // 60 seconds

interface SandboxObject {
    sandbox_properties: { name: string; value: string }[];
}

type sandboxType = SandboxObject & { database_name: string };

interface OntapCloneVolumeRecord {
    name?: string;
    clone?: {
        is_flexclone?: boolean;
        split_estimate?: number;
        parent_svm?: { name?: string };
        parent_volume?: { name?: string; uuid?: string };
        parent_snapshot?: { name?: string };
    };
    space?: { physical_used?: number };
}

interface OntapLunLookupRecord {
    serial_number?: string;
    name?: string;
    svm?: { name?: string };
    location?: { volume?: { name?: string; uuid?: string } };
}

interface OntapSnapshotRecord {
    name: string;
    create_time: string;
}

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
    const command = [sqlQueryExecutionWithAuth(instanceNames, GET_SANDBOXES, isSqlAuthEnabled)];

    const response = await callSsmExecution({
        credentialsId,
        region,
        commands: command,
        ec2InstanceId: activeNodeInstanceId!,
        comment: 'Get sandbox details',
        cacheData: true,
        shouldReadFromCloudWatchLogs: true
    });

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

    if (IS_DEMO_FLOW && sandboxes) {
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
        metaFilters: IS_DEMO_FLOW ? undefined : { sandboxCreated: true },
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

function sumFlexcloneSavings(volumes: OntapCloneVolumeRecord[]) {
    return volumes.reduce(
        (totals, volume) =>
            volume.clone?.is_flexclone
                ? {
                      savedStorage: totals.savedStorage + (volume.clone.split_estimate || 0),
                      consumedStorage: totals.consumedStorage + (volume.space?.physical_used || 0)
                  }
                : totals,
        { savedStorage: 0, consumedStorage: 0 }
    );
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
            metaFilters: IS_DEMO_FLOW
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
                    const [{ metadata }] = fsxGroups[fsxId];
                    const { sandboxes } = metadata as unknown as Metadata;

                    try {
                        const targetFsxId = IS_DEMO_FLOW ? 'test-fsx' : fsxId;
                        const targetRegion = IS_DEMO_FLOW ? 'us-east-1' : region;
                        const clonedByTagValue = IS_DEMO_FLOW
                            ? 'netapp_wf_test_account_test_cred'
                            : getClonedByTagValue(accountId, credentialsId);

                        const base = await buildOntapProxyBase(accountId, credentialsId, targetFsxId, targetRegion);
                        const volumes = await collectAllOntapRecords<OntapCloneVolumeRecord>(
                            base,
                            'api/storage/volumes',
                            {
                                'tiering.object_tags': `cloned_by=${clonedByTagValue}`,
                                fields: 'space.used_by_afs,space.physical_used,clone.*'
                            }
                        );

                        let { savedStorage, consumedStorage } = sumFlexcloneSavings(volumes);

                        // Increase storage savings per sandbox for demo
                        if (IS_DEMO_FLOW) {
                            savedStorage *= sandboxes?.length || 0;
                            consumedStorage *= sandboxes?.length || 0;
                        }

                        savingsData.consumedStorage += consumedStorage;
                        savingsData.savedStorage += savedStorage;

                        const totalStorage = savingsData.consumedStorage + savingsData.savedStorage;
                        savingsData.sandboxSavingsPercentage =
                            totalStorage > 0 ? (savingsData.savedStorage * 100) / totalStorage : 0;
                    } catch (e) {
                        logger.error(`Failed to fetch storage saving for fsx: ${fsxId}`, {
                            accountId,
                            fsxId,
                            error: e
                        });
                    }
                })
            )
        );

        return savingsData;
    } catch (e) {
        logger.error('Error while fetching storage savings', { accountId, error: e });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error while fetching storage savings ${accountId}`);
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

function isFciDeployment(metadata: Metadata): boolean {
    const { sqlDeploymentType, aoagDetails: { baseDeploymentType } = {} } = metadata;
    return (
        sqlDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT ||
        baseDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT
    );
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
        if (IS_DEMO_FLOW) {
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

        if (!srcDatabaseExists && !IS_DEMO_FLOW) {
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

function withLunDetails(
    volume: VolumeLunMap,
    lunsBySerial: Map<string | undefined, OntapLunLookupRecord>
): VolumeLunMap {
    logger.info('With lun details', {
        volume,
        lunsBySerial
    });
    const lun = lunsBySerial.get(volume.lunSerialNumber);
    return lun
        ? {
              ...volume,
              lunPath: lun.name as string,
              volumeName: lun.location?.volume?.name as string,
              volumeUuid: lun.location?.volume?.uuid as string,
              svm: lun.svm?.name as string
          }
        : volume;
}

function withParentVolumeDetails(
    volume: VolumeLunMap,
    flexcloneByVolumeName: Map<string, OntapCloneVolumeRecord['clone']>
): VolumeLunMap {
    const clone = volume.volumeName ? flexcloneByVolumeName.get(volume.volumeName) : undefined;
    return clone
        ? {
              ...volume,
              parentSvm: clone.parent_svm?.name,
              parentVolume: clone.parent_volume?.name,
              parentVolumeUuid: clone.parent_volume?.uuid,
              parentSnapshot: clone.parent_snapshot?.name,
              splitEstimate: clone.split_estimate
          }
        : volume;
}

async function getMappedOntapVolumes(
    accountId: string,
    credentialsId: string,
    region: string,
    srcDetails: HostAndDbInfo,
    dbName: string,
    logPrefix: string
): Promise<VolumeLunMapping> {
    logger.info('Get mapped ONTAP volumes', {
        accountId,
        credentialsId,
        region,
        srcDetails,
        dbName,
        logPrefix
    });
    const { fsxId: srcFsxId, activeNodeInstanceId, databaseInstanceName, instanceName, sqlAuthEnabled } = srcDetails;
    const fsxId = IS_DEMO_FLOW ? 'test-fsx' : srcFsxId;
    const fsxRegion = IS_DEMO_FLOW ? 'us-east-1' : region;

    const response = await callSsmExecution({
        credentialsId,
        region,
        commands: [getDbMappedOntapVolumes(dbName, databaseInstanceName, instanceName, logPrefix, sqlAuthEnabled)],
        ec2InstanceId: activeNodeInstanceId,
        comment: 'Get volume mappings',
        accountId,
        executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT
    });

    if (!response) {
        const errorMessage = 'Failed to get volume lun mapping for the database';
        logger.error(errorMessage, { accountId, fsxId, dbName });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const parsedResponse = sqlResponseParsing(response) as VolumeLunMapping & { error?: string };

    if (parsedResponse.error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedResponse.error);
    }

    const { data, log } = parsedResponse;
    const target = { accountId, credentialsId, region: fsxRegion, fsxId };

    const luns = await getLunBySerialNumber(
        target,
        [...data, ...log].map(volume => volume.lunSerialNumber),
        { fields: 'svm.name,location.volume.name,location.volume.uuid' }
    );

    if (luns.length === 0) {
        const errorMessage = 'Could not get lun names from serial numbers';
        logger.error(errorMessage, { accountId, fsxId, dbName });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const lunsBySerial = new Map(luns.map(lun => [lun.serial_number, lun as OntapLunLookupRecord]));

    const dataWithLuns = data.map(volume => withLunDetails(volume, lunsBySerial));
    const logWithLuns = log.map(volume => withLunDetails(volume, lunsBySerial));

    const volumeNames = uniq(compact([...dataWithLuns, ...logWithLuns].map(volume => volume.volumeName)));
    const ontapVolumes = (await getVolumeByName(target, volumeNames, {
        fields: 'clone.*'
    })) as OntapCloneVolumeRecord[];
    const flexcloneByVolumeName = new Map(
        ontapVolumes.filter(volume => volume.clone?.is_flexclone).map(volume => [volume.name as string, volume.clone])
    );

    return {
        data: dataWithLuns.map(volume => withParentVolumeDetails(volume, flexcloneByVolumeName)),
        log: logWithLuns.map(volume => withParentVolumeDetails(volume, flexcloneByVolumeName))
    };
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
        const parsedResp = await getMappedOntapVolumes(
            accountId,
            credentialsId,
            region,
            srcDetails,
            srcDetails.database,
            `Sandbox:${sandboxName}:`
        );

        status = JOBSTATUS.COMPLETED;
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

interface CloneVolumeInput {
    volumeName: string;
    svm: string;
}

async function createOntapVolumeSnapshot(
    base: ProxyOperationBaseOpts,
    volumeUuid: string,
    snapshotName: string
): Promise<void> {
    logger.info('Create ONTAP volume snapshot', {
        base,
        volumeUuid,
        snapshotName
    });
    const { job } = await callProxyForwarder<{ job?: { uuid?: string } }>({
        ...base,
        ontapPath: `api/storage/volumes/${volumeUuid}/snapshots`,
        method: 'POST',
        body: { name: snapshotName }
    });
    if (job?.uuid) {
        await getOntapJobStatusForBase(base, job.uuid);
    }
}

async function createOntapVolumeClone(
    base: ProxyOperationBaseOpts,
    targetSvm: string,
    cloneVolumeName: string,
    parentVolumeName: string,
    parentSvm: string,
    parentSnapshot: string
): Promise<void> {
    logger.info('Create ONTAP volume clone', {
        base,
        targetSvm,
        cloneVolumeName,
        parentVolumeName,
        parentSvm,
        parentSnapshot
    });
    const { job } = await callProxyForwarder<{ job?: { uuid?: string } }>({
        ...base,
        ontapPath: 'api/storage/volumes',
        method: 'POST',
        body: {
            name: cloneVolumeName,
            svm: { name: targetSvm },
            clone: {
                is_flexclone: true,
                parent_volume: { name: parentVolumeName },
                parent_svm: { name: parentSvm },
                parent_snapshot: { name: parentSnapshot }
            }
        }
    });
    if (job?.uuid) {
        await getOntapJobStatusForBase(base, job.uuid);
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

        // Clones must live on the same ONTAP cluster as their source volumes (`srcDetails.fsxId`),
        // even though the target SVM (`sqlVMName`, resolved above from `destDetails.svm`) may differ.
        const fsxId = IS_DEMO_FLOW ? 'test-fsx' : srcDetails.fsxId;
        const fsxRegion = IS_DEMO_FLOW ? 'us-east-1' : region;
        const targetSvm = IS_DEMO_FLOW ? 'target-svm' : sqlVMName;
        const tags = IS_DEMO_FLOW
            ? ['source=test-res-id', 'cloned_by=netapp_wf_test_account_test_cred']
            : [
                  `cloned_by=${getClonedByTagValue(accountId, credentialsId)}`,
                  `source=${destDetails.host}_${destDetails.instance}`.replace(/-/g, '_')
              ];
        const dataVolumes: CloneVolumeInput[] = IS_DEMO_FLOW
            ? [{ volumeName: 'wlmdb_sqldata_1714098400', svm: 'wlmdb_sqlsvm_1714090636810' }]
            : uniqBy(mapping.data, 'volumeUuid').map(({ volumeName, svm }) => ({ volumeName, svm }));
        const logVolumes: CloneVolumeInput[] = IS_DEMO_FLOW
            ? [{ volumeName: 'wlmdb_sqllog_1714098400', svm: 'wlmdb_sqlsvm_1714090636810' }]
            : uniqBy(mapping.log, 'volumeUuid').map(({ volumeName, svm }) => ({ volumeName, svm }));

        if (!targetSvm) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Could not resolve the target SVM for the clone.');
        }

        const nodeIqnResponse = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: ['(Get-InitiatorPort).NodeAddress'],
                ec2InstanceId: destDetails.activeNodeInstanceId,
                comment: 'Sandbox: Get IQN for active node',
                accountId,
                executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT
            })
        );
        const nodeIqn = nodeIqnResponse ? nodeIqnResponse.replaceAll('\r\n', '') : undefined;
        if (!nodeIqn) {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                'Unable to fetch initiator IQN for the active node'
            );
        }

        const ontapBase = await buildOntapProxyBase(accountId, credentialsId, fsxId, fsxRegion);
        const igroup = await findIgroupForInitiators(ontapBase, targetSvm, nodeIqn);

        const epoch = Math.floor(Date.now() / 1000);
        const defaultSnapshot = `netapp_wf_clone_${epoch}`;
        const snapshotName = snapshot || defaultSnapshot;

        let volumeUuidByName = new Map<string, string>();
        if (!snapshot) {
            const uniqueVolumeNames = uniq([...dataVolumes, ...logVolumes].map(({ volumeName }) => volumeName));
            const volumeRecords = await getVolumeByName(
                { accountId, credentialsId, region: fsxRegion, fsxId },
                uniqueVolumeNames
            );
            volumeUuidByName = new Map(volumeRecords.map(({ name, uuid }) => [name, uuid]));
        }

        const createdSnapshots = new Set<string>();
        const createdClones = new Set<string>();

        for (const group of [dataVolumes, logVolumes]) {
            if (!snapshot) {
                for (const vol of group) {
                    if (!createdSnapshots.has(vol.volumeName)) {
                        createdSnapshots.add(vol.volumeName);
                        const volumeUuid = volumeUuidByName.get(vol.volumeName);
                        if (!volumeUuid) {
                            throw createError(
                                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                                `Could not find the volume ${vol.volumeName} to create snapshot.`
                            );
                        }
                        // eslint-disable-next-line no-await-in-loop
                        await createOntapVolumeSnapshot(ontapBase, volumeUuid, defaultSnapshot);
                    }
                }
            }
            for (const vol of group) {
                if (!createdClones.has(vol.volumeName)) {
                    createdClones.add(vol.volumeName);
                    const cloneVolumeName = `${vol.volumeName}_clone_${epoch}`;
                    // eslint-disable-next-line no-await-in-loop
                    await createOntapVolumeClone(
                        ontapBase,
                        targetSvm,
                        cloneVolumeName,
                        vol.volumeName,
                        vol.svm,
                        snapshotName
                    );
                }
            }
        }

        const cloneVolumeNames = [...dataVolumes, ...logVolumes].map(
            ({ volumeName }) => `${volumeName}_clone_${epoch}`
        );
        const cloneLuns = await collectAllOntapRecords<{
            name: string;
            serial_number?: string;
            location?: { volume?: { uuid?: string; name?: string } };
        }>(ontapBase, 'api/storage/luns', {
            'location.volume.name': cloneVolumeNames.join('|'),
            fields: 'location.volume.uuid,location.volume.name,serial_number'
        });

        if (cloneLuns.length === 0) {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                'Could not find the cloned volumes to create tags.'
            );
        }

        const buildClonedVolumes = (volumes: CloneVolumeInput[]) =>
            cloneLuns
                .filter(lun => volumes.some(({ volumeName }) => lun.location?.volume?.name?.includes(volumeName)))
                .map(lun => ({
                    volumeId: lun.location!.volume!.uuid as string,
                    lunSerialNumber: lun.serial_number as string,
                    volumeName: lun.location!.volume!.name as string,
                    lunPath: lun.name
                }));

        const clonedData = buildClonedVolumes(dataVolumes);
        const clonedLog = buildClonedVolumes(logVolumes);

        for (const { volumeId } of uniqBy([...clonedData, ...clonedLog], 'volumeId')) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await patchOntapVolumeTags(ontapBase, volumeId, tags);
            } catch (err: any) {
                throw createError(
                    HttpErrorCodes.INTERNAL_SERVER_ERROR,
                    `Could not add tags to the cloned volumes. Ontap error: ${err?.message}`
                );
            }
        }

        // `Set-NcLunSignature` has no ONTAP REST equivalent; run it host-side against the freshly
        // cloned LUNs before mapping them to the igroup.
        const lunPaths = uniq([...clonedData, ...clonedLog].map(({ lunPath }) => lunPath));
        const setLunSignatureResponse = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: [
                    setLunSignatureScript(
                        fsxId,
                        fsxRegion,
                        targetSvm,
                        JSON.stringify(lunPaths),
                        destDetails.database,
                        `Sandbox:${destDetails.database}:`
                    )
                ],
                ec2InstanceId: destDetails.activeNodeInstanceId,
                comment: 'Sandbox: Set LUN signature',
                accountId,
                executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT
            })
        );
        const signatureResult = sqlResponseParsing(setLunSignatureResponse);
        if (signatureResult?.error) {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                `Could not set LUN signature. ${signatureResult.error}`
            );
        }

        await Promise.all(
            lunPaths.map(lunPath =>
                createOntapLunMapping(ontapBase, {
                    svm: { name: targetSvm },
                    lun: { name: lunPath },
                    igroup: { name: igroup }
                })
            )
        );

        status = JOBSTATUS.COMPLETED;
        return { data: clonedData, log: clonedLog };
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
                    `Sandbox:${destDetails.database}:`,
                    isFciDeployment(destDetails.metadata)
                )
            ];

            if (IS_DEMO_FLOW) {
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
            const resp = await callSsmExecution({
                credentialsId,
                region,
                commands: command,
                ec2InstanceId: destDetails.activeNodeInstanceId,
                comment: 'Discover LUN and add virtual mount points',
                accountId,
                executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT
            });

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

        if (IS_DEMO_FLOW) {
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
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: command,
                ec2InstanceId: destDetails.activeNodeInstanceId,
                comment: 'Clone Database for sandbox',
                accountId,
                executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT
            })
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

        if (IS_DEMO_FLOW) {
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
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: command,
                ec2InstanceId: destDetails.activeNodeInstanceId,
                comment: 'Add extended properties to sandbox database'
            })
        );

        // We only get a response in case of error from query
        if (resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, resp);
        }

        if (!destDetails.metadata.sandboxCreated) {
            await updateMetadataForSanbox(accountId, credentialsId, region, destDetails.host);
        }

        if (IS_DEMO_FLOW) {
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
        let releaseCommand = [
            releaseSandboxClusterResources(
                JSON.stringify(filePaths),
                destDetails.database,
                destDetails.instanceName,
                destDetails.databaseInstanceName,
                `SandBox:${destDetails.database}:`,
                destDetails.sqlAuthEnabled || false,
                isFciDeployment(destDetails.metadata)
            )
        ];
        let dropCommand = [
            dropSandboxDatabaseFiles(
                JSON.stringify(filePaths),
                destDetails.database,
                destDetails.instanceName,
                destDetails.databaseInstanceName,
                `SandBox:${destDetails.database}:`,
                destDetails.sqlAuthEnabled || false
            )
        ];

        if (IS_DEMO_FLOW) {
            const demoFilePaths = [
                'S:\\testdb_clone-Data\\mssql\\data\\testdb.mdf',
                'L:\\testdb_clone-Log\\mssql\\log\\testdb_log.ldf'
            ];
            releaseCommand = [
                releaseSandboxClusterResources(
                    JSON.stringify(demoFilePaths),
                    'testdb',
                    DEFAULT_MSSQL_INSTANCE_NAME,
                    DEFAULT_INSTANCE_NAME,
                    '',
                    false,
                    false
                )
            ];
            dropCommand = [
                dropSandboxDatabaseFiles(
                    JSON.stringify(demoFilePaths),
                    'testdb',
                    DEFAULT_MSSQL_INSTANCE_NAME,
                    DEFAULT_INSTANCE_NAME,
                    '',
                    false
                )
            ];
        }

        const releaseResp = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: releaseCommand,
                ec2InstanceId: destDetails.activeNodeInstanceId,
                comment: `Release cluster resources for ${name}`,
                accountId,
                executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT
            })
        );

        if (!releaseResp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to cleanup');
        }

        const releaseJsonResp = sqlResponseParsing(releaseResp);

        if (releaseJsonResp.error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, releaseJsonResp.error);
        }

        const fsxId = IS_DEMO_FLOW ? 'test-fsx' : destDetails.fsxId;
        const fsxRegion = IS_DEMO_FLOW ? 'us-east-1' : region;
        const ontapBase = await buildOntapProxyBase(accountId, credentialsId, fsxId, fsxRegion);
        await Promise.all(volumeIds.map(volumeId => deleteOntapVolumeByUuid(ontapBase, volumeId)));

        const dropResp = await retryWithDelay(
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: dropCommand,
                ec2InstanceId: destDetails.activeNodeInstanceId,
                comment: `Cleanup ${name} resources`,
                accountId,
                executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT
            })
        );

        if (!dropResp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to cleanup');
        }

        const dropJsonResp = sqlResponseParsing(dropResp);

        if (dropJsonResp.error) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, dropJsonResp.error);
        }

        status = JOBSTATUS.COMPLETED;
        return dropJsonResp;
    } catch (e: any) {
        logger.error(`Failed to perform cleanup for ${name} ${destDetails.database}: ${extractErrorMessage(e)}`);
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

        if (IS_DEMO_FLOW) {
            command = [getConnectionInfo('MSSQLSERVER', false)];
        }

        const resp = await callSsmExecution({
            credentialsId,
            region,
            commands: command,
            ec2InstanceId: activeNodeInstanceId!,
            comment: 'Get sandbox database connection info'
        });

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
        if (IS_DEMO_FLOW) {
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

        if (IS_DEMO_FLOW) {
            command = [sqlQueryExecution('MSSQLSERVER', '$env:computername', mountPointQuery('test-database'), true)];
        }

        const mountPoints = await callSsmExecution({
            credentialsId,
            region,
            commands: command,
            ec2InstanceId: srcDetails.activeNodeInstanceId,
            comment: 'Get database mount points'
        });
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
        if (IS_DEMO_FLOW) {
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

        const volumeUuids = uniq([
            ...mappings.data.map(vol => vol.volumeUuid),
            ...mappings.log.map(vol => vol.volumeUuid)
        ]);

        await assertVolumesHaveNoSnapmirror(accountId, credentialsId, region, resDetails.fsxId, volumeUuids);

        await startCleanup(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resDetails,
            resDetails,
            volumeUuids,
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
        if (IS_DEMO_FLOW) {
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

        if (!dbExists && !IS_DEMO_FLOW) {
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

    const parsedResp = await getMappedOntapVolumes(
        accountId,
        credentialsId,
        region,
        srcDetails,
        sandboxName,
        `Sandbox:${sandboxName}:`
    );

    const mappingData = [...parsedResp.data, ...parsedResp.log];

    if (mappingData.some(vol => !vol.parentVolume)) {
        throw createError(
            HttpErrorCodes.VALIDATION_ERROR,
            'The sandbox seems to be already split and hence cannot be altered.'
        );
    }

    return mappingData.map(record => ({
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

        if (IS_DEMO_FLOW) {
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

        if (!dbExists && !IS_DEMO_FLOW) {
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
                resourceDetails.sqlAuthEnabled || false,
                isFciDeployment(resourceDetails.metadata)
            )
        ];

        if (IS_DEMO_FLOW) {
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
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: command,
                ec2InstanceId: resourceDetails.activeNodeInstanceId,
                comment: 'Detach sandbox and access path',
                accountId,
                executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT
            })
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
                `SandBox:${resourceDetails.database}:`,
                isFciDeployment(resourceDetails.metadata)
            )
        ];
        let resp = await callSsmExecution({
            credentialsId,
            region,
            commands: command,
            ec2InstanceId: resourceDetails.activeNodeInstanceId,
            comment: 'Discover LUN and add virtual mount points',
            accountId,
            executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT
        });

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
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: command,
                ec2InstanceId: resourceDetails.activeNodeInstanceId,
                comment: 'Attach sandbox and add access path',
                accountId,
                executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT
            })
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

        if (!dbExists && !IS_DEMO_FLOW) {
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

async function initiateFlexcloneSplit(
    base: ProxyOperationBaseOpts,
    volumeId: string,
    volumeName: string
): Promise<string | undefined> {
    try {
        const { job } = await callProxyForwarder<{ job?: { uuid?: string } }>({
            ...base,
            ontapPath: `api/storage/volumes/${volumeId}`,
            method: 'PATCH',
            body: { clone: { split_initiated: true } }
        });

        if (job?.uuid) {
            await getOntapJobStatusForBase(base, job.uuid);
        }
        return undefined;
    } catch (err: any) {
        const message: string = err?.message || '';
        if (message.includes('Volume is not a clone')) {
            return `Volume ${volumeName} is not a clone`;
        }
        if (message.includes('Volume has locked snapshots')) {
            return `Volume ${volumeName} has locked snapshots`;
        }
        return `Could not split volume ${volumeName}. Ontap error: ${message}`;
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
    const logPrefix = `Sandbox:${resourceDetail.database}:`;

    try {
        const ontapBase = await buildOntapProxyBase(accountId, credentialsId, resourceDetail.fsxId, region);
        const uniqueVolumes = uniqBy(volumes, 'volumeId');
        let lastError: string | undefined;

        // Best-effort per volume, matching the previous script: keep going on failure and surface
        // the last error encountered (if any) once every volume has been attempted.
        for (const { volumeId, volumeName } of uniqueVolumes) {
            // eslint-disable-next-line no-await-in-loop
            const splitError = await initiateFlexcloneSplit(ontapBase, volumeId, volumeName);
            if (splitError) {
                logger.info(`${logPrefix} ${splitError}`);
                lastError = splitError;
            }
        }

        for (const { volumeId, volumeName } of uniqueVolumes) {
            try {
                // eslint-disable-next-line no-await-in-loop
                await patchOntapVolumeTags(ontapBase, volumeId, []);
            } catch (err: any) {
                lastError = `Could not remove tags from volume ${volumeName}. Ontap error: ${err?.message}`;
                logger.info(`${logPrefix} ${lastError}`);
            }
        }

        if (lastError) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, lastError);
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

        if (IS_DEMO_FLOW) {
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
            callSsmExecution.bind(null, {
                credentialsId,
                region,
                commands: command,
                ec2InstanceId: resourceDetail.activeNodeInstanceId,
                comment: 'Remove extended properties'
            })
        );

        if (resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete the extended properties');
        }

        if (IS_DEMO_FLOW) {
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

    if (!databaseDetails && !IS_DEMO_FLOW) {
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

        if (IS_DEMO_FLOW) {
            command = [checkDatabaseIntegrityScript('test-db', DEFAULT_INSTANCE_NAME, '.', '', false)];
        }

        const resp = await callSsmExecution({
            credentialsId,
            region,
            commands: command,
            ec2InstanceId: activeNodeInstanceId!,
            comment: 'Check database integrity'
        });

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

    const parsedMappingResponse = await getMappedOntapVolumes(
        accountId,
        credentialsId,
        region,
        srcDetails,
        sandboxName,
        `Sandbox:${sandboxName}:`
    );

    const mappingData = [...parsedMappingResponse.data, ...parsedMappingResponse.log];

    if (mappingData.some(vol => !vol.parentVolume)) {
        const errorMessage = 'The underlying volume doesnot have parents, the volume seems to be already split';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const dataVolumeUuid = mappingData[0].parentVolumeUuid as string;
    const base = await buildOntapProxyBase(accountId, credentialsId, srcDetails.fsxId, region);

    const volumeSnapshots = await Promise.all(
        mappingData.map(async vol => ({
            isPrimary: vol.parentVolumeUuid === dataVolumeUuid,
            records: await collectAllOntapRecords<OntapSnapshotRecord>(
                base,
                `api/storage/volumes/${vol.parentVolumeUuid}/snapshots`,
                { fields: 'create_time' }
            )
        }))
    );

    if (volumeSnapshots.some(vol => vol.records.length === 0)) {
        const errorMessage = 'No snapshots found for one or more volumes.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const primarySnapshots = volumeSnapshots.filter(vol => vol.isPrimary).flatMap(vol => vol.records);
    const secondaryVolumeSnapshots = volumeSnapshots.filter(vol => !vol.isPrimary);

    const snapshots: { name: string; created: string }[] = [];
    secondaryVolumeSnapshots.forEach(({ records: secondarySnapshots }) => {
        primarySnapshots.forEach(primarySnapshot => {
            const secondarySnapshot = secondarySnapshots.find(record => record.name === primarySnapshot.name);
            if (!secondarySnapshot) {
                return;
            }
            const primaryTime = Math.floor(new Date(primarySnapshot.create_time).getTime() / 1000);
            const secondaryTime = Math.floor(new Date(secondarySnapshot.create_time).getTime() / 1000);
            if (Math.abs(secondaryTime - primaryTime) <= TIME_WINDOW) {
                snapshots.push({ name: primarySnapshot.name, created: primarySnapshot.create_time });
            }
        });
    });

    logger.debug('Snapshots eligible for clone', snapshots);

    return snapshots.map(snapshot => ({
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
            (IS_DEMO_FLOW
                ? instance.instanceName.includes(srcInstanceDetail.database_instance_name)
                : instance.instanceName === srcInstanceDetail.database_instance_name) &&
            instance.instanceState === SQL_SERVICE_STATE.RUNNING
    );

    const destInstance = destStatus.instancesDetails?.find(
        instance =>
            (IS_DEMO_FLOW
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
