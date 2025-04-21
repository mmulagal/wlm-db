import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { CloneDetailType } from '../../routes/types/continuous-optimization.types';
import {
    ASSESSMENT_MAPPED_ONTAP_SSM_EXECUTION_TIMEOUT,
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    HttpErrorCodes,
    SANDBOX_EXTENDED_PROPERTY_FLAG_VALUE,
    SandboxLifecycleAction
} from '../../utils/consts';
import getLogger from '../../utils/logger';
import { registerJob, updateJobDetails } from '../database/job-operations';
import {
    runSandboxPreValidations,
    performSandboxDeletion,
    getSandboxSnapshots,
    performLifecycleUpdate
} from '../sandbox-operations';
import {
    CloneDetail,
    ClonedVolumeDetail,
    InstancesResponse,
    Metadata,
    VolumeDBMapEntry
} from '../../utils/common-types';
import { getMappedOntapVolumes } from '../aws/fsx-operations';
import { listResources } from '../../lib/database/db';
import { getActiveSqlNode } from '../workloads/mssql/mssql-operations';
import { getInstanceDetails, getInstanceOntapDetails } from '../database-hosts-operations';
import { callSsmExecution } from '../aws/ssm-operations';
import { DELETE_CLONE_VOLUMES } from '../workloads/mssql/continuous-optimization-scripts';
import { retryWithDelay, sqlResponseParsing } from '../../utils/utils';
// const isDemoFlow = isDemo();

const logger = getLogger();

interface DeleteVolumeResult {
    volumeUuid: string;
    status: 'success' | 'failed';
    jobUuid?: string;
    error?: string;
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
    serverNameWithHostName: string
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
                case 'refresh':
                    logger.info(`Refreshing clone ${cloneDatabaseName} created by netapp_wf.`);
                    await refreshClone(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        cloneDatabaseName,
                        childCloneJobId
                    );
                    break;

                case 'delete':
                    logger.info(`Deleting clone ${cloneDatabaseName} created by netapp_wf.`);
                    await deleteClone(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        cloneDatabaseName,
                        childCloneJobId
                    );
                    break;
                default:
                    logger.error(`Unsupported action: ${action}`);
            }
        } else if (clonedBy.toLowerCase() === 'other') {
            logger.info(`Deleting clone ${cloneDatabaseName} created by other source.`);
            // To Check a cloned volume is mapped to any other database while doing deletion
            const result = await getVolumeDetailsForClonesInInstance(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                cloneDetail
            );
            if (result !== false) {
                await deleteCloneForOthers(
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId,
                    cloneDatabaseName,
                    result,
                    serverNameWithHostName,
                    childCloneJobId
                );
                logger.info(`Successfully handled clone remediation for ${cloneDatabaseName}`);
            } else {
                const errMsg = `The clone ${cloneDatabaseName} volume is associated with multiple databases. Hence it cannot be deleted.`;
                logger.error(errMsg);
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg);
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
    jobId: string
) {
    logger.info(`Deleting clone ${cloneDatabaseName} in database host ${databaseHostId}`, {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDatabaseName
    });

    let deleteJobId = '';
    try {
        const { id } = await registerJob(accountId, credentialsId, region, {
            name: `Delete clone ${cloneDatabaseName}`,
            description: `Delete clone ${cloneDatabaseName} in database host ${databaseHostId}`,
            resourceName: cloneDatabaseName,
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.OPTIMIZATION,
            parentJobId: jobId
        });
        deleteJobId = id;
        const source = { host: databaseHostId, instance: databaseInstanceId, database: cloneDatabaseName };
        const { srcDetails } = await runSandboxPreValidations(accountId, credentialsId, region, source, source);
        logger.info(`Executing delete operation for clone ${cloneDatabaseName}`);
        await performSandboxDeletion(accountId, region, credentialsId, deleteJobId, srcDetails);
        logger.info(`Successfully deleted clone ${cloneDatabaseName}`);

        await updateJobDetails(accountId, deleteJobId, {
            status: JOBSTATUS.COMPLETED,
            endTime: Date.now()
        });
    } catch (error: any) {
        const errorMsg = `Error while deleting clone ${cloneDatabaseName}: ${error.message}`;
        logger.error(errorMsg, error);

        await updateJobDetails(accountId, deleteJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMsg
        });

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
    jobId: string
) {
    logger.info(`Refreshing clone ${cloneDatabaseName} in database host ${databaseHostId}`, {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDatabaseName
    });

    let refreshJobId = '';

    try {
        const { id } = await registerJob(accountId, credentialsId, region, {
            name: `Refresh clone ${cloneDatabaseName}`,
            description: `Refresh clone ${cloneDatabaseName} in database host ${databaseHostId}`,
            resourceName: cloneDatabaseName,
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.OPTIMIZATION,
            parentJobId: jobId
        });
        refreshJobId = id;

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
            refreshJobId,
            srcDetails,
            SandboxLifecycleAction.REFRESH,
            latestSnapshot.name
        );

        logger.info(`Successfully refreshed sandbox ${cloneDatabaseName} to the latest snapshot`);
        await updateJobDetails(accountId, refreshJobId, {
            status: JOBSTATUS.COMPLETED,
            endTime: Date.now()
        });
    } catch (error: any) {
        const errorMsg = `Error while refreshing sandbox ${cloneDatabaseName} in database host ${databaseHostId}: ${error.message}`;
        logger.error(errorMsg, error);
        await updateJobDetails(accountId, refreshJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMsg
        });
        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}

async function deleteCloneForOthers(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneDatabaseName: string,
    params: {
        fsxId: string;
        activeNodeInstanceId: string;
        volumeUuids: string;
        volumeNames: string;
        volumeUuidToNameMap: Map<string, string>;
    },
    serverNameWithHostName: string,
    parentJobId: string
) {
    logger.info(`Deleting clone ${cloneDatabaseName} in database host ${databaseHostId}`, {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDatabaseName,
        params,
        serverNameWithHostName,
        parentJobId
    });

    const { fsxId, activeNodeInstanceId, volumeUuids, volumeNames, volumeUuidToNameMap } = params;
    let deleteChildJobId = '';
    let jobStatus = '';
    let jobError = '';

    try {
        const { id } = await registerJob(accountId, credentialsId, region, {
            type: JOBTYPE.OPTIMIZATION,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: serverNameWithHostName as string,
            name: `Delete cloned volumes ${volumeNames} for ${serverNameWithHostName}`,
            startTime: Date.now(),
            description: `Delete cloned volumes ${volumeNames} for ${serverNameWithHostName}`,
            ...(parentJobId && { parentJobId })
        });
        deleteChildJobId = id;
        const ssmParams = {
            fsxId,
            region,
            volUuids: volumeUuids
        };

        const command = [DELETE_CLONE_VOLUMES(ssmParams)];
        const ssmComment = 'Delete clone volumes';

        const response = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                command,
                activeNodeInstanceId,
                ssmComment,
                accountId,
                false,
                CUSTOM_SSM_EXECUTION_TIMEOUT
            )
        );
        const { volumes } = sqlResponseParsing(response);
        logger.info(`Successfully deleted clone volumes: ${volumes}`);

        const failedVolumes = volumes.filter((v: DeleteVolumeResult) => v.status === 'failed');

        if (failedVolumes.length === 0) {
            jobStatus = JOBSTATUS.COMPLETED;
            await updateJobDetails(accountId, deleteChildJobId, {
                status: jobStatus,
                endTime: Date.now()
            });
        } else {
            // TODO check if any one clone failed means can we update that as warning or failed
            jobStatus = JOBSTATUS.FAILED;
            jobError = `Failed to delete volumes: ${failedVolumes
                .map((v: DeleteVolumeResult) => {
                    // Retrieve the volume name from the map; fallback to UUID if name not found.
                    const volName = volumeUuidToNameMap.get(v.volumeUuid) || v.volumeUuid;
                    return `${volName} (${v.error})`;
                })
                .join(', ')}`;
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, jobError);
        }
    } catch (error: any) {
        const errorMsg = `Error while deleting cloned volumes for ${serverNameWithHostName}: ${error.message}`;
        logger.error(errorMsg, error);
        await updateJobDetails(accountId, deleteChildJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMsg);
    }
}

async function getVolumeDetailsForClonesInInstance(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneDetail: CloneDetail
) {
    logger.info('Fetching volume details for clones in instance', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDetail
    });

    try {
        const { cloneDatabaseName, clonedVolumeDetails } = cloneDetail;

        const [{ metadata, resource_id: resourceId }] = await listResources(
            accountId,
            databaseHostId,
            credentialsId,
            region
        );
        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;

        const { activeNodeInstanceId = '' } = await getActiveSqlNode(
            credentialsId,
            region,
            node1InstanceId,
            node2InstanceId,
            resourceId,
            accountId
        );
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
                true,
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
            const { volumeDBMap } = volumeMapping;

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
            if (result === false) {
                return false;
            }
            return {
                volumeUuids: result.volumeUuids,
                volumeNames: result.volumeNames,
                volumeUuidToNameMap: result.volumeUuidToNameMap,
                fsxId,
                activeNodeInstanceId
            };
        }

        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `No metadata found for the database host ${databaseHostId} and instance ${databaseInstanceId}`
        );
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
): { volumeUuids: string; volumeNames: string; volumeUuidToNameMap: Map<string, string> } | false {
    if (!cloneDatabaseName || !clonedVolumeDetails) {
        return false;
    }

    let volumeUuids: string = '';
    let volumeNames: string = '';
    const volumeUuidToNameMap = new Map<string, string>();

    for (const { cloneVolumeUuid, cloneVolumeName } of clonedVolumeDetails) {
        if (!cloneVolumeUuid) {
            return false;
        }
        const dbNames = volumeUUIDToDatabaseNameMap.get(cloneVolumeUuid);
        if (!dbNames || dbNames.length !== 1 || dbNames[0] !== cloneDatabaseName) {
            return false;
        }
        volumeUuids += cloneVolumeUuid;
        volumeNames += cloneVolumeName;
        volumeUuidToNameMap.set(cloneVolumeUuid, cloneVolumeName as string);
    }
    return { volumeUuids, volumeNames, volumeUuidToNameMap };
}

export { handleCloneRemediation, deleteClone, refreshClone };
