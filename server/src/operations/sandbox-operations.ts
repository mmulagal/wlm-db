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
    SSM_COMMAND_CACHE_TYPE
} from '../utils/consts';
import {
    GET_SANDBOX_DETAILS,
    createVolumeClone as CreateVolumeCloneScript,
    getDbMappedOntapVolumes,
    cleanUpOntapResources,
    addExtendedProperties,
    createClonedDb as createCloneDbScript,
    getStorageSavingsFromOntap
} from './workloads/mssql/sandbox-scripts';
import { Metadata, ResourceDetails } from '../utils/common-types';
import { checkDatabaseExists, getActiveSqlNode } from './workloads/mssql/mssql-operations';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import { sleep, sqlResponseParsing } from '../utils/utils';
import { SandboxInfoResponseType } from '../routes/types/database-hosts.types';
import { getResources } from './database/database-operations';
import { registerJob, updateJobDetails } from './database/job-operations';
import { INVOKE_VIRTUAL_MOUNT } from './workloads/mssql/const';
import { updateSandboxDBIntoResourceData, updateUserDBIntoResourceData } from './demo-operations';
import { resetCache } from '../utils/cache';
import { describeFSxStorageVirtualMachines } from '../lib/aws/fsx';

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

    const command = [GET_SANDBOX_DETAILS(['"."'])];
    const response = await callSsmExecution(credentialsId, region, command, activeNodeInstanceId!);
    if (response) {
        let parsedResponse;
        try {
            parsedResponse = sqlResponseParsing(response);
        } catch (error: any) {
            return errorResponse(error.toString());
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

            let sandboxInfo: SandboxInfoResponseType[] = [];

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
                    tag: getProperty(item, 'tag')
                };

                sandboxInfo.push(databaseObject);
            });

            if ((process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') && sandboxes) {
                const demoSandboxInfo = sandboxes.map(item => {
                    const databaseObject = {
                        sandboxName: item.databaseName,
                        databaseHostName: resourceDetails.resource_name!,
                        databaseHostId: resourceDetails.resource_id!,
                        databaseInstanceName: DEFAULT_INSTANCE_NAME,
                        sourceDatabaseHostName: item.source.split('|')[0],
                        sourceDatabaseInstanceName: item.source.split('|')[1],
                        sourceDatabaseName: item.source.split('|')[2],
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt,
                        tag: item.tag
                    };
                    return databaseObject;
                });
                if (demoSandboxInfo.length > 0) {
                    sandboxInfo = sandboxInfo.concat(demoSandboxInfo);
                }
            }
            return sandboxInfo;
        } catch (error) {
            return errorResponse(error);
        }
    }
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
    } catch (error) {
        const errorMessage = `Error fetching Sandboxes info. ${error}.`;
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
                        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

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
                                // DEMO FSX ID AND REGION
                                if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
                                    fsxId = 'test-fsx';
                                    region = 'us-east-1';
                                }

                                const command = [getStorageSavingsFromOntap(fsxId, region)];

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
                                    const { savedStorage, consumedStorage } = sqlResponseParsing(response);
                                    savingsData.consumedStorage += consumedStorage;
                                    savingsData.savedStorage += savedStorage;
                                    savingsData.sandboxSavingsPercentage =
                                        (savingsData.savedStorage * 100) /
                                        (savingsData.consumedStorage + savingsData.savedStorage);
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
    windowsVolumeName: string;
    // volumeId: string;
}

interface VolumeLunMapping {
    svm: string;
    collation: string;
    data: VolumeLunMap;
    log: VolumeLunMap;
}

interface HostAndDbInfo extends DbInfo {
    resourceName: string;
    instanceName: string;
    fsxId: string;
    svm: string;
    activeNodeInstaceId: string;
    metadata: Metadata;
}

interface ClonedVolume {
    volumeName: string;
    volumeId: string;
    lunSerialNumber: string;
}
interface ClonedVolumes {
    log: ClonedVolume;
    data: ClonedVolume;
}

async function createSandbox(
    accountId: string,
    credentialsId: string,
    region: string,
    source: DbInfo,
    dest: DbInfo,
    tag: string
) {
    logger.info({ source, dest });

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
        resourceName: source.database,
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
            activeNodeInstaceId: srcStatus.activeNodeInstanceId!,
            metadata: srcResourceDetail.metadata as unknown as Metadata,
            instanceName: srcStatus.instanceName || '.'
        },
        {
            ...dest,
            resourceName: srcResourceDetail.resource_name!,
            svm: destSvm!,
            fsxId: destResourceDetail.co_relation_id!,
            activeNodeInstaceId: destStatus.activeNodeInstanceId!,
            metadata: destResourceDetail.metadata as unknown as Metadata,
            instanceName: destStatus.instanceName || '.'
        },
        tag
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
    tag: string
) {
    logger.info('Start sandbox creation process', { tag });
    let errorMsg;
    let status;

    let clonedVolumes;
    let mountPaths;

    try {
        await validateCloneParams(accountId, credentialsId, region, parentJobId, srcDetails, destDetails);

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
            clonedVolumes
        )) as { dataPath: string; logPath: string };

        await createCloneDb(accountId, credentialsId, region, parentJobId, destDetails, mountPaths, mappings.collation);

        await createExtendedProperties(accountId, credentialsId, region, parentJobId, srcDetails, destDetails, tag);

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

async function validateCloneParams(
    accountId: string,
    credentialsId: string,
    region: string,
    parentJobId: string,
    srcDetails: HostAndDbInfo,
    destDetails: HostAndDbInfo
) {
    logger.info('Validate clone params', { accountId, credentialsId, region, parentJobId, srcDetails, destDetails });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errMsg;

    const validationJob = await registerJob(accountId, credentialsId, region, {
        description: `Validate if the sandbox ${destDetails.database} already exists in the target host ${destDetails.resourceName}`,
        startTime: Date.now(),
        name: 'Validate if sandbox already exits',
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: srcDetails.database,
        parentJobId
    });

    try {
        await checkDatabaseExists(
            accountId,
            credentialsId,
            region,
            destDetails.host,
            destDetails.database,
            destDetails.activeNodeInstaceId,
            destDetails.instanceName
        );
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
        description: `Get the volume LUN mapping for the source database ${srcDetails.database} of the host ${srcDetails.resourceName}`,
        startTime: Date.now(),
        name: `Get volume LUN mappings for source database ${srcDetails.database}`,
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

        const mappings = await callSsmExecution(credentialsId, region, command, srcDetails.activeNodeInstaceId);

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
    mapping: VolumeLunMapping
) {
    logger.info('Create volume clone', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        mapping
    });

    let status: string = JOBSTATUS.IN_PROGRESS;
    let errorMsg;

    const createVolumeCloneJob = await registerJob(accountId, credentialsId, region, {
        description: 'Create ONTAP FlexClone volumes from the volumes mapped to the source SQL server',
        startTime: Date.now(),
        name: 'Create ONTAP FlexClone volumes',
        status,
        type: JOBTYPE.SANDBOX,
        resourceName: srcDetails.database,
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
                mapping.data.volumeName,
                mapping.data.lunPath,
                mapping.log.volumeName,
                mapping.log.lunPath,
                destDetails.host,
                sqlVMName || mapping.svm
            )
        ];
        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            command = [
                CreateVolumeCloneScript(
                    'test-fsx',
                    'us-east-1',
                    'wlmdb_sqlsvm_1714090636810',
                    'wlmdb_sqldata_1714098400',
                    '/vol/wlmdb_sqldata_1714098400/sqldata',
                    'wlmdb_sqllog_1714098400',
                    '/vol/wlmdb_sqllog_1714098400/sqllog',
                    'wlmdb_sqlsvm_1714090636810'
                )
            ];
        }

        const clonedVolumes = await callSsmExecution(credentialsId, region, command, destDetails.activeNodeInstaceId);

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
    clonedVolumes: ClonedVolumes
) {
    logger.info('Invoke virtual mount', {
        accountId,
        credentialsId,
        region,
        parentJobId,
        srcDetails,
        destDetails,
        mappings,
        clonedVolumes
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

        try {
            let command = [
                `${INVOKE_VIRTUAL_MOUNT} -DBName ${destDetails.database}  -DataFilePath ${mappings.data.fileName}  -LogFilePath ${mappings.log.fileName}  -DataSerial '${clonedVolumes.data.lunSerialNumber}' -LogSerial '${clonedVolumes.log.lunSerialNumber}'`
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
                destDetails.activeNodeInstaceId,
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

            status = JOBSTATUS.COMPLETED;
            const parsedResp = sqlResponseParsing(resp);

            if (parsedResp.error) {
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, parsedResp.error);
            }
            return parsedResp;
        } catch (e: any) {
            logger.error(e);
            if (retries === 0) {
                status = JOBSTATUS.FAILED;
                errorMsg = e.message || 'Internal Server Error';
                throw createError(e.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
            }
        } finally {
            await updateJobDetails(accountId, credentialsId, region, invokeMountJob.id, {
                error: errorMsg,
                status,
                endTime: Date.now()
            });
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
            createCloneDbScript(destDetails.database, destDetails.instance, [mountPaths.dataPath, mountPaths.logPath])
        ];

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            command = [
                createCloneDbScript('testdb', '.', [
                    'S:\\testdb_clone-Data\\mssql\\data\\testdb.mdf',
                    'L:\\testdb_clone-Log\\mssql\\log\\testdb_log.ldf'
                ])
            ];
        }

        const resp = await callSsmExecution(credentialsId, region, command, destDetails.activeNodeInstaceId);

        // We only get a response in case of error from query
        if (resp) {
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
    tag: string
) {
    logger.info('Create extended properties', {
        accountId
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
        let command = [
            addExtendedProperties(destDetails.database, destDetails.instance, {
                tag,
                cloned_by: 'netapp_wlmdb',
                source: `${srcDetails.resourceName}|${DEFAULT_INSTANCE_NAME}|${srcDetails.database}`,
                createdAt: Date.now(), // to be used for calculating age
                updatedAt: Date.now() // to be used for getting the last update
            })
        ];

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            command = [
                addExtendedProperties('testdb', '.', {
                    tag: 'demo',
                    cloned_by: 'netapp_wlmdb',
                    source: 'resource|instance|testdb'
                })
            ];
        }
        const resp = await callSsmExecution(credentialsId, region, command, destDetails.activeNodeInstaceId);

        // We only get a response in case of error from query
        if (resp) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, resp);
        }

        if (!destDetails.metadata.sandboxCreated) {
            await updateMetadataForSanbox(accountId, credentialsId, region, destDetails.host);
        }

        if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
            // this is used to retreive the newly created user databases in database list for demo using meta data
            const updatedMetadata: Metadata = await updateSandboxDBIntoResourceData(
                accountId,
                srcDetails.host,
                destDetails.database,
                `${srcDetails.resourceName}|${DEFAULT_INSTANCE_NAME}|${srcDetails.database}`,
                Date.now(),
                Date.now(),
                tag,
                srcDetails.metadata
            );

            updateUserDBIntoResourceData(accountId, srcDetails.host, destDetails.database, updatedMetadata);
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
                destDetails.database
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

        const resp = await callSsmExecution(credentialsId, region, command, destDetails.activeNodeInstaceId);

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
    } catch (error) {
        const errorMessage = `Failed to update metadata for sandbox operation, ${accountId}, ${databaseHostId}, ${error}`;
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
    } catch (error) {
        return error;
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
            } catch (error) {
                logger.error('Failed to update meatadata', resourceId);
            }
        })
    );

    return 'Revereted manually updated metadatas';
}

export {
    getSandboxesInfo,
    getSandboxSavings,
    createSandbox,
    updateMetadataForSanboxTesting,
    revertMetadataForSanboxTesting
};
