import { ConnectionStatus } from '@aws-sdk/client-ssm';
import throat from 'throat';
import { compact, groupBy, isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../utils/logger';
import { listResources, updateResourceMetaData } from '../lib/database/db';
import {
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    DEFAULT_INSTANCE_NAME,
    HttpErrorCodes,
    NO_SANDBOX_CREATED,
    RESOURCESTYPE,
    SANDBOX_API_SIZE,
    SSM_COMMAND_CACHE_TYPE,
    SSM_PARAM_PREFIX
} from '../utils/consts';
import {
    GET_SANDBOX_DETAILS,
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
    deleteExtendedPropertiesScript
} from './workloads/mssql/sandbox-scripts';
import { Metadata, ResourceDetails, Sandbox } from '../utils/common-types';
import { checkDatabaseExists, getActiveSqlNode, getSqlServerVersion } from './workloads/mssql/mssql-operations';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import { sleep, sqlResponseParsing } from '../utils/utils';
import { DatabaseMountPointResponseType, SandboxInfoResponseType } from '../routes/types/database-hosts.types';
import { getResources } from './database/database-operations';
import { registerJob, updateJobDetails } from './database/job-operations';
import { INVOKE_VIRTUAL_MOUNT } from './workloads/mssql/const';
import { updateSandboxDBIntoResourceData, updateUserDBIntoResourceData } from './demo-operations';
import { resetCache } from '../utils/cache';
import { describeFSxStorageVirtualMachines } from '../lib/aws/fsx';
import { getParameter } from '../lib/aws/ssm';
import { getDriveInfo } from './createdb-operations';
import { restGetUtilForOntap } from './workloads/mssql/ssm-script-utils';

const logger = getLogger();

interface SandboxObject {
    sandbox_properties: { name: string; value: string }[];
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
    resourceDetails: ResourceDetails
) {
    logger.info('Get sandbox details of host:', resourceDetails.resource_id, accountId, credentialsId, region);
    const { metadata, resource_id: resourceId } = resourceDetails;
    const { node1InstanceId, node2InstanceId, sandboxes } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId } = await getActiveSqlNode(
        credentialsId,
        region!,
        node1InstanceId,
        node2InstanceId,
        resourceId
    );

    const errorResponse = (errorMessage: any) => [
        {
            databaseHostName: resourceDetails.resource_name!,
            databaseHostId: resourceDetails.resource_id!,
            databaseInstanceName: DEFAULT_INSTANCE_NAME,
            error: errorMessage
        }
    ];

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        const errorMessage = `Unable to get sandbox details for host ${resourceDetails.resource_id} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        return errorResponse(errorMessage);
    }

    accountId = process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator' ? 'test-account' : accountId;
    const command = [GET_SANDBOX_DETAILS(['"."'], accountId)];
    const response = await callSsmExecution(credentialsId, region, command, activeNodeInstanceId!);
    let sandboxInfo: SandboxInfoResponseType[] = [];

    if (response) {
        let parsedResponse;
        try {
            parsedResponse = sqlResponseParsing(response);
        } catch (err: any) {
            return errorResponse(err.toString());
        }
        if (parsedResponse?.Error) {
            const errorMessage = `Error fetching sandbox details for host: ${resourceId},${parsedResponse.Instance},${accountId}${parsedResponse?.Error}.`;
            logger.error(errorMessage);
            return errorResponse(errorMessage);
        }
        const sandboxDetails = parsedResponse.Output;

        if (sandboxDetails === NO_SANDBOX_CREATED) {
            const errorMessage = `No sandboxes created for the instance:${parsedResponse.Instance} ,${resourceId},${accountId}.`;
            logger.error(errorMessage);
            return errorResponse(errorMessage);
        }

        const finalSandboxDetails: string = Array.isArray(sandboxDetails) ? sandboxDetails.join('') : sandboxDetails;

        try {
            const parsedSandboxDetails: {
                database_name: string;
                sandbox_properties: { name: string; value: string }[];
            }[] = sqlResponseParsing(finalSandboxDetails);

            parsedSandboxDetails.forEach(item => {
                const sources = getSourceDetails(item);

                const databaseObject = {
                    sandboxName: item.database_name,
                    databaseHostName: resourceDetails.resource_name!,
                    databaseHostId: resourceDetails.resource_id!,
                    databaseInstanceName: DEFAULT_INSTANCE_NAME,
                    sourceDatabaseHostName: sources[0],
                    sourceDatabaseInstanceName: sources[1],
                    sourceDatabaseName: sources[2],
                    createdAt: parseInt(getProperty(item, 'createdAt') || String(Date.now()), 10),
                    updatedAt: parseInt(getProperty(item, 'updatedAt') || String(Date.now()), 10),
                    tag: getProperty(item, 'tag'),
                    baseSnapshot: getProperty(item, 'baseSnapshot')
                };

                sandboxInfo.push(databaseObject);
            });

            return sandboxInfo;
        } catch (err) {
            return errorResponse(err);
        }
    }
    if ((process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') && sandboxes) {
        const demoSandboxInfo = sandboxes.map(item => {
            const { databaseName: sandboxName, source, createdAt, updatedAt, tag, baseSnapshot } = item;

            const databaseObject = {
                sandboxName,
                databaseHostName: resourceDetails.resource_name!,
                databaseHostId: resourceDetails.resource_id!,
                databaseInstanceName: DEFAULT_INSTANCE_NAME,
                sourceDatabaseHostName: source.split('|')[0],
                sourceDatabaseInstanceName: source.split('|')[1],
                sourceDatabaseName: source.split('|')[2],
                createdAt,
                updatedAt,
                tag,
                baseSnapshot
            };
            return databaseObject;
        });
        if (demoSandboxInfo.length > 0) {
            sandboxInfo = sandboxInfo.concat(demoSandboxInfo);
        }
    }
    return sandboxInfo;
}

async function getSandboxesInfo(accountId: string, credentialsId: string, region: string, nextToken?: string) {
    logger.info('Get Sandboxes Info', accountId, credentialsId, region, nextToken);
    const resourceDetails = await listResources(
        accountId,
        undefined,
        credentialsId,
        region,
        RESOURCESTYPE.MSSQL,
        undefined,
        process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator' ? undefined : { sandboxCreated: true },
        SANDBOX_API_SIZE,
        nextToken
    );

    if (isEmpty(resourceDetails)) {
        logger.error(`No successfully deployed database hosts found for account ${accountId}.`);
        return { count: 0, items: [], nextToken: '' };
    }

    try {
        let sandboxes: SandboxInfoResponseType[] = [];

        await Promise.all(
            resourceDetails.map(async (resourceDetail: ResourceDetails) => {
                const sandboxDetails = await getSandboxDetails(accountId, credentialsId, region, resourceDetail);
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

async function getSandboxSavings(accountId: string, credentialsId: string, region: string) {
    try {
        logger.info('Get sandbox savings', { accountId, credentialsId, region });

        const savingsData = {
            consumedStorage: 0,
            savedStorage: 0,
            sandboxSavingsPercentage: 0
        };

        const resourceDetails = await listResources(
            accountId,
            undefined,
            credentialsId,
            region,
            RESOURCESTYPE.MSSQL,
            undefined,
            process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
                ? undefined
                : {
                      sandboxCreated: true
                  }
        );

        if (isEmpty(resourceDetails)) {
            logger.error(`No successfully deployed database hosts found for account ${accountId}.`);
            return savingsData;
        }

        const fsxGroups = groupBy(resourceDetails, 'co_relation_id'); // { fsxId: Array<resource> }

        await Promise.all(
            Object.keys(fsxGroups).map(
                throat(10, async fsxId => {
                    for (const resourceDetail of fsxGroups[fsxId]) {
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
                                if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
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
                                    accountId
                                );

                                if (response) {
                                    let { savedStorage, consumedStorage } = sqlResponseParsing(response);

                                    // Increase storage savings per sandbox for demo
                                    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
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
    volumeName: string;
    lunPath: string;
    lunSerialNumber: string;
    windowsVolumeName: string;
    volumeUuid: string;
    parentSvm?: string;
    parentVolume?: string;
}

interface VolumeLunMapping {
    svm: string;
    collation?: string;
    data: VolumeLunMap;
    log: VolumeLunMap;
}

interface HostAndDbInfo extends DbInfo {
    resourceName: string;
    instanceName: string;
    fsxId: string;
    svm: string;
    activeNodeInstanceId: string;
    metadata: Metadata;
}

interface ClonedVolume {
    volumeName: string;
    volumeId: string;
    lunSerialNumber: string;
    parentSnapshot: string;
}
interface ClonedVolumes {
    log: ClonedVolume;
    data: ClonedVolume;
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

    let [[srcResourceDetail], [destResourceDetail]] = await Promise.all([
        listResources(accountId, source.host),
        source.host === dest.host ? Promise.resolve([]) : listResources(accountId, dest.host)
    ]);

    if (source.host === dest.host) {
        destResourceDetail = srcResourceDetail;
    }

    if (isEmpty(srcResourceDetail)) {
        throw createError(HttpErrorCodes.NOT_FOUND, `No database host by id ${source.host} for ${accountId} is found.`);
    }

    if (isEmpty(destResourceDetail)) {
        throw createError(HttpErrorCodes.NOT_FOUND, `No database host by id ${dest.host} for ${accountId} is found.`);
    }

    if (srcResourceDetail.co_relation_id !== destResourceDetail.co_relation_id) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            'The source and destination host should be connected to the same FSx'
        );
    }

    const { node1InstanceId: srcNode1, node2InstanceId: srcNode2 } = srcResourceDetail.metadata as unknown as Metadata;
    const { node1InstanceId: destNode1, node2InstanceId: destNode2 } =
        destResourceDetail.metadata as unknown as Metadata;

    let [srcStatus, destStatus] = await Promise.all([
        getActiveSqlNode(credentialsId, region, srcNode1, srcNode2),
        source.host === dest.host
            ? Promise.resolve(
                  {} as {
                      isSSMConnected: boolean;
                      activeNodeInstanceId: string;
                      standbyNodeInstanceId: string | undefined;
                      instanceName: string;
                  }
              )
            : getActiveSqlNode(credentialsId, region, destNode1, destNode2)
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

    const job = await registerJob(accountId, credentialsId, region, {
        name: `Creating sandbox ${dest.database} in the target host ${destResourceDetail.resource_name}`,
        description: `Creating sandbox ${dest.database} in the target host ${destResourceDetail.resource_name}`,
        resourceName: dest.database,
        initiator: 'SYSTEM',
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.SANDBOX
    });

    const { fsxSvmId: sourceSvm } = srcResourceDetail.metadata as unknown as Metadata;
    const { fsxSvmId: destSvm } = destResourceDetail.metadata as unknown as Metadata;

    startSandboxCreation(
        accountId,
        credentialsId,
        region,
        job.id,
        {
            ...source,
            resourceName: srcResourceDetail.resource_name!,
            svm: sourceSvm!,
            fsxId: srcResourceDetail.co_relation_id!,
            activeNodeInstanceId: srcStatus.activeNodeInstanceId!,
            metadata: srcResourceDetail.metadata as unknown as Metadata,
            instanceName: srcStatus.instanceName || '.'
        },
        {
            ...dest,
            resourceName: destResourceDetail.resource_name!,
            svm: destSvm!,
            fsxId: destResourceDetail.co_relation_id!,
            activeNodeInstanceId: destStatus.activeNodeInstanceId!,
            metadata: destResourceDetail.metadata as unknown as Metadata,
            instanceName: destStatus.instanceName || '.'
        },
        tag,
        mountPoints
    );

    return { jobId: job.id };
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
    let status;

    let clonedVolumes;
    let mountPaths;

    try {
        await validateCloneParams(accountId, credentialsId, region, parentJobId, srcDetails, destDetails, mountPoints);

        const mappings = (await getMappings(
            accountId,
            credentialsId,
            region,
            parentJobId,
            srcDetails
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
        )) as { dataPath: string; logPath: string };

        await createCloneDb(accountId, credentialsId, region, parentJobId, destDetails, mountPaths, mappings.collation);

        await createExtendedProperties(accountId, credentialsId, region, parentJobId, srcDetails, destDetails, {
            tag,
            cloned_by: 'netapp_wf',
            source: `${srcDetails.resourceName}|${DEFAULT_INSTANCE_NAME}|${srcDetails.database}`,
            createdAt: Date.now(), // to be used for calculating age
            updatedAt: Date.now(), // to be used for getting the last update
            baseSnapshot: clonedVolumes.data.parentSnapshot,
            accountId
        });

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(e);
        errorMsg = e.message || 'Internal Server Error';
        status = JOBSTATUS.FAILED;
        await startCleanup(
            accountId,
            credentialsId,
            region,
            parentJobId,
            srcDetails,
            destDetails,
            clonedVolumes ? [clonedVolumes.data.volumeId, clonedVolumes.log.volumeId] : [],
            compact([mountPaths?.dataPath, mountPaths?.logPath])
        );
    } finally {
        // clearning all the ssm command cache so that we will get the fresh data once the sandbox is created
        resetCache(SSM_COMMAND_CACHE_TYPE);
        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
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
        isDriveClustered?: boolean;
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
        throw createError(412, `Selected drive ${selectedDrive} is not a NetApp drive`);
    }
    if (isClustered === 'true' && !matchedExistingDrive.isDriveClustered) {
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
        description: `Validate if the sandbox ${destDetails.database} already exists in the target host ${destDetails.resourceName}`,
        startTime: Date.now(),
        name: 'Validate if sandbox already exists and mount point drives are existing.',
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: destDetails.database,
        parentJobId
    });

    try {
        if (srcDetails.host !== destDetails.host || srcDetails.instance !== destDetails.instance) {
            const [srcSqlServerVersion, destSqlServerVersion] = await Promise.all([
                getSqlServerVersion(credentialsId, region, srcDetails.activeNodeInstanceId, srcDetails.instanceName),
                getSqlServerVersion(credentialsId, region, destDetails.activeNodeInstanceId, destDetails.instanceName)
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
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );

        const [destDatabaseExists, srcDatabaseExists] = await Promise.all([
            checkDatabaseExists(
                accountId,
                credentialsId,
                region,
                destDetails.host,
                destDetails.database,
                destDetails.activeNodeInstanceId,
                destDetails.instanceName
            ),
            checkDatabaseExists(
                accountId,
                credentialsId,
                region,
                srcDetails.host,
                srcDetails.database,
                srcDetails.activeNodeInstanceId,
                srcDetails.instanceName
            )
        ]);

        if (destDatabaseExists) {
            throw createError(
                412,
                `Database ${destDetails.database} already exists on destination host ${srcDetails.host}`
            );
        }

        if (!srcDatabaseExists && !(process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator')) {
            throw createError(
                412,
                `Database ${srcDetails.database} does not exists on source host ${destDetails.host}`
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
        await updateJobDetails(accountId, credentialsId, region, validationJob.id, {
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
    srcDetails: HostAndDbInfo
) {
    logger.info('Get volume mappings', { accountId, credentialsId, region, parentJobId, srcDetails });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const mappingJob = await registerJob(accountId, credentialsId, region, {
        description: `Get the volume LUN mapping for the database ${srcDetails.database} of the host ${srcDetails.resourceName}`,
        startTime: Date.now(),
        name: `Get volume LUN mappings for database ${srcDetails.database}`,
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: srcDetails.database,
        parentJobId
    });

    try {
        const { fsxId, database } = srcDetails;

        let command = [getDbMappedOntapVolumes(fsxId, region, database)];

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            command = [getDbMappedOntapVolumes('test-fsx', 'us-east-1', 'testdb')];
        }

        const mappings = await callSsmExecution(
            credentialsId,
            region,
            command,
            srcDetails.activeNodeInstanceId,
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
        await updateJobDetails(accountId, credentialsId, region, mappingJob.id, {
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
    snapshot?: string
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
        type: JOBTYPE.SANDBOX,
        resourceName: destDetails.database,
        parentJobId
    });

    try {
        const { StorageVirtualMachines: fsxSVMs } = await describeFSxStorageVirtualMachines(
            credentialsId,
            region,
            destDetails.fsxId
        );

        const svmList = fsxSVMs?.filter(svm => svm.StorageVirtualMachineId === destDetails.svm) || [];
        const sqlVMName = svmList[0]?.Name;

        let command = [
            CreateVolumeCloneScript(
                srcDetails.fsxId,
                region,
                mapping.svm,
                JSON.stringify({ name: mapping.data.volumeName, ...(snapshot && { snapshot }) }),
                JSON.stringify({ name: mapping.log.volumeName, ...(snapshot && { snapshot }) }),
                destDetails.host,
                getClonedByTagValue(accountId, credentialsId),
                sqlVMName || mapping.svm
            )
        ];
        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            command = [
                CreateVolumeCloneScript(
                    'test-fsx',
                    'us-east-1',
                    'wlmdb_sqlsvm_1714090636810',
                    JSON.stringify({ name: 'wlmdb_sqldata_1714098400' }),
                    JSON.stringify({ name: 'wlmdb_sqllog_1714098400' }),
                    'test-res-id',
                    'netapp_wf_test_account_test_cred'
                )
            ];
        }

        const clonedVolumes = await callSsmExecution(
            credentialsId,
            region,
            command,
            destDetails.activeNodeInstanceId,
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
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
        await updateJobDetails(accountId, credentialsId, region, createVolumeCloneJob.id, {
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
    mountPoints: MountPoints
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
        description: `Discover cloned LUNs and create virtual mount points in the target host ${destDetails.resourceName}`,
        startTime: Date.now(),
        name: 'Discover cloned LUNs and create virtual mount point',
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: destDetails.database,
        parentJobId
    });

    while (retries > 0) {
        retries -= 1;

        // its required to sleep for 30 seconds so that initialization script will go through.. the ontap LUN configure can take time depending on busy system for the multiple API calls, and the disk initialize may take time to discover the created LUNs
        if (process.env.NODE_ENV !== 'demo' && process.env.NODE_ENV !== 'simulator') {
            await sleep(45000);
        }
        const splitDataPath = mappings.data.fileName.split('\\');
        const dataMappingfile = splitDataPath.slice(1).join('\\');
        const splitLogPath = mappings.log.fileName.split('\\');
        const logMappingfile = splitLogPath.slice(1).join('\\');

        const dataFileName = `${mountPoints.dataDrive}:\\${dataMappingfile}`;
        const logFileName = `${mountPoints.logDrive}:\\${logMappingfile}`;

        try {
            let command = [
                `${INVOKE_VIRTUAL_MOUNT} -DBName ${destDetails.database}  -DataFilePath ${dataFileName}  -LogFilePath ${logFileName}  -DataSerial '${clonedVolumes.data.lunSerialNumber}' -LogSerial '${clonedVolumes.log.lunSerialNumber}'`
            ];

            if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
                command = [
                    `${INVOKE_VIRTUAL_MOUNT} -DBName test-clone -DataFilePath D:\\MSSQL\\data\\testdb_data.mdf  -LogFilePath E:\\MSSQL\\log\\testdb_log.ldf  -DataSerial lWB44?VEq9vf -LogSerial lWB44?VEq9ve`
                ];
            }

            const resp = await callSsmExecution(
                credentialsId,
                region,
                command,
                destDetails.activeNodeInstanceId,
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
                await updateJobDetails(accountId, credentialsId, region, invokeMountJob.id, {
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
    mountPaths: { dataPath: string; logPath: string },
    collation?: string
) {
    logger.info(
        'Create database clone',
        accountId,
        credentialsId,
        region,
        parentJobId,
        destDetails,
        mountPaths,
        collation
    );

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const createCloneDbJob = await registerJob(accountId, credentialsId, region, {
        description: `Create sandbox ${destDetails.database} on the target host ${destDetails.resourceName}`,
        startTime: Date.now(),
        name: `Create sandbox ${destDetails.database}`,
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: destDetails.database,
        parentJobId
    });

    try {
        let command = [
            // The instance name fix is temporary fix where the instance name is retrieved from the getActiveNode method since we are supporting only single instance. The instance value passed by the user in the body of API will ot be used. Once we support multiple instances this needs to be updated as well.
            createCloneDbScript(destDetails.database, destDetails.instanceName, [
                mountPaths.dataPath,
                mountPaths.logPath
            ])
        ];

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            command = [
                createCloneDbScript('testdb', '.', [
                    'S:\\testdb_clone-Data\\mssql\\data\\testdb.mdf',
                    'L:\\testdb_clone-Log\\mssql\\log\\testdb_log.ldf'
                ])
            ];
        }

        const resp = await callSsmExecution(
            credentialsId,
            region,
            command,
            destDetails.activeNodeInstanceId,
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );

        // We only get a response for  different server version or in case of error from query
        if (
            resp &&
            !resp.toLowerCase().includes('converting database') &&
            !resp.includes('running the upgrade step from version')
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
        await updateJobDetails(accountId, credentialsId, region, createCloneDbJob.id, {
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
    extendedProps: { [x: string]: number | string | boolean }
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
        description: `Add extended properties to sandbox ${destDetails.database} on the target host ${destDetails.resourceName}`,
        startTime: Date.now(),
        name: `Add extended properties to sandbox ${destDetails.database}`,
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: destDetails.database,
        parentJobId
    });

    try {
        let command = [addExtendedProperties(destDetails.database, destDetails.instanceName, extendedProps)];

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            command = [
                addExtendedProperties('testdb', '.', {
                    tag: 'demo',
                    cloned_by: 'netapp_wf',
                    source: 'resource|instance|testdb',
                    baseSnapshot: 'parentSnapshot'
                })
            ];
        }
        const resp = await callSsmExecution(credentialsId, region, command, destDetails.activeNodeInstanceId);

        // We only get a response in case of error from query
        if (resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, resp);
        }

        if (!destDetails.metadata.sandboxCreated) {
            await updateMetadataForSanbox(accountId, credentialsId, region, destDetails.host);
        }

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            // this is used to retreive the newly created user databases in database list for demo using meta data
            const props = {
                databaseName: destDetails.database,
                ...extendedProps,
                baseSnapshot: `netapp_wf_${Date.now()}`
            } as Sandbox;
            const updatedMetadata: Metadata = await updateSandboxDBIntoResourceData(
                accountId,
                srcDetails.host,
                props,
                srcDetails.metadata
            );

            await updateUserDBIntoResourceData(accountId, srcDetails.host, destDetails.database, updatedMetadata);
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(e);

        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    } finally {
        await updateJobDetails(accountId, credentialsId, region, createExtendedPropertiesJob.id, {
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
    filePaths: Array<string>
) {
    logger.info('Start cleanup', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        srcDetails,
        destDetails,
        volumeIds,
        filePaths
    });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const cleanupJob = await registerJob(accountId, credentialsId, region, {
        description: `Clean up resource for sandbox ${destDetails.database}`,
        startTime: Date.now(),
        name: 'Clean up resources',
        status,
        type: JOBTYPE.SANDBOX,
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
                destDetails.instanceName
            )
        ];

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            command = [
                cleanUpOntapResources(
                    'test-fsx',
                    'us-east-1',
                    JSON.stringify(['5c1075d2-03a0-11ef-a514-55070fbfcab1', '5ace31ea-03a0-11ef-a514-55070fbfcab1']),
                    JSON.stringify([
                        'S:\\testdb_clone-Data\\mssql\\data\\testdb.mdf',
                        'L:\\testdb_clone-Log\\mssql\\log\\testdb_log.ldf'
                    ]),
                    'testdb'
                )
            ];
        }

        const resp = await callSsmExecution(
            credentialsId,
            region,
            command,
            destDetails.activeNodeInstanceId,
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
        );

        if (!resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to cleanup');
        }

        status = JOBSTATUS.COMPLETED;
        return sqlResponseParsing(resp);
    } catch (e: any) {
        logger.error(`Failed to perform cleanup for sandbox ${destDetails.database}`);
        status = JOBSTATUS.FAILED;
        errorMsg = `Failed to clean up ${e.message}`;
    } finally {
        await updateJobDetails(accountId, credentialsId, region, cleanupJob.id, {
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
    } = await getResources(accountId, databaseHostId);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }
    const { metadata } = resourceDetail;

    const newMetadata = metadata as unknown as Metadata;
    newMetadata.sandboxCreated = true;
    try {
        await updateResourceMetaData(accountId, databaseHostId, newMetadata);
        logger.info('Metadata updated succesfully for sandbox operation', accountId, databaseHostId);
    } catch (err) {
        const errorMessage = `Failed to update metadata for sandbox operation, ${accountId}, ${databaseHostId}, ${err}`;
        logger.error(errorMessage);
        throw createError(errorMessage);
    }
}

async function updateMetadataForSanboxTesting(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string
) {
    logger.info('Updating metadata for sandbox testing', accountId, credentialsId, region, databaseHostId);
    const {
        items: [resourceDetail]
    } = await getResources(accountId, databaseHostId);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }
    const { metadata } = resourceDetail;

    const newMetadata = metadata as unknown as Metadata;

    newMetadata.sandboxCreated = true;
    newMetadata.updatedManually = true;
    try {
        await updateResourceMetaData(accountId, databaseHostId, newMetadata);
        return 'metadata updated succesfully';
    } catch (err) {
        return err;
    }
}

async function revertMetadataForSanboxTesting(accountId: string, credentialsId: string, region: string) {
    const resourceDetails = await listResources(
        accountId,
        undefined,
        credentialsId,
        region,
        RESOURCESTYPE.MSSQL,
        undefined,
        { updatedManually: true }
    );

    if (isEmpty(resourceDetails)) {
        logger.error(`No manually updated resources ${accountId}.`);
        return 'No manually updated resources';
    }

    await Promise.all(
        resourceDetails.map(async resourceDetail => {
            const { resource_id: resourceId, metadata } = resourceDetail;
            const newMetadata = metadata as unknown as Metadata;
            try {
                delete newMetadata.sandboxCreated;
                delete newMetadata.updatedManually;
                await updateResourceMetaData(accountId, resourceId, newMetadata);
            } catch (err) {
                logger.error('Failed to update meatadata', resourceId, err);
            }
        })
    );

    return 'Revereted manually updated metadatas';
}

async function updateMetadataForSanboxDeletion(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseNameToRemove: string,
    isSplit: boolean = false
) {
    logger.info('Updating metadata for sandbox operation', accountId, credentialsId, region, databaseHostId);
    const {
        items: [resourceDetail]
    } = await getResources(accountId, databaseHostId);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }
    const { metadata } = resourceDetail;
    const newMetadata = metadata as unknown as Metadata;

    newMetadata.sandboxes = newMetadata.sandboxes?.filter(sandbox => sandbox.databaseName !== databaseNameToRemove);
    if (!isSplit) {
        newMetadata.userDatabase = newMetadata.userDatabase?.filter(db => db.name !== databaseNameToRemove);
    }
    try {
        await updateResourceMetaData(accountId, databaseHostId, newMetadata);
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
    sandboxName: string
) {
    logger.info('Get connection string', { accountId, credentialsId, region, databaseHostId, sandboxName });
    try {
        const [{ metadata, resource_name: resourceName }] = await listResources(
            accountId,
            databaseHostId,
            credentialsId
        );

        const { node1InstanceId, node2InstanceId, stackname, activeDirectoryName } = metadata as unknown as Metadata;

        const { instanceName } = await getActiveSqlNode(
            credentialsId,
            region,
            node1InstanceId,
            node2InstanceId,
            databaseHostId
        );

        if (!instanceName) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get the connection string');
        }

        const resp = await getParameter(credentialsId, region, `${SSM_PARAM_PREFIX}${stackname}`);

        if (!resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get the connection string');
        }

        const parsedResp = sqlResponseParsing(resp);

        return {
            server:
                instanceName === '.'
                    ? `${resourceName}.${activeDirectoryName}`
                    : `${instanceName}.${activeDirectoryName}`,
            database: sandboxName,
            userId:
                process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
                    ? 'admin'
                    : parsedResp?.domain?.username
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
    databaseName: string,
    instance: string
) {
    logger.info(
        `Fetching mount point information for database host id ${databaseHostId} database ${databaseName} `,
        accountId,
        region,
        credentialsId,
        instance
    );
    const {
        items: [resourceDetail]
    } = await getResources(accountId, databaseHostId, credentialsId);

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, `${errorMessage}`);
    }

    const { metadata } = resourceDetail;
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId, instanceName } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId
    );

    if (!isSSMConnected || activeNodeInstanceId === undefined || instanceName === undefined) {
        const errorMessage = `Unable to get mount point information for database host id ${databaseHostId} database ${databaseName} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const actualDbName = databaseName;

    try {
        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            databaseName = 'test-database';
        }

        const command = [mountPointQuery(instanceName, databaseName)];

        const mountPoints = await callSsmExecution(credentialsId, region, command, activeNodeInstanceId);
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
        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            const updatedResult = {
                databaseDataPath: result.databaseDataPath.map(path => path.replace('test-database', actualDbName)),
                databaseLogPath: result.databaseLogPath.map(path => path.replace('test-database', actualDbName))
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

    const [resourceDetails] = await listResources(accountId, databaseHostId, credentialsId, region);

    if (!resourceDetails) {
        throw createError(HttpErrorCodes.NOT_FOUND, 'Could not find the database host');
    }

    const { node1InstanceId, node2InstanceId, fsxSvmId } = resourceDetails.metadata as unknown as Metadata;

    const { isSSMConnected, instanceName, activeNodeInstanceId } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId,
        databaseHostId
    );

    if (!isSSMConnected) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'SSM connection could not be established with the host'
        );
    }

    const job = await registerJob(accountId, credentialsId, region, {
        name: `Delete sandbox ${databaseName}`,
        description: `Delete sandbox ${databaseName} in the host ${resourceDetails.resource_name}`,
        resourceName: databaseName,
        initiator: 'SYSTEM',
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.SANDBOX
    });

    const resDetails = {
        resourceName: resourceDetails.resource_name!,
        instanceName: instanceName!,
        fsxId: resourceDetails.co_relation_id!,
        svm: fsxSvmId!,
        activeNodeInstanceId: activeNodeInstanceId!,
        metadata: resourceDetails.metadata as unknown as Metadata,
        database: databaseName,
        instance: instanceName!,
        host: databaseHostId
    };

    performSandboxDeletion(accountId, region, credentialsId, job.id, resDetails);

    return { jobId: job.id };
}

async function performSandboxDeletion(
    accountId: string,
    region: string,
    credentialsId: string,
    parentJobId: string,
    resDetails: HostAndDbInfo
) {
    let errorMsg;
    let status: string = JOBSTATUS.IN_PROGRESS;
    try {
        // Creating a validation job to accomodate more validations in the future in one job
        await validateDeleteSandboxParams(accountId, credentialsId, region, parentJobId, resDetails);

        const mappings = (await getMappings(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resDetails
        )) as VolumeLunMapping;

        await startCleanup(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resDetails,
            resDetails,
            [mappings.data.volumeUuid, mappings.log.volumeUuid],
            [mappings.data.fileName, mappings.log.fileName]
        );
        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error('Failed to delete the sandbox', e);
        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
    } finally {
        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
            status,
            error: errorMsg,
            endTime: Date.now()
        });
        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            updateMetadataForSanboxDeletion(accountId, credentialsId, region, resDetails.host, resDetails.database);
        }
    }
}

async function validateDeleteSandboxParams(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    resourceDetails: HostAndDbInfo
) {
    logger.info('Validate delete sandbox params', { accountId, credentialsId, region, parentJobId, resourceDetails });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const validationJob = await registerJob(accountId, credentialsId, region, {
        description: `Validate if the sandbox ${resourceDetails.database} exists in the target host ${resourceDetails.resourceName}`,
        startTime: Date.now(),
        name: 'Validate if sandbox exists',
        status,
        type: JOBTYPE.SANDBOX,
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
            resourceDetails.instanceName
        );

        if (!dbExists && !(process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator')) {
            throw createError(
                412,
                `Database ${resourceDetails.database} does not exists on source host ${resourceDetails.resourceName}`
            );
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(e);
        errorMsg = e.message || 'Internal Server Error';
        status = JOBSTATUS.FAILED;
        throw createError(e.statusCode, errorMsg);
    } finally {
        await updateJobDetails(accountId, credentialsId, region, validationJob.id, {
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
    sandboxName: string
) {
    logger.info('Get split estimate of mapped volumes', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        sandboxName
    });

    const [{ metadata, co_relation_id: fileSystemId }] = await listResources(
        accountId,
        databaseHostId,
        credentialsId,
        region
    );
    const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

    const { isSSMConnected, activeNodeInstanceId, instanceName } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId
    );

    if (!isSSMConnected) {
        logger.error('Failed to connect to the host through SSM', { databaseHostId });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to connect to the host through SSM');
    }

    if (!activeNodeInstanceId || !instanceName || !fileSystemId) {
        logger.error('Failed to get the active node instance id', { databaseHostId });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get the active node instance id');
    }

    let command = [getDbMappedOntapVolumes(fileSystemId, region, sandboxName, instanceName)];

    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        command = [getDbMappedOntapVolumes('test-fsx', 'us-east-1', 'testdb')];
    }

    const mappings = await callSsmExecution(credentialsId, region, command, activeNodeInstanceId, accountId, false);

    if (!mappings) {
        logger.error('Failed to get volume lun mapping for the database', { databaseHostId, sandboxName });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get volume lun mapping for the database');
    }

    const parsedResp = sqlResponseParsing(mappings);

    if (parsedResp.error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedResp.error);
    }

    // get the estimated split size
    let estimateCommand = [
        restGetUtilForOntap(
            fileSystemId,
            region,
            '/storage/volumes',
            `uuid=${[parsedResp.data.volumeUuid, parsedResp.log.volumeUuid].join('|')}`,
            'fields=clone.split_estimate'
        )
    ];

    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        estimateCommand = [
            restGetUtilForOntap(
                'test-fsx',
                'us-east-1',
                '/storage/volumes',
                'uuid=5c1075d2-03a0-11ef-a514-55070fbfcab1|5ace31ea-03a0-11ef-a514-55070fbfcab1',
                'fields=clone.split_estimate'
            )
        ];
    }

    const estimateResp = await callSsmExecution(
        credentialsId,
        region,
        estimateCommand,
        activeNodeInstanceId,
        accountId,
        false
    );

    logger.info('ESTIMATED RESP>>>', estimateResp);

    if (!estimateResp) {
        logger.error('Failed to get volume split estimate', { databaseHostId });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get volume split estimate');
    }

    const estimateParsedResp = sqlResponseParsing(estimateResp);

    return estimateParsedResp.records.map((record: { name: string; clone: { split_estimate: string } }) => ({
        name: record.name,
        splitEstimate: record.clone.split_estimate || 0
    }));
}

async function updateSandboxLifeCycle(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
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
        databaseName,
        action,
        snapshot
    );

    const [resourceDetails] = await listResources(accountId, databaseHostId, credentialsId, region);

    if (isEmpty(resourceDetails)) {
        throw createError(HttpErrorCodes.NOT_FOUND, 'Could not find the database host');
    }

    const { resource_name: resourceName, metadata, co_relation_id: fsxId } = resourceDetails;

    const { node1InstanceId, node2InstanceId, fsxSvmId } = metadata as unknown as Metadata;

    const { isSSMConnected, instanceName, activeNodeInstanceId } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId,
        databaseHostId
    );

    if (!isSSMConnected) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'SSM connection could not be established with the host'
        );
    }

    const job = await registerJob(accountId, credentialsId, region, {
        name: `${action === 'REFRESH' ? 'Refresh' : 'Re-baseline'} sandbox ${databaseName}`,
        description: `${
            action === 'REFRESH' ? 'Refresh' : 'Re-baseline'
        } sandbox ${databaseName} in the host ${resourceName}`,
        initiator: 'SYSTEM',
        type: JOBTYPE.SANDBOX,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: databaseName,
        startTime: Date.now()
    });

    const resDetails = {
        resourceName: resourceName!,
        instanceName: instanceName!,
        fsxId: fsxId!,
        svm: fsxSvmId!,
        activeNodeInstanceId: activeNodeInstanceId!,
        metadata: resourceDetails.metadata as unknown as Metadata,
        database: databaseName,
        instance: instanceName!,
        host: databaseHostId
    };

    performLifecycleUpdate(accountId, credentialsId, region, job.id, resDetails, action, snapshot);

    return { jobId: job.id };
}

async function performLifecycleUpdate(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    resourceDetails: HostAndDbInfo,
    action: string,
    snapshot?: string
) {
    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;
    let mappings;
    let clonedVolumes;
    let mountPaths;
    try {
        await validateLifeCycleParams(accountId, credentialsId, region, parentJobId, resourceDetails, action);

        mappings = (await getMappings(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails
        )) as VolumeLunMapping;

        if (!mappings.data.parentVolume || !mappings.log.parentVolume) {
            throw createError(
                HttpErrorCodes.VALIDATION_ERROR,
                'The sandbox seems to be already split and hence cannot be altered!'
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
                svm: mappings.data.parentSvm!,
                data: {
                    ...mappings.data,
                    volumeName: mappings.data.parentVolume!
                },
                log: {
                    ...mappings.log,
                    volumeName: mappings.log.parentVolume!
                }
            },
            snapshot
        )) as ClonedVolumes;

        let extendedProps = (await detachSandboxAndAccessPath(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            mappings
        )) as Sandbox;

        mountPaths = (await invokeVirtualMount(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            resourceDetails,
            mappings,
            clonedVolumes,
            {
                dataDrive: mappings.data.fileName.split(':')[0],
                logDrive: mappings.log.fileName.split(':')[0]
            }
        )) as { dataPath: string; logPath: string };

        await createCloneDb(accountId, credentialsId, region, parentJobId, resourceDetails, mountPaths);

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
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
            }
        );

        await startCleanup(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            resourceDetails,
            [mappings.data.volumeUuid, mappings.log.volumeUuid],
            []
        );

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(`Failed to perform lifecycle update for sandbox ${resourceDetails.database}`, e);
        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        await startCleanup(
            accountId,
            credentialsId,
            region,
            parentJobId,
            resourceDetails,
            resourceDetails,
            clonedVolumes ? [clonedVolumes.data.volumeId, clonedVolumes.log.volumeId] : [],
            []
        );

        if (mappings) {
            await reAttachSandboxAndAccessPath(
                accountId,
                credentialsId,
                region,
                parentJobId,
                resourceDetails,
                mappings
            );
        }
    } finally {
        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
            status,
            error: errorMsg,
            endTime: Date.now()
        });
    }
}

async function validateLifeCycleParams(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    resourceDetails: HostAndDbInfo,
    action: string
) {
    logger.info('Validate lifecycle parameters', accountId, credentialsId, region, parentJobId, resourceDetails);

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errMsg;

    const validationJob = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.SANDBOX,
        status,
        name: `Validate ${action === 'REFRESH' ? 'Refresh' : 'Re-baseline'} parameters for sandbox ${
            resourceDetails.database
        }`,
        description: `Validate ${action === 'REFRESH' ? 'Refresh' : 'Re-baseline'} parameters for sandbox ${
            resourceDetails.database
        }`,
        resourceName: resourceDetails.database,
        startTime: Date.now(),
        parentJobId
    });

    try {
        const { host, database, activeNodeInstanceId, instanceName } = resourceDetails;

        const dbExists = await checkDatabaseExists(
            accountId,
            credentialsId,
            region,
            host,
            database,
            activeNodeInstanceId!,
            instanceName
        );

        if (!dbExists && !(process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator')) {
            throw createError(
                412,
                `Database ${resourceDetails.database} does not exists on host ${resourceDetails.resourceName}`
            );
        }
        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(e);
        status = JOBSTATUS.FAILED;
        errMsg = `Validate failed: ${e.message}`;
        throw createError(e.statusCode, e.message);
    } finally {
        await updateJobDetails(accountId, credentialsId, region, validationJob.id, {
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
    mappings: VolumeLunMapping
) {
    logger.info(
        'Detach sandbox and access path',
        accountId,
        credentialsId,
        region,
        parentJobId,
        resourceDetails,
        mappings
    );

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errMsg;

    const detachJob = await registerJob(accountId, credentialsId, region, {
        description: `Detach sandbox and access path for database ${resourceDetails.database}`,
        startTime: Date.now(),
        name: `Detach sandbox and access path for database ${resourceDetails.database}`,
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: resourceDetails.database,
        parentJobId
    });

    try {
        let command = [
            detachDbAndRemoveAccessPath(
                resourceDetails.database,
                JSON.stringify([mappings.data.lunSerialNumber, mappings.log.lunSerialNumber]),
                JSON.stringify([mappings.data.fileName, mappings.log.fileName]),
                resourceDetails.instanceName
            )
        ];

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            command = [
                detachDbAndRemoveAccessPath(
                    'test-db',
                    '["123456789", "987654321"]',
                    '["S:\\test-db-Data", "L:\\test-db-Log"]',
                    '.'
                )
            ];
        }

        const resp = await callSsmExecution(credentialsId, region, command, resourceDetails.activeNodeInstanceId);

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
        logger.error('Failed to detach sandbox and access path', e);
        status = JOBSTATUS.FAILED;
        errMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg);
    } finally {
        await updateJobDetails(accountId, credentialsId, region, detachJob.id, {
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
    logger.info(
        'Re-attach sandbox and access path',
        accountId,
        credentialsId,
        region,
        parentJobId,
        resourceDetails,
        mappings
    );

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errMsg;

    const detachJob = await registerJob(accountId, credentialsId, region, {
        description: `Re-attach sandbox and access path for database ${resourceDetails.database}`,
        startTime: Date.now(),
        name: `Re-attach sandbox and access path for database ${resourceDetails.database}`,
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: resourceDetails.database,
        parentJobId
    });

    try {
        const command = [
            addAccessPathAndAttachDb(
                resourceDetails.database,
                { serial: mappings.log.lunSerialNumber, path: mappings.log.fileName },
                { serial: mappings.data.lunSerialNumber, path: mappings.data.fileName },
                resourceDetails.instanceName
            )
        ];
        const resp = await callSsmExecution(credentialsId, region, command, resourceDetails.activeNodeInstanceId);

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
        logger.error('Failed to detach sandbox and access path', e);
        status = JOBSTATUS.FAILED;
        errMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg);
    } finally {
        await updateJobDetails(accountId, credentialsId, region, detachJob.id, {
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
    databaseName: string
) {
    logger.info('Split sandbox', { accountId, credentialsId, region, databaseHostId, databaseName });

    const [resourceDetails] = await listResources(accountId, databaseHostId, credentialsId, region);

    if (isEmpty(resourceDetails)) {
        throw createError(HttpErrorCodes.NOT_FOUND, 'Could not find the database host');
    }

    const { resource_name: resourceName, metadata, co_relation_id: fsxId } = resourceDetails;

    const { node1InstanceId, node2InstanceId, fsxSvmId } = metadata as unknown as Metadata;

    const { isSSMConnected, instanceName, activeNodeInstanceId } = await getActiveSqlNode(
        credentialsId,
        region,
        node1InstanceId,
        node2InstanceId,
        databaseHostId
    );

    if (!isSSMConnected) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'SSM connection could not be established with the host'
        );
    }

    const job = await registerJob(accountId, credentialsId, region, {
        name: `Split sandbox ${databaseName}`,
        description: `Split sandbox ${databaseName} in the host ${resourceName}`,
        initiator: 'SYSTEM',
        type: JOBTYPE.SANDBOX,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: databaseName,
        startTime: Date.now()
    });

    const resDetails = {
        resourceName: resourceName!,
        instanceName: instanceName!,
        fsxId: fsxId!,
        svm: fsxSvmId!,
        activeNodeInstanceId: activeNodeInstanceId!,
        metadata: resourceDetails.metadata as unknown as Metadata,
        database: databaseName,
        instance: instanceName!,
        host: databaseHostId
    };

    performSplitOperation(accountId, credentialsId, region, job.id, resDetails);

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
            resDetails
        )) as VolumeLunMapping;

        await splitVolumes(
            accountId,
            credentialsId,
            region,
            parentJobId,
            [mappings.data.volumeUuid, mappings.log.volumeUuid],
            resDetails
        );

        await deleteExtendedProperties(accountId, credentialsId, region, parentJobId, resDetails);

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        status = JOBSTATUS.FAILED;
        errMsg = e.message || 'Internal Server Error';
    } finally {
        await updateJobDetails(accountId, credentialsId, region, parentJobId, {
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
        description: `Validate if the sandbox ${resourceDetails.database} exists in the target host ${resourceDetails.resourceName}`,
        startTime: Date.now(),
        name: 'Validate if sandbox exists',
        status,
        type: JOBTYPE.SANDBOX,
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
            resourceDetails.instanceName
        );

        if (!dbExists && !(process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator')) {
            throw createError(
                412,
                `Database ${resourceDetails.database} does not exists on source host ${resourceDetails.resourceName}`
            );
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(e);
        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode, errorMsg);
    } finally {
        await updateJobDetails(accountId, credentialsId, region, validationJob.id, {
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
    volumeIds: Array<string>,
    resourceDetail: HostAndDbInfo
) {
    logger.info('Split volumes', { accountId, credentialsId, region, parentJobId, volumeIds, resourceDetail });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;
    const splitJob = await registerJob(accountId, credentialsId, region, {
        name: `Split volumes for ${resourceDetail.database}`,
        description: `Split volumes for ${resourceDetail.database} in the host ${resourceDetail.resourceName}`,
        type: JOBTYPE.SANDBOX,
        status,
        resourceName: resourceDetail.database,
        startTime: Date.now(),
        parentJobId
    });

    try {
        const command = [
            splitFlexCloneVolumes(resourceDetail.fsxId, region, JSON.stringify(volumeIds), resourceDetail.instanceName)
        ];

        const resp = await callSsmExecution(
            credentialsId,
            region,
            command,
            resourceDetail.activeNodeInstanceId,
            accountId,
            false,
            CUSTOM_SSM_EXECUTION_TIMEOUT
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
        await updateJobDetails(accountId, credentialsId, region, splitJob.id, {
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
        description: `Delete extended properties for ${resourceDetail.database}`,
        startTime: Date.now(),
        name: `Delete extended properties for ${resourceDetail.database}`,
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: resourceDetail.database,
        parentJobId
    });

    try {
        let command = [
            deleteExtendedPropertiesScript(resourceDetail.database, resourceDetail.instanceName, [
                'cloned_by',
                'baseSnapshot',
                'source',
                'createdAt',
                'updatedAt',
                'tag',
                'accountId'
            ])
        ];

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            command = [
                deleteExtendedPropertiesScript('test-db', '.', [
                    'cloned_by',
                    'baseSnapshot',
                    'source',
                    'createdAt',
                    'updatedAt',
                    'tag',
                    'accountId'
                ])
            ];
        }

        const resp = await callSsmExecution(credentialsId, region, command, resourceDetail.activeNodeInstanceId);

        if (resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete the extended properties');
        }

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            await updateMetadataForSanboxDeletion(
                accountId,
                credentialsId,
                region,
                resourceDetail.host,
                resourceDetail.database,
                true
            );
        }

        status = JOBSTATUS.COMPLETED;
    } catch (e: any) {
        logger.error(`Failed to delete the extended properties: ${e}`);
        status = JOBSTATUS.FAILED;
        errorMsg = e.message || 'Internal Server Error';
        throw createError(e.statusCode, errorMsg);
    } finally {
        await updateJobDetails(accountId, credentialsId, region, deleteJob.id, {
            status,
            error: errorMsg,
            endTime: Date.now()
        });
    }
}

export {
    getSandboxesInfo,
    getSandboxSavings,
    createSandbox,
    updateMetadataForSanboxTesting,
    revertMetadataForSanboxTesting,
    getDatabaseMountPointInfo,
    getSandboxConnectionString,
    deleteSandbox,
    getSandboxSplitEstimate,
    updateSandboxLifeCycle,
    splitSandbox
};
