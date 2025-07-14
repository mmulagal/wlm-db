import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { CloneDetailType } from '../../../routes/types/continuous-optimization.types';
import {
    ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
    CLONE_ACTION,
    HttpErrorCodes,
    SANDBOX_EXTENDED_PROPERTY_FLAG_VALUE,
    SandboxLifecycleAction
} from '../../../utils/consts';
import getLogger from '../../../utils/logger';
import {
    runSandboxPreValidations,
    performSandboxDeletion,
    getSandboxSnapshots,
    performLifecycleUpdate
} from '../../sandbox-operations';
import {
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
import { isDemo } from '../../../utils/utils';

const isDemoFlow = isDemo();
const logger = getLogger();

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
                if (!isDemoFlow) {
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
        const errMsg = `Error while handling clone remediation: ${error}`;
        logger.error(errMsg);
        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg);
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
        const errorMsg = `Error while deleting clone ${cloneDatabaseName}: ${error.message}`;
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
            (latest: { name: string; created: number }, current: { name: string; created: string }) => {
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
            SandboxLifecycleAction.REFRESH,
            latestSnapshot.name,
            isSandboxOptimizeFlow
        );

        logger.debug(`Successfully refreshed sandbox ${cloneDatabaseName} to the latest snapshot`);
    } catch (error: any) {
        const errorMsg = `Error while refreshing sandbox ${cloneDatabaseName} in database host ${databaseHostId}: ${error.message}`;
        logger.error(errorMsg, error);
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
        const [{ metadata, resource_id: resourceId }] = await listResources(
            accountId,
            databaseHostId,
            credentialsId,
            region
        );
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

export { handleCloneRemediation, getMappedVolumeDetailForInstance };
