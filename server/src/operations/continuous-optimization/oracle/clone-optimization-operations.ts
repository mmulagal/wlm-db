import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import throat from 'throat';
import createError from 'http-errors';

import { CLONE_ACTION, HttpErrorCodes, OTHER_CLONE, SSM_COMMAND_CACHE_TYPE } from '../../../utils/consts';
import getLogger from '../../../utils/logger';
import { CloneAssessment, CloneDetail, ClonedVolumeDetail, Metadata } from '../../../utils/common-types';
import { IS_DEMO_FLOW, extractErrorMessage } from '../../../utils/utils';
import { resetCache } from '../../../utils/cache';
import { AssessmentCategoriesOracle } from '../../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { paginateListInstanceConfigData } from '../../database/instance-config-operations';
import { listResources } from '../../../lib/database/db';
import { callSsmExecution } from '../../aws/ssm-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import {
    buildOntapProxyBase,
    collectOntapRecordsBatched,
    deleteOntapVolumeByUuid,
    getOntapJobStatusForBase,
    OntapVolumeRecord,
    ProxyOperationBaseOpts
} from '../../../lib/ontap/ontap-gateway';
import { callProxyForwarder } from '../../../lib/cloud-manager/proxy-forwarder';
import {
    OracleMappedOntapVolumeRecord,
    OracleMappedOntapVolumesResponse,
    OracleVolumeRecord
} from '../../workloads/oracle/common-types';
import {
    OracleCloneActionType,
    CloneOptimizePerHostRequestBodyType
} from '../../../routes/types/oracle-continuous-optimization.types';
import { isPdbGroupedVolumes } from '../assessment-utils';
import { assertVolumesHaveNoSnapmirror } from '../ontap-operations';
import { updateAllOptimizedClonesDemoFlow } from '../../demo-operations';
import { triggerOracleAssessmentAfterOptimization } from './assessment-operations';
import { buildCloneCleanupScript } from './ssm-scripts/clone-cleanup-scripts';

const logger = getLogger();

const JUNCTION_PATH_FIELDS = 'nas.path,name';

interface OracleClonePreValidationResult {
    fsxId: string;
    activeNodeInstanceId: string;
    protocol: string;
}

interface CloneHostsToOptimize {
    configurationName: string;
    databaseHosts: CloneOptimizePerHostRequestBodyType[];
}

function extractInstancesToOptimize(hostsToOptimize: CloneHostsToOptimize[]) {
    return hostsToOptimize.flatMap(({ databaseHosts }) =>
        databaseHosts.flatMap(({ oracleInstances, region, credentialsId, id: databaseHostId }) =>
            oracleInstances.map(({ instanceId, clones }) => ({
                instanceId,
                clones,
                region,
                credentialsId,
                databaseHostId
            }))
        )
    );
}

async function fetchInstanceConfigurationAndVolumeMapping(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceId: string,
    clones: readonly OracleCloneActionType[]
): Promise<{
    configData: CloneAssessment;
    instanceName: string;
    resourceName: string;
    mappedVolumesConfigData?: Record<string, OracleMappedOntapVolumesResponse>;
}> {
    const hasDeleteOtherClone = clones.some(
        clone => clone.action === CLONE_ACTION.DELETE && clone.clonedBy?.toLowerCase() === OTHER_CLONE
    );

    const configDataPromises = [
        paginateListInstanceConfigData({
            accountId,
            region,
            credentialsId,
            resourceId: databaseHostId,
            databaseInstanceId: instanceId,
            configDataType: AssessmentCategoriesOracle.CLONE,
            includeDatabaseInstance: true,
            includeResource: true
        }),
        ...(hasDeleteOtherClone
            ? [
                  paginateListInstanceConfigData({
                      accountId,
                      region,
                      credentialsId,
                      resourceId: databaseHostId,
                      databaseInstanceId: instanceId,
                      configDataType: AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES
                  })
              ]
            : [])
    ];

    const [cloneConfigResult, mappedVolumesResult] = await Promise.all(configDataPromises);

    const [persistedConfigurationData] = cloneConfigResult.items;

    if (isEmpty(persistedConfigurationData)) {
        const errorMessage = `No clone assessment config data found for instance ${instanceId} in host ${databaseHostId}`;
        logger.warn(errorMessage, { accountId, databaseHostId, instanceId });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const {
        config_data: configData,
        database_instances: { database_instance_name: instanceName = '' } = {},
        resource: { resource_name: resourceName = '' } = {}
    } = persistedConfigurationData || {};

    if (!instanceName || !resourceName) {
        const errorMessage = `Instance name or resource name is missing for instance ${instanceId}`;
        logger.error(errorMessage, { accountId, databaseHostId, instanceId });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    let mappedVolumesConfigData: Record<string, OracleMappedOntapVolumesResponse> | undefined;
    if (mappedVolumesResult) {
        const [mappedVolumesConfig] = mappedVolumesResult.items;
        if (!isEmpty(mappedVolumesConfig)) {
            mappedVolumesConfigData = mappedVolumesConfig.config_data as unknown as Record<
                string,
                OracleMappedOntapVolumesResponse
            >;
        }
    }

    return {
        configData: configData as unknown as CloneAssessment,
        instanceName,
        resourceName,
        mappedVolumesConfigData
    };
}

function buildVolumeMaps(
    mappedVolumesConfigData: Record<string, OracleMappedOntapVolumesResponse>,
    fsxId: string
): { volumeUUIDToDatabaseNameMap: Map<string, string[]>; volumeNameToUUIDMap: Map<string, string> } {
    const volumeUUIDToDatabaseNameMap = new Map<string, string[]>();
    const volumeNameToUUIDMap = new Map<string, string>();
    const fsxConfig = mappedVolumesConfigData[fsxId];

    if (!fsxConfig?.volumeMappings?.[0]) {
        return { volumeUUIDToDatabaseNameMap, volumeNameToUUIDMap };
    }

    const sidMapping = fsxConfig.volumeMappings[0];

    const addVolume = (sidName: string, { volumeId, volumeName }: OracleVolumeRecord) => {
        if (!volumeId) {
            return;
        }
        const existing = volumeUUIDToDatabaseNameMap.get(volumeId) || [];
        if (!existing.includes(sidName)) {
            existing.push(sidName);
        }
        volumeUUIDToDatabaseNameMap.set(volumeId, existing);
        if (volumeName) {
            volumeNameToUUIDMap.set(volumeName, volumeId);
        }
    };

    Object.entries(sidMapping).forEach(([sidName, volumeRecord]: [string, OracleMappedOntapVolumeRecord]) => {
        const { ontapVolumes, isCDB } = volumeRecord;
        if (!ontapVolumes) {
            return;
        }

        const isGroupedByPdb = isPdbGroupedVolumes(!!isCDB, ontapVolumes);

        if (isGroupedByPdb) {
            const pdbGroupedVolumes = ontapVolumes as Record<string, Record<string, OracleVolumeRecord[]>>;
            Object.values(pdbGroupedVolumes).forEach(fileTypeMap => {
                Object.values(fileTypeMap).forEach(volumes => {
                    volumes.forEach(vol => addVolume(sidName, vol));
                });
            });
        } else {
            const flatVolumes = ontapVolumes as Record<string, OracleVolumeRecord[]>;
            Object.values(flatVolumes).forEach(volumes => {
                volumes.forEach(vol => addVolume(sidName, vol));
            });
        }
    });

    return { volumeUUIDToDatabaseNameMap, volumeNameToUUIDMap };
}

function validateAndExtractClonedVolumeUuids(
    cloneDatabaseName: string | undefined,
    clonedVolumeDetails: ClonedVolumeDetail[] | undefined,
    volumeUUIDToDatabaseNameMap: Map<string, string[]>,
    volumeNameToUUIDMap: Map<string, string>
): { volumeUuids: string[]; volumeNames: string; isValid: true } | { isValid: false; reason: string } {
    if (!cloneDatabaseName || !clonedVolumeDetails) {
        const errorMessage = 'Clone database name or volume details missing for clone validation';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const volumeUuids: string[] = [];
    const volumeNames: string[] = [];

    for (const { cloneVolumeUuid, cloneVolumeName, sourceVolumeName } of clonedVolumeDetails) {
        if (!cloneVolumeUuid) {
            const errorMessage = `Clone volume UUID is missing for clone ${cloneDatabaseName}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
        }
        if (!sourceVolumeName) {
            const errorMessage = `Source volume name is missing for clone ${cloneDatabaseName}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
        }
        const parentVolumeUuid = volumeNameToUUIDMap.get(sourceVolumeName);
        if (!parentVolumeUuid) {
            return { isValid: false, reason: `Parent volume mapping not found for source volume ${sourceVolumeName}` };
        }
        const dbNames = volumeUUIDToDatabaseNameMap.get(parentVolumeUuid);
        if (!dbNames || dbNames.length !== 1) {
            return {
                isValid: false,
                reason: `Parent volume ${sourceVolumeName} is associated with ${dbNames?.length ?? 0} databases`
            };
        }
        volumeUuids.push(cloneVolumeUuid);
        volumeNames.push(cloneVolumeName || '');
    }

    return {
        volumeUuids,
        volumeNames: volumeNames.join(','),
        isValid: true
    };
}

function extractVolumeDetailsForClonesInInstance(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneDetail: CloneDetail,
    mappedVolumesConfigData: Record<string, OracleMappedOntapVolumesResponse>
): { volumeUuids: string[]; volumeNames: string } {
    logger.info('Extracting volume details for clones in instance', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDatabaseName: cloneDetail.cloneDatabaseName
    });

    const { cloneDatabaseName, clonedVolumeDetails } = cloneDetail;

    const fsxId = Object.keys(mappedVolumesConfigData)[0];
    if (!fsxId) {
        const errorMessage = `No FSx ID found in mapped volumes config for instance ${databaseInstanceId}`;
        logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const { volumeUUIDToDatabaseNameMap, volumeNameToUUIDMap } = buildVolumeMaps(mappedVolumesConfigData, fsxId);

    const result = validateAndExtractClonedVolumeUuids(
        cloneDatabaseName,
        clonedVolumeDetails,
        volumeUUIDToDatabaseNameMap,
        volumeNameToUUIDMap
    );

    if (!result.isValid) {
        const errorMessage = `Cannot delete clone ${cloneDatabaseName}: ${result.reason}`;
        logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    return { volumeUuids: result.volumeUuids, volumeNames: result.volumeNames };
}

async function runOracleClonePreValidations(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
): Promise<OracleClonePreValidationResult> {
    logger.info('Running Oracle clone pre-validations', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    });

    const resources = await listResources({ accountId, resourceId: databaseHostId });
    if (isEmpty(resources)) {
        const errorMessage = `No resource found for database host ${databaseHostId} in account ${accountId}`;
        logger.error(errorMessage, { accountId, databaseHostId });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const [{ metadata }] = resources;
    const { node1InstanceId } = metadata as unknown as Metadata;

    if (!node1InstanceId) {
        const errorMessage = `No EC2 instance ID found for database host ${databaseHostId}`;
        logger.error(errorMessage, { accountId, databaseHostId });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const {
        items: [mappedVolumesConfig]
    } = await paginateListInstanceConfigData({
        accountId,
        region,
        credentialsId,
        resourceId: databaseHostId,
        databaseInstanceId,
        configDataType: AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES
    });

    if (isEmpty(mappedVolumesConfig)) {
        const errorMessage = `No mapped volumes config found for instance ${databaseInstanceId} in host ${databaseHostId}`;
        logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const { config_data: configData } = mappedVolumesConfig;
    const mappedVolumesData = configData as unknown as Record<string, OracleMappedOntapVolumesResponse>;
    const fsxId = Object.keys(mappedVolumesData)[0];

    if (!fsxId) {
        const errorMessage = `No FSx ID found in mapped volumes for instance ${databaseInstanceId}`;
        logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const fsxConfig = mappedVolumesData[fsxId];
    const protocol = fsxConfig?.protocol || '';

    return {
        fsxId,
        activeNodeInstanceId: node1InstanceId,
        protocol
    };
}

/**
 * Resolves the NFS junction path for each clone volume UUID. Propagates a lookup failure to the
 * caller so a transient read failure aborts clone deletion instead of proceeding to unmount/delete
 * volumes with no resolved junction path. A volume that the lookup itself returned with no
 * `nas.path` is simply omitted from the returned map; that should only skip that volume's unmount,
 * not block deletion.
 */
async function fetchCloneJunctionPaths(
    base: ProxyOperationBaseOpts,
    volumeUuids: string[]
): Promise<Record<string, string>> {
    if (volumeUuids.length === 0) {
        return {};
    }

    logger.info('Fetching clone junction paths', { targetId: base.targetId, volumeUuids });

    const records = await collectOntapRecordsBatched<OntapVolumeRecord>(
        base,
        'api/storage/volumes',
        'uuid',
        volumeUuids,
        {
            fields: JUNCTION_PATH_FIELDS
        }
    );

    const junctionPathsByUuid: Record<string, string> = {};
    records.forEach(record => {
        const nasPath = record.nas?.path;
        if (nasPath) {
            junctionPathsByUuid[record.uuid] = nasPath;
        } else {
            logger.warn('No junction path found for clone volume', {
                targetId: base.targetId,
                volumeUuid: record.uuid
            });
        }
    });

    logger.info('Completed fetching clone junction paths', {
        targetId: base.targetId,
        volumeUuids,
        junctionPathsByUuid
    });

    return junctionPathsByUuid;
}

async function deleteClone(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    cloneDatabaseName: string,
    clonedVolumeDetails: ClonedVolumeDetail[] | undefined,
    parentJobId: string,
    preValidatedVolumeUuids?: string[]
) {
    logger.info('Deleting Oracle clone', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDatabaseName,
        parentJobId
    });

    try {
        const { fsxId, activeNodeInstanceId, protocol } = await runOracleClonePreValidations(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId
        );

        const volumeUuids =
            preValidatedVolumeUuids ||
            (clonedVolumeDetails || [])
                .map(({ cloneVolumeUuid }) => cloneVolumeUuid)
                .filter((uuid): uuid is string => !!uuid);

        const effectiveFsxId = IS_DEMO_FLOW ? 'test-fsx' : fsxId;
        const effectiveVolumeUuids = IS_DEMO_FLOW ? ['test-volume-uuid'] : volumeUuids;
        const isIscsi = protocol === 'iSCSI';

        await assertVolumesHaveNoSnapmirror(accountId, credentialsId, region, fsxId, effectiveVolumeUuids);

        const ontapBase = await buildOntapProxyBase(accountId, credentialsId, effectiveFsxId, region);
        const junctionPathsByUuid = isIscsi ? {} : await fetchCloneJunctionPaths(ontapBase, effectiveVolumeUuids);

        const script = buildCloneCleanupScript({
            junctionPaths: Object.values(junctionPathsByUuid),
            protocol,
            cloneDatabaseName
        });

        const ssmResponse = await callSsmExecution({
            credentialsId,
            region,
            commands: [script],
            ec2InstanceId: activeNodeInstanceId,
            comment: `Delete Oracle clone ${cloneDatabaseName}`,
            accountId,
            shouldReadFromCloudWatchLogs: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });

        let parsed;
        try {
            parsed = typeof ssmResponse === 'string' ? JSON.parse(ssmResponse) : ssmResponse;
        } catch (parseError) {
            const errorMessage = `Failed to parse SSM response for clone deletion of ${cloneDatabaseName}`;
            logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId, error: parseError });
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        if (parsed?.error) {
            const errorMessage = `SSM returned error while deleting clone ${cloneDatabaseName}: ${parsed.error}`;
            logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId });
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        logger.info('Host-side clone cleanup completed, proceeding to delete ONTAP volumes', {
            accountId,
            databaseHostId,
            databaseInstanceId,
            cloneDatabaseName,
            response: parsed
        });

        const deletedVolumes: string[] = [];
        const volumeErrorsByUuid: Record<string, string> = {};

        await Promise.all(
            effectiveVolumeUuids.map(
                throat(3, async volumeUuid => {
                    try {
                        if (!isIscsi) {
                            const { job } = await callProxyForwarder<{ job?: { uuid?: string } }>({
                                ...ontapBase,
                                ontapPath: `api/storage/volumes/${volumeUuid}`,
                                method: 'PATCH',
                                body: { nas: { path: '' } }
                            });
                            if (job?.uuid) {
                                await getOntapJobStatusForBase(ontapBase, job.uuid);
                            }
                        }
                        await deleteOntapVolumeByUuid(ontapBase, volumeUuid);
                        deletedVolumes.push(volumeUuid);
                    } catch (error: unknown) {
                        logger.error(`Failed to delete ONTAP volume ${volumeUuid} for clone ${cloneDatabaseName}`, {
                            accountId,
                            databaseHostId,
                            databaseInstanceId,
                            volumeUuid,
                            error
                        });
                        volumeErrorsByUuid[volumeUuid] = error instanceof Error ? error.message : String(error);
                    }
                })
            )
        );

        if (Object.keys(volumeErrorsByUuid).length > 0) {
            const errorMessage = `Host-side cleanup succeeded for clone ${cloneDatabaseName} (instance already shut down) but ONTAP volume deletion failed for: ${JSON.stringify(
                volumeErrorsByUuid
            )}`;
            logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId, deletedVolumes });
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        logger.info('Successfully deleted Oracle clone', {
            accountId,
            databaseHostId,
            databaseInstanceId,
            cloneDatabaseName,
            deletedVolumes,
            cleanedPaths: parsed?.cleanedPaths
        });
    } catch (error: unknown) {
        const errorMessage = extractErrorMessage(error);
        logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId, cloneDatabaseName });
        throw createError(
            (error as { statusCode?: number }).statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR,
            errorMessage
        );
    }
}

async function handleCloneRemediation(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    childCloneJobId: string,
    clone: OracleCloneActionType,
    cloneDetail: CloneDetail,
    mappedVolumesConfigData?: Record<string, OracleMappedOntapVolumesResponse>
) {
    logger.info('Handling Oracle clone remediation', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        childCloneJobId,
        clone,
        cloneDetail
    });

    const { cloneDatabaseName, action, clonedBy } = clone;

    if (clonedBy.toLowerCase() !== OTHER_CLONE || action !== CLONE_ACTION.DELETE) {
        const errorMessage = `Unsupported clone remediation: action=${action}, clonedBy=${clonedBy} for clone ${cloneDatabaseName}`;
        logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId });
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }

    let validatedVolumeUuids: string[] | undefined;
    if (!IS_DEMO_FLOW) {
        if (!mappedVolumesConfigData) {
            const errorMessage = `Mapped volumes config data is required for validating clone ${cloneDatabaseName} deletion but was not found`;
            logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId });
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
        }
        const { volumeUuids } = extractVolumeDetailsForClonesInInstance(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            cloneDetail,
            mappedVolumesConfigData
        );
        validatedVolumeUuids = volumeUuids;
    }

    await deleteClone(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDatabaseName,
        cloneDetail.clonedVolumeDetails,
        childCloneJobId,
        validatedVolumeUuids
    );
}

async function optimizeClone(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    clone: OracleCloneActionType,
    configData: CloneAssessment,
    parentJobId: string,
    resourceName: string,
    instanceName: string,
    mappedVolumesConfigData?: Record<string, OracleMappedOntapVolumesResponse>
) {
    logger.info('Optimizing Oracle clone', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        cloneDatabaseName: clone.cloneDatabaseName,
        parentJobId
    });

    let childCloneJobId = '';
    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let jobError = '';

    const { cloneDatabaseName, clonedBy } = clone;

    try {
        const { id } = await registerJob(accountId, credentialsId, region, {
            type: JOBTYPE.WELL_ARCHITECTED,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: cloneDatabaseName,
            name: `Delete clone ${cloneDatabaseName}`,
            startTime: Date.now(),
            description: `Delete clone ${cloneDatabaseName} from ${resourceName}\\${instanceName}`,
            parentJobId
        });
        childCloneJobId = id;

        const { oldCloneDetails } = configData;
        const matchingClone = oldCloneDetails?.find(
            ({ cloneDatabaseName: databaseName, clonedBy: owner }) =>
                databaseName === cloneDatabaseName && owner?.toLowerCase() === clonedBy?.toLowerCase()
        );

        if (!matchingClone) {
            const errorMessage = `Clone ${cloneDatabaseName} not found for ${clonedBy} in assessment data`;
            logger.error(errorMessage, { accountId, databaseHostId, databaseInstanceId });
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
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
            mappedVolumesConfigData
        );

        jobStatus = JOBSTATUS.COMPLETED;
    } catch (error: unknown) {
        jobStatus = JOBSTATUS.FAILED;
        jobError = extractErrorMessage(error);
        logger.error(jobError, { accountId, databaseHostId, databaseInstanceId });
    } finally {
        if (childCloneJobId) {
            await updateJobDetails(accountId, childCloneJobId, {
                status: jobStatus,
                endTime: Date.now(),
                error: jobError || undefined
            });
        }
    }
}

async function handleCloneOptimizationForInstance(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    clones: readonly OracleCloneActionType[],
    parentJobId: string
) {
    if (isEmpty(clones)) {
        logger.warn(`No clones found for instance ${databaseInstanceId} in databaseHost ${databaseHostId}`);
        return;
    }

    const { configData, instanceName, resourceName, mappedVolumesConfigData } =
        await fetchInstanceConfigurationAndVolumeMapping(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            clones
        );

    await Promise.all(
        clones.map(
            throat(3, async clone => {
                try {
                    await optimizeClone(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        clone,
                        configData,
                        parentJobId,
                        resourceName,
                        instanceName,
                        mappedVolumesConfigData
                    );
                    logger.info(
                        `Successfully optimized clone ${clone.cloneDatabaseName} for instance ${databaseInstanceId} in host ${databaseHostId}`
                    );
                } catch (error: unknown) {
                    logger.error(
                        `Failed to optimize clone ${clone.cloneDatabaseName} for host ${databaseHostId}, instance ${databaseInstanceId}`,
                        { accountId, error }
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
            databaseInstanceId,
            configData,
            clones as unknown as { cloneDatabaseName: string; clonedBy: string; action: string }[]
        );
    }

    resetCache(SSM_COMMAND_CACHE_TYPE);

    await triggerOracleAssessmentAfterOptimization(
        credentialsId,
        region,
        accountId,
        databaseHostId,
        `${resourceName}\\${instanceName}`,
        parentJobId,
        { id: databaseInstanceId },
        AssessmentCategoriesOracle.CLONE
    );
}

export {
    handleCloneOptimizationForInstance,
    validateAndExtractClonedVolumeUuids,
    buildVolumeMaps,
    extractInstancesToOptimize,
    deleteClone
};
