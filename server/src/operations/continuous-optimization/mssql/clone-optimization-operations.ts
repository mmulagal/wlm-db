import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import throat from 'throat';
import createError from 'http-errors';
import {
    BulkOptimizeCloneInHostRequestBodyType,
    CloneDetailType
} from '../../../routes/types/mssql-continuous-optimisation.types';
import {
    ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
    AuditStatus,
    CLONE_ACTION,
    HttpErrorCodes,
    SANDBOX_EXTENDED_PROPERTY_FLAG_VALUE,
    SANDBOX_LIFECYCLE_REFRESH,
    SSM_COMMAND_CACHE_TYPE
} from '../../../utils/consts';
import getLogger from '../../../utils/logger';
import {
    runSandboxPreValidations,
    performSandboxDeletion,
    getSandboxSnapshots,
    performLifecycleUpdate
} from '../../sandbox-operations';
import {
    CloneAssessment,
    CloneDetail,
    ClonedVolumeDetail,
    InstancesResponse,
    MappedVolumeResponseForClone,
    Metadata,
    VolumeDBMapEntry
} from '../../../utils/common-types';
import { getMappedOntapVolumes } from '../../aws/fsx-operations';
import { listResources } from '../../../lib/database/db';
import { getActiveSqlNode } from '../../workloads/mssql/mssql-operations';
import { getInstanceDetails, getInstanceOntapDetails } from '../../database-hosts-operations';
import { extractErrorMessage, getServerNameWithHostname, IS_DEMO_FLOW } from '../../../utils/utils';
import { updateAllOptimizedClonesDemoFlow } from '../../demo-operations';
import { resetCache } from '../../../utils/cache';
import { AssessmentCategories } from '../../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails, updateParentJobStatus } from '../../database/job-operations';
import { updateLongRunningAuditGroup } from '../../cloud-manager/audit-operations';
import { paginateListInstanceConfigData } from '../../database/instance-config-operations';
import { triggerMssqlAssessmentAfterOptimization } from './assessment-operations';

const logger = getLogger();

async function optimizeClone(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    clone: CloneDetailType,
    configData: CloneAssessment,
    sqlServerName: string,
    instanceName: string,
    parentJobId: string,
    volumeMapping?: MappedVolumeResponseForClone
) {
    // 2nd Level Job having master parent job id
    logger.info('Optimizing clone', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        clone: clone?.cloneDatabaseName,
        cloneCount: configData?.oldClones,
        sqlServerName,
        instanceName,
        volumeMapping,
        parentJobId
    });

    let childCloneJobId = '';

    const { cloneDatabaseName, clonedBy } = clone;
    try {
        const { oldCloneDetails } = configData as unknown as CloneAssessment;
        logger.debug(`Clones data ${JSON.stringify(oldCloneDetails)}`);
        const name = clone.clonedBy === SANDBOX_EXTENDED_PROPERTY_FLAG_VALUE ? 'sandbox' : 'clone';
        const operation = clone.action[0].toUpperCase() + clone.action.slice(1);

        const serverNameWithHostName = getServerNameWithHostname(sqlServerName, instanceName, cloneDatabaseName);
        const { id } = await registerJob(accountId, credentialsId, region, {
            type: JOBTYPE.WELL_ARCHITECTED,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: serverNameWithHostName as string,
            name: `${operation} ${name} for ${serverNameWithHostName}`,
            startTime: Date.now(),
            description: `${operation} ${name} for ${serverNameWithHostName}`,
            parentJobId
        });
        childCloneJobId = id;

        const matchingClone: CloneDetail | undefined = oldCloneDetails?.find(
            ({ cloneDatabaseName: databaseName, clonedBy: owner }) =>
                databaseName === cloneDatabaseName && owner === clonedBy?.toLowerCase()
        );

        if (!matchingClone) {
            throw createError(HttpErrorCodes.NOT_FOUND, `Clone ${cloneDatabaseName} not found for ${clonedBy}`);
        }
        await handleCloneRemediation(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            childCloneJobId,
            clone,
            matchingClone,
            serverNameWithHostName,
            volumeMapping
        );
        // can update once the job is success for this newly created child job one
        await updateJobDetails(accountId, childCloneJobId, {
            status: JOBSTATUS.COMPLETED,
            endTime: Date.now()
        });
    } catch (err) {
        const errorMessage = extractErrorMessage(err);
        logger.error(`Error while fixing clone ${clone.cloneDatabaseName}`, {
            accountId,
            databaseHostId,
            databaseInstanceId,
            error: err
        });
        await updateJobDetails(accountId, childCloneJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function fetchInstanceConfigurationAndVolumeMapping(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceId: string,
    clones: CloneDetailType[]
): Promise<{
    configData: CloneAssessment;
    instanceName: string;
    sqlServerName: string;
    serverNameWithHostName: string;
    volumeMapping?: MappedVolumeResponseForClone;
}> {
    // Fetch configuration data for the databaseHostId and databaseInstanceId
    const {
        items: [persistedConfigurationData]
    } = await paginateListInstanceConfigData({
        accountId,
        region,
        credentialsId,
        resourceId: databaseHostId,
        databaseInstanceId: instanceId,
        configDataType: AssessmentCategories.CLONE,
        includeDatabaseInstance: true,
        includeResource: true
    });

    const {
        config_data: configData,
        database_instances: { database_instance_name: instanceName = '' } = {},
        resource: { resource_name: sqlServerName = '' } = {}
    } = persistedConfigurationData || {};

    if (!instanceName || !sqlServerName) {
        logger.error('Instance name or SQL server name is missing');
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Instance name or SQL server name is missing');
    }

    const serverNameWithHostName = getServerNameWithHostname(sqlServerName, instanceName);

    // Check if any clone requires volume mapping
    const requiresVolumeMapping = clones.some(clone => clone.action === 'delete' && clone.clonedBy === 'other');

    let volumeMapping: MappedVolumeResponseForClone | undefined;
    if (requiresVolumeMapping) {
        // Fetch the mapped volume details for the instance
        volumeMapping = await getMappedVolumeDetailForInstance(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceId
        );
    }

    return {
        configData: configData as unknown as CloneAssessment,
        instanceName,
        sqlServerName,
        serverNameWithHostName,
        volumeMapping
    };
}

// Flattens hostsToOptimize to extract SQL Server instances and their metadata.
function extractInstancesToOptimize(hostsToOptimize: BulkOptimizeCloneInHostRequestBodyType[]) {
    return hostsToOptimize.flatMap(({ databaseHosts }) =>
        databaseHosts.flatMap(({ sqlServerInstances, region, credentialsId, id: databaseHostId }) =>
            sqlServerInstances.map(({ instanceId, clones }) => ({
                instanceId,
                clones,
                region,
                credentialsId,
                databaseHostId
            }))
        )
    );
}

async function handleBulkCloneOptimization(
    accountId: string,
    hostsToOptimize: BulkOptimizeCloneInHostRequestBodyType[],
    parentJobId: string
) {
    logger.info(
        `Handle bulk optimizing clone: ${accountId}, hostsToOptimize: ${hostsToOptimize?.length}, parentJobId: ${parentJobId}`
    );

    const flattenedInstances = extractInstancesToOptimize(hostsToOptimize);
    // Process all instances and their clones with a concurrency limit of 3
    await Promise.all(
        flattenedInstances.map(
            throat(3, async instance => {
                const { instanceId, clones, region, credentialsId, databaseHostId } = instance;
                if (isEmpty(clones)) {
                    logger.warn(`No clones found for instance ${instanceId} in databaseHost ${databaseHostId}.`);
                    return;
                }

                try {
                    // Fetch configuration data once for the databaseHostId and databaseInstanceId
                    const { configData, instanceName, sqlServerName, serverNameWithHostName, volumeMapping } =
                        await fetchInstanceConfigurationAndVolumeMapping(
                            accountId,
                            credentialsId,
                            region,
                            databaseHostId,
                            instanceId,
                            clones
                        );

                    await Promise.all(
                        clones?.map(
                            throat(3, async clone => {
                                try {
                                    await optimizeClone(
                                        accountId,
                                        credentialsId,
                                        region,
                                        databaseHostId,
                                        instanceId,
                                        clone,
                                        configData as unknown as CloneAssessment,
                                        sqlServerName,
                                        instanceName,
                                        parentJobId,
                                        volumeMapping
                                    );
                                    logger.info(
                                        `Successfully optimized clone ${clone.cloneDatabaseName} for instance ${instanceId} in databaseHost ${databaseHostId}.`
                                    );
                                } catch (error: any) {
                                    logger.error(
                                        `Error occurred while optimizing clone ${clone.cloneDatabaseName} for host ${databaseHostId}, instance ${instanceId}. Error: ${error}`
                                    );
                                }
                            })
                        )
                    );
                    if (IS_DEMO_FLOW) {
                        await updateAllOptimizedClonesDemoFlow(
                            accountId,
                            credentialsId,
                            databaseHostId,
                            instanceId,
                            configData,
                            clones
                        );
                    }
                    // once the optimize done for the specific instance id in a host, Run the assessment for that
                    resetCache(SSM_COMMAND_CACHE_TYPE);
                    await triggerMssqlAssessmentAfterOptimization(
                        credentialsId,
                        region,
                        accountId,
                        databaseHostId,
                        serverNameWithHostName,
                        parentJobId,
                        { id: instanceId },
                        AssessmentCategories.CLONE
                    );
                } catch (err: any) {
                    logger.error(
                        `Error occurred while optimizing clone configuration for account ${accountId}. Error: ${err}`
                    );
                }
            })
        )
    );
    const status = await updateParentJobStatus(accountId, parentJobId);
    if (status === JOBSTATUS.COMPLETED) {
        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } else if (status === JOBSTATUS.FAILED) {
        updateLongRunningAuditGroup(AuditStatus.FAILED, `Error occurred while fixing clone for account ${accountId}`);
    }
}

async function handleCloneRemediation(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    childCloneJobId: string,
    clone: CloneDetailType,
    cloneDetail: CloneDetail,
    serverNameWithHostName: string,
    volumeMapping?: MappedVolumeResponseForClone
) {
    logger.info('Handling clone remediation', {
        accountId,
        credentialsId,
        region,
        childCloneJobId,
        clone,
        cloneDetail,
        serverNameWithHostName
    });

    // 3rd level job for specific actions for both delete and refresh in case of netapp_wf and others will be created in each action functions
    const { cloneDatabaseName, action, clonedBy } = clone;

    try {
        if (clonedBy.toLowerCase() === SANDBOX_EXTENDED_PROPERTY_FLAG_VALUE) {
            switch (action) {
                case CLONE_ACTION.REFRESH:
                    logger.info(`Refreshing clone ${cloneDatabaseName} created by netapp_wf.`);
                    await refreshClone(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        cloneDatabaseName,
                        childCloneJobId,
                        true
                    );
                    break;

                case CLONE_ACTION.DELETE:
                    logger.info(`Deleting clone ${cloneDatabaseName} created by netapp_wf.`);
                    await deleteClone(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        cloneDatabaseName,
                        serverNameWithHostName,
                        childCloneJobId,
                        true,
                        false
                    );
                    break;
                default:
                    logger.error(`Unsupported action: ${action}`);
            }
        } else if (clonedBy.toLowerCase() === 'other') {
            if (action === CLONE_ACTION.DELETE) {
                logger.info(`Deleting clone ${cloneDatabaseName} created by other source.`);
                let canDelete = true;
                // To Check a cloned volume is mapped to any other database while doing deletion.. Not for Demo flow
                if (!IS_DEMO_FLOW) {
                    const result = await extractVolumeDetailsForClonesInInstance(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        cloneDetail,
                        volumeMapping as MappedVolumeResponseForClone
                    );
                    canDelete = !!result;
                }
                if (canDelete) {
                    await deleteClone(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        cloneDatabaseName,
                        serverNameWithHostName,
                        childCloneJobId,
                        true,
                        true
                    );
                    logger.debug(`Successfully handled clone remediation for ${cloneDatabaseName}`);
                } else {
                    const errMsg = `The clone ${cloneDatabaseName} volume is associated with multiple databases. Hence it cannot be deleted.`;
                    logger.error(errMsg);
                    throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg);
                }
            } else {
                throw createError(HttpErrorCodes.BAD_REQUEST, `Unsupported action: ${action}`);
            }
        }
    } catch (error: any) {
        logger.error(`Error while handling clone remediation for ${cloneDatabaseName}`, {
            accountId,
            databaseHostId,
            databaseInstanceId,
            error
        });
        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, extractErrorMessage(error));
    }
}

async function deleteClone(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneDatabaseName: string,
    serverNameWithHostName: string,
    parentJobId: string,
    isSandboxOptimizeFlow: boolean = false,
    isOtherOptimizeFlow: boolean = false
) {
    logger.info(`Deleting clone ${cloneDatabaseName} in database host ${databaseHostId}`, {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDatabaseName,
        serverNameWithHostName,
        parentJobId,
        isSandboxOptimizeFlow,
        isOtherOptimizeFlow
    });

    try {
        const source = { host: databaseHostId, instance: databaseInstanceId, database: cloneDatabaseName };
        const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, source, source);
        logger.debug(`Executing delete operation for clone ${cloneDatabaseName}`);
        await performSandboxDeletion(
            accountId,
            region,
            credentialsId,
            parentJobId,
            srcDetails,
            isOtherOptimizeFlow,
            isSandboxOptimizeFlow
        );
        logger.debug(`Successfully deleted clone ${cloneDatabaseName}`);
    } catch (error: any) {
        const errorMsg = `Error while deleting clone ${cloneDatabaseName}: ${extractErrorMessage(error)}`;
        logger.error(errorMsg, error);

        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}

async function refreshClone(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneDatabaseName: string,
    jobId: string,
    isSandboxOptimizeFlow: boolean = false
) {
    logger.info(`Refreshing clone ${cloneDatabaseName} in database host ${databaseHostId}`, {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDatabaseName
    });

    try {
        const source = { host: databaseHostId, instance: databaseInstanceId, database: cloneDatabaseName };
        const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, source, source);
        // Fetch the latest snapshot for the sandbox
        const snapshots = await getSandboxSnapshots(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            cloneDatabaseName
        );

        if (!snapshots || snapshots.length === 0) {
            throw createError(
                HttpErrorCodes.NOT_FOUND,
                `No snapshots found for sandbox ${cloneDatabaseName} in database host ${databaseHostId}`
            );
        }
        const latestSnapshot = snapshots.reduce(
            (latest: { name: string; created: number }, current: { name: string; created: number }) => {
                const currentCreated = new Date(current.created).getTime();
                return currentCreated > latest.created ? { ...current, created: currentCreated } : latest;
            },
            { name: '', created: 0 }
        );

        logger.info(`Latest snapshot for sandbox ${cloneDatabaseName}: ${latestSnapshot.name}`, {
            snapshot: latestSnapshot
        });
        await performLifecycleUpdate(
            accountId,
            credentialsId,
            region,
            jobId,
            srcDetails,
            SANDBOX_LIFECYCLE_REFRESH,
            latestSnapshot.name,
            isSandboxOptimizeFlow
        );

        logger.debug(`Successfully refreshed sandbox ${cloneDatabaseName} to the latest snapshot`);
    } catch (error: any) {
        const errorMsg = `Error while refreshing sandbox ${cloneDatabaseName}: ${extractErrorMessage(error)}`;
        logger.error(errorMsg, { accountId, databaseHostId, databaseInstanceId, error });
        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}

async function extractVolumeDetailsForClonesInInstance(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneDetail: CloneDetail,
    cloneVolumeMapping: MappedVolumeResponseForClone
) {
    logger.info('Extracting volume details for clones in instance', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDetail
    });

    try {
        const { cloneDatabaseName, clonedVolumeDetails } = cloneDetail;
        const {
            volumeMapping: { volumeDBMap },
            fsxId,
            activeNodeInstanceId
        } = cloneVolumeMapping;

        // Check if volumeDBMap is empty or undefined
        if (!volumeDBMap || volumeDBMap.length === 0) {
            const errorMsg = `Volume details for the ${cloneDatabaseName} is empty for database instance ${databaseInstanceId}`;
            logger.error(errorMsg);
            throw createError(HttpErrorCodes.NOT_FOUND, errorMsg);
        }

        // Map to store the volume uuid associated to the database names
        const volumeUUIDToDatabaseNameMap = new Map<string, string[]>();
        volumeDBMap?.forEach((entry: VolumeDBMapEntry) => {
            const { databaseName, ontapVolumeuuid } = entry;
            if (!volumeUUIDToDatabaseNameMap.has(ontapVolumeuuid)) {
                volumeUUIDToDatabaseNameMap.set(ontapVolumeuuid, []);
            }
            volumeUUIDToDatabaseNameMap.get(ontapVolumeuuid)?.push(databaseName);
        });

        const result = validateAndExtractClonedVolumeUuids(
            cloneDatabaseName,
            clonedVolumeDetails,
            volumeUUIDToDatabaseNameMap
        );
        if (!result) {
            return null;
        }
        return {
            volumeUuids: result.volumeUuids, // May need this infos later on
            volumeNames: result.volumeNames,
            volumeUuidToNameMap: result.volumeUuidToNameMap,
            fsxId,
            activeNodeInstanceId
        };
    } catch (error: any) {
        const errorMsg = `Error while fetching volume details for clones in instance ${databaseInstanceId}: ${error.message}`;
        logger.error(errorMsg, error);
        throw createError(error?.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}

function validateAndExtractClonedVolumeUuids(
    cloneDatabaseName: string | undefined,
    clonedVolumeDetails: ClonedVolumeDetail[] | undefined,
    volumeUUIDToDatabaseNameMap: Map<string, string[]>
): { volumeUuids: string[]; volumeNames: string; volumeUuidToNameMap: Map<string, string> } | null {
    if (!cloneDatabaseName || !clonedVolumeDetails) {
        return null;
    }

    const volumeUuids: string[] = [];
    const volumeNames: string[] = [];
    const volumeUuidToNameMap = new Map<string, string>();

    for (const { cloneVolumeUuid, cloneVolumeName } of clonedVolumeDetails) {
        if (!cloneVolumeUuid) {
            return null;
        }
        const dbNames = volumeUUIDToDatabaseNameMap.get(cloneVolumeUuid);
        if (!dbNames || dbNames.length !== 1 || dbNames[0] !== cloneDatabaseName) {
            return null;
        }
        volumeUuids.push(cloneVolumeUuid);
        volumeNames.push(cloneVolumeName || '');
        volumeUuidToNameMap.set(cloneVolumeUuid, cloneVolumeName as string);
    }
    return {
        volumeUuids,
        volumeNames: volumeNames.join(','),
        volumeUuidToNameMap
    };
}

async function getMappedVolumeDetailForInstance(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Fetching mapped volume details for instance', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    });

    try {
        const [{ metadata, resource_id: resourceId }] = await listResources({
            accountId,
            resourceId: databaseHostId,
            credentialIds: credentialsId,
            region
        });
        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

        const { activeNodeInstanceId = '' } = await getActiveSqlNode(credentialsId, region, {
            node1InstanceId,
            node2InstanceId,
            resourceId,
            accountId
        });
        if (metadata && activeNodeInstanceId) {
            const { newDatabaseInstanceDetails } = await getInstanceDetails(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId
            );
            const instanceOntapDetails = await getInstanceOntapDetails(
                newDatabaseInstanceDetails,
                credentialsId,
                region
            );
            const { database_instance_name: instanceName, sqlAuthEnabled } = newDatabaseInstanceDetails;

            const { fsxId, svmUuid } = instanceOntapDetails[instanceName];
            const getInstanceVolumeMapping = getMappedOntapVolumes(
                credentialsId,
                region,
                fsxId,
                false,
                activeNodeInstanceId,
                [instanceName],
                sqlAuthEnabled,
                false,
                accountId,
                ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
                svmUuid,
                instanceOntapDetails,
                'clone.parent_volume.name,clone.is_flexclone,create_time'
            ) as Promise<InstancesResponse>;

            const instanceVolumeMapping = await getInstanceVolumeMapping;
            const volumeMapping = instanceVolumeMapping[instanceName];
            logger.debug('Instance Volume Mapping', volumeMapping);
            if (isEmpty(volumeMapping)) {
                const errorMessage = `No ONTAP volumes found for the instance ${instanceName}.`;
                logger.error(errorMessage);
                throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
            }
            return { volumeMapping, fsxId, activeNodeInstanceId };
        }
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `No metadata found for the database host ${databaseHostId} and instance ${databaseInstanceId}`
        );
    } catch (error: any) {
        const errorMsg = `Error while fetching mapped volume details for instance ${databaseInstanceId}: ${error.message}`;
        logger.error(errorMsg, error);
        throw createError(error?.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}

export { handleCloneRemediation, handleBulkCloneOptimization, optimizeClone };
