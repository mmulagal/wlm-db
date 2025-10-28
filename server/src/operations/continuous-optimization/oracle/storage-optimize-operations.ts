import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty, uniq } from 'lodash-es';
import {
    AssessmentCategories,
    AssessmentCategoriesOracle,
    AssessmentTriggeredBy,
    OptimizeOracleiSCSIStorageOperatingSystem,
    OptimizeStorageConfigs,
    OptimizeStorageParams,
    OptimizeStorageRequestParams,
    OptimizeStorageRequestParamsType
} from '../../../utils/continous-optimization-consts';
import { StorageAssessment } from './common-types';
import getLogger from '../../../utils/logger';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { getInstanceInfo } from '../../database/database-operations';
import { fetchOracleDriftAssessment, triggerOracleAssessment } from './assessment-operations';
import { DatabaseInstanceMetadata, DatabaseInstancesIncludingResource, Metadata } from '../../../utils/common-types';
import {
    OracleGenericParameterDriftResponseType,
    StorageParameterDriftResponseType
} from '../../../routes/types/oracle-continuous-optimization.types';
import { listDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { IS_DEMO_FLOW, sqlResponseParsing } from '../../../utils/utils';
import { callSsmExecution } from '../../aws/ssm-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import { calculateStorageDrift, mapVolumeTypesToIdName } from './storage-assessment-operations';
import { OracleMappedOntapVolumesResponse } from '../../workloads/oracle/common-types';
import { UnOptimizedDiskGroups } from '../assessment-utils';
import { CUSTOM_SSM_EXECUTION_TIMEOUT, HttpErrorCodes } from '../../../utils/consts';
import { updateOptimizedConfigNameInInstanceTable } from '../../demo-operations';
import GOLDEN_CONFIG from './golden-config';
import { getOracleDatabaseMappedVolumes } from '../../workloads/oracle/oracle-operations';
import {
    optimizeAfdDriftConfigParam,
    optimizeAsmLibDriftConfigParam,
    createAndMapLunsForDiskGroups,
    mountLunsToDisks,
    addDiskToDiskGroups
} from './ssm-scripts/storage-optimize-scripts';

const logger = getLogger();

const STORAGE_LAYOUT_OPTIMIZE_CONFIG_KEYS = [
    GOLDEN_CONFIG.dataDiskLunLayout.name,
    GOLDEN_CONFIG.redoLogDiskLunLayout.name,
    GOLDEN_CONFIG.fraDiskLunLayout.name,
    GOLDEN_CONFIG.archivelogDiskLunLayout.name
];

const oracleSpecialStorageConfigNames = [
    OptimizeStorageConfigs.TIERING_POLICY,
    OptimizeStorageConfigs.TIERING_MINIMUM_COOLING_DAYS,
    OptimizeStorageConfigs.COMPRESSION,
    OptimizeStorageConfigs.DEDUPLICATION,
    OptimizeStorageConfigs.COMPACTION,
    OptimizeStorageConfigs.NFS_ROOTONLY
];

interface OptimizeAsmConfigParams {
    accountId: string;
    region: string;
    credentialsId: string;
    resourceId: string;
    databaseInstanceId: string;
    node1InstanceId: string;
    instanceMetadata: unknown;
    parentJobId: string;
}

async function handleAfdDriftOptimization(params: OptimizeAsmConfigParams) {
    const {
        accountId,
        region,
        credentialsId,
        resourceId,
        databaseInstanceId,
        node1InstanceId,
        instanceMetadata,
        parentJobId
    } = params;
    logger.info('Handle Afd config drift optimization');
    const jobName = `Fix Afd Config param for ${databaseInstanceId}`;
    const jobDescription = `Fix Oracle Afd Logical block size Config param for DB Instance ${databaseInstanceId}`;
    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let jobError;
    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: databaseInstanceId,
        startTime: Date.now(),
        status: jobStatus,
        type: JOBTYPE.OPTIMIZATION,
        parentJobId
    });

    try {
        if (!node1InstanceId) {
            const errorMessage = `No EC2 instance id found for resource ${resourceId} in account ${accountId}.`;
            throw Error(errorMessage);
        }

        const optimizeAfdDriftParam = optimizeAfdDriftConfigParam;
        const optimizeAfdDriftParamComment = 'Optimize AFD Drift Config Param';
        const response = await callSsmExecution(
            credentialsId,
            region,
            [optimizeAfdDriftParam],
            node1InstanceId,
            optimizeAfdDriftParamComment,
            accountId,
            undefined,
            CUSTOM_SSM_EXECUTION_TIMEOUT,
            undefined,
            SSM_RUN_SHELL_SCRIPT_DOC,
            SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        );
        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                [OptimizeOracleiSCSIStorageOperatingSystem.ORACLE_AFD_LOGICAL_BLOCK_SIZE],
                'OS',
                instanceMetadata || {}
            );
        }
        if (response) {
            const parsedResponse = sqlResponseParsing(response);
            if (parsedResponse && parsedResponse.success) {
                jobStatus = JOBSTATUS.COMPLETED;
            } else {
                throw Error(`Error optimizing afd drift config param: ${parsedResponse.error}`);
            }
        }
    } catch (error) {
        jobStatus = JOBSTATUS.FAILED;
        jobError = `Error fixing Oracle AFD config param: ${(error as Error).message}`;
        logger.error(jobError);
        throw createError(jobError);
    } finally {
        updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }
}

async function handleAsmLibDriftOptimization(params: OptimizeAsmConfigParams) {
    logger.info('Handle asm lib config drift optimization');
    const {
        accountId,
        region,
        credentialsId,
        resourceId,
        databaseInstanceId,
        node1InstanceId,
        instanceMetadata,
        parentJobId
    } = params;
    const jobName = `Fix Asm lib Config param for ${databaseInstanceId}`;
    const jobDescription = `Fix Oracle Asm lib Config param for DB Instance ${databaseInstanceId}`;
    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let jobError;
    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: databaseInstanceId,
        startTime: Date.now(),
        status: jobStatus,
        type: JOBTYPE.OPTIMIZATION,
        parentJobId
    });

    try {
        if (!node1InstanceId) {
            const errorMessage = `No EC2 instance id found for resource ${resourceId} in account ${accountId}.`;
            throw Error(errorMessage);
        }
        const optimizeAsmLibParam = optimizeAsmLibDriftConfigParam;
        const optimizeAsmLibParamComment = 'Optimize Asm Lib Config Param';
        const response = await callSsmExecution(
            credentialsId,
            region,
            [optimizeAsmLibParam],
            node1InstanceId,
            optimizeAsmLibParamComment,
            accountId,
            undefined,
            CUSTOM_SSM_EXECUTION_TIMEOUT,
            undefined,
            SSM_RUN_SHELL_SCRIPT_DOC,
            SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        );
        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                [OptimizeOracleiSCSIStorageOperatingSystem.ORACLE_ASM_LOGICAL_BLOCK_SIZE],
                'OS',
                instanceMetadata || {}
            );
        }
        if (response) {
            const parsedResponse = sqlResponseParsing(response);
            if (parsedResponse && parsedResponse.success) {
                jobStatus = JOBSTATUS.COMPLETED;
            } else {
                throw Error(`Error optimizing asm lib config param: ${parsedResponse.error}`);
            }
        }
    } catch (error) {
        jobStatus = JOBSTATUS.FAILED;
        jobError = `Error fixing Oracle asm lib config param: ${(error as Error).message}`;
        logger.error(jobError);
        throw createError(jobError);
    } finally {
        updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }
}

async function handleDiskgroupOptimization(
    managedInstance: DatabaseInstancesIncludingResource,
    unOptimizedDiskGroups: UnOptimizedDiskGroups[],
    parentJobId: string
) {
    const {
        region,
        resource,
        database_instance_id: databaseInstanceId,
        account_id: accountId,
        credentials_id: credentialsId,
        resource_id: resourceId
    } = managedInstance;
    const jobName = `Fix ASM Diskgroups for ${databaseInstanceId}`;
    const jobDescription = `Fix Oracle Storage Layout for DB Instance ${databaseInstanceId}`;
    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let jobError;
    const resourceWithInstanceName = databaseInstanceId;
    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: jobStatus,
        type: JOBTYPE.OPTIMIZATION,
        parentJobId
    });

    try {
        const { node1InstanceId = '' } = (resource?.metadata as unknown as Metadata) || {};
        if (!node1InstanceId) {
            const errorMessage = `No EC2 instance id found for resource ${resourceId} in account ${accountId}.`;
            throw Error(errorMessage);
        }
        const configList = (await listDatabaseInstanceConfigData({
            accountId,
            credentialsId,
            region,
            resourceId,
            databaseInstanceIds: [databaseInstanceId],
            configDataType: AssessmentCategories.MAPPED_ONTAP_VOLUMES
        })) || [{}];
        const fsxId = managedInstance.fsxn_ids;
        const matchingConfigData = configList
            .map(cd => cd.config_data)
            .find(cd => Object.keys(cd as any).includes(fsxId));

        if (!matchingConfigData) {
            logger.warn(`No matching config data found for FSx ID ${fsxId}`);
            return null;
        }
        const mappedVolumesByFsxId = mapVolumeTypesToIdName(
            databaseInstanceId,
            fsxId,
            matchingConfigData as Record<string, OracleMappedOntapVolumesResponse>
        );

        const volumeList = Object.values(mappedVolumesByFsxId)?.flatMap(vols => [...(vols ?? [])]);
        const lunIds: any[] = uniq(volumeList.map(vol => vol.lunId));

        let epoch = Date.now();
        unOptimizedDiskGroups.forEach(dg => {
            epoch += 1;
            const matchingVol = volumeList.find(vol => vol.diskGroup === dg.diskGroupName);
            dg.svmName = matchingVol?.svmName;
            dg.svmId = matchingVol?.svmId;
            dg.volumeNames = [];
            for (let i = 0; i < dg.lunsToAdd; i++) {
                epoch += 1;
                dg.volumeNames.push(`wlmdb_${dg.diskGroupName}_${epoch}`);
            }
        });

        if (unOptimizedDiskGroups.length > 0) {
            const createVolsCommand = createAndMapLunsForDiskGroups(unOptimizedDiskGroups, lunIds, fsxId, region);
            const createVolsComment = 'Create Volumes for Oracle Diskgroups';
            const response = await callSsmExecution(
                credentialsId,
                region,
                [createVolsCommand],
                node1InstanceId,
                createVolsComment,
                accountId,
                undefined,
                CUSTOM_SSM_EXECUTION_TIMEOUT,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            );
            if (response) {
                const parsedResponse = sqlResponseParsing(response);
                const diskGrps = Object.keys(parsedResponse);
                if (parsedResponse && diskGrps.length === unOptimizedDiskGroups.length) {
                    diskGrps.forEach(dgName => {
                        if (parsedResponse[dgName].error) {
                            throw Error(`Error creating LUNs for Diskgroup ${dgName}: ${parsedResponse[dgName].error}`);
                        } else {
                            const dg = unOptimizedDiskGroups.find(d => d.diskGroupName === dgName);
                            if (dg) {
                                dg.lunSerials = parsedResponse[dgName].luns;
                                dg.iscsiIp = parsedResponse[dgName].iscsi_ip;
                            }
                        }
                    });
                } else {
                    throw Error(`Error creating LUNs for Diskgroups. diskgroups in response: ${diskGrps.join(', ')}`);
                }
            }
            logger.info('Mounting LUNs to Oracle ASM disks');
            const addToDiskgroupCommand = mountLunsToDisks(unOptimizedDiskGroups);
            const addToDiskgroupComment = 'Mount LUNs to Oracle ASM disks';
            const addDiskResponse = await callSsmExecution(
                credentialsId,
                region,
                [addToDiskgroupCommand],
                node1InstanceId,
                addToDiskgroupComment,
                accountId,
                undefined,
                CUSTOM_SSM_EXECUTION_TIMEOUT,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            );
            if (addDiskResponse) {
                const parsedResponse = sqlResponseParsing(addDiskResponse);
                const diskGrps = Object.keys(parsedResponse);
                if (parsedResponse && diskGrps.length === unOptimizedDiskGroups.length) {
                    diskGrps.forEach(dgName => {
                        if (parsedResponse[dgName].error) {
                            throw Error(`Error adding disk ${dgName}: ${parsedResponse[dgName].error}`);
                        } else {
                            const dg = unOptimizedDiskGroups.find(d => d.diskGroupName === dgName);
                            if (dg) {
                                dg.asmDisks = parsedResponse[dgName].disks;
                            }
                        }
                    });
                } else {
                    throw Error(`Error adding disk. Diskgroups in response: ${diskGrps.join(', ')}`);
                }
            }
            logger.info('Adding disks to Oracle ASM diskgroups');
            const attachToDiskgroupCommand = addDiskToDiskGroups(unOptimizedDiskGroups);
            const attachToDiskgroupComment = 'Add disks to Oracle ASM diskgroups';
            const attachDiskResponse = await callSsmExecution(
                credentialsId,
                region,
                [attachToDiskgroupCommand],
                node1InstanceId,
                attachToDiskgroupComment,
                accountId,
                undefined,
                CUSTOM_SSM_EXECUTION_TIMEOUT,
                undefined,
                SSM_RUN_SHELL_SCRIPT_DOC,
                SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            );
            if (attachDiskResponse) {
                const parsedResponse = sqlResponseParsing(attachDiskResponse);
                const diskGrps = Object.keys(parsedResponse);
                if (parsedResponse && diskGrps.length === unOptimizedDiskGroups.length) {
                    diskGrps.forEach(dgName => {
                        if (parsedResponse[dgName].error) {
                            throw Error(`Error adding disk to Diskgroup ${dgName}: ${parsedResponse[dgName].error}`);
                        }
                    });
                } else {
                    throw Error(`Error adding disks to Diskgroups. Diskgroups in response: ${diskGrps.join(', ')}`);
                }
            }
        }
        jobStatus = JOBSTATUS.COMPLETED;
    } catch (error) {
        jobStatus = JOBSTATUS.FAILED;
        jobError = `Error fixing Oracle Diskgroup: ${(error as Error).message}`;
        logger.error(jobError);
        throw error;
    } finally {
        updateJobDetails(accountId, jobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: jobError
        });
    }
}

async function triggerAssessmentAndStartOptimization(
    storageLayoutTargets: OptimizeStorageRequestParams[],
    managedInstance: DatabaseInstancesIncludingResource,
    parentJobId: string
) {
    logger.info('Starting optimization operation for managed instance', {
        managedInstance,
        parentJobId
    });

    const {
        region,
        database_instance_id: databaseInstanceId,
        account_id: accountId,
        credentials_id: credentialsId,
        resource_id: resourceId,
        metadata: instanceMetadata
    } = managedInstance;

    let parentJobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let parentJobError = '';
    try {
        await triggerOracleAssessment(
            managedInstance,
            parentJobId,
            [AssessmentCategoriesOracle.STORAGE],
            false,
            AssessmentTriggeredBy.SYSTEM
        );

        const driftAssessment = await fetchOracleDriftAssessment(
            accountId,
            credentialsId,
            region,
            resourceId,
            databaseInstanceId,
            AssessmentCategoriesOracle.STORAGE,
            managedInstance
        );
        if (!driftAssessment?.storage || !(driftAssessment.storage as StorageParameterDriftResponseType).layout) {
            throw Error('No drift assessment found after triggering assessment for storage optimization');
        }
        const lunLayoutDrift = ((driftAssessment?.storage as StorageParameterDriftResponseType).layout ?? []).filter(
            target => typeof target.name === 'string' && STORAGE_LAYOUT_OPTIMIZE_CONFIG_KEYS.includes(target.name)
        );

        const unOptimizedDiskGroups: UnOptimizedDiskGroups[] = [];
        const targetConfigNamesForDemo: string[] = [];
        lunLayoutDrift.forEach(lunDrift => {
            const targetConfig = storageLayoutTargets.find(target => target.configurationName === lunDrift.name);
            if (targetConfig) {
                targetConfig.objectsToOptimize.forEach(diskGroupName => {
                    const violationDetails = (
                        lunDrift as OracleGenericParameterDriftResponseType
                    ).violationDetails?.find(v => v.objectName === diskGroupName);
                    if (violationDetails) {
                        const lunsToAdd = Number(violationDetails?.recommended) - Number(violationDetails?.value);
                        if (lunsToAdd > 0) {
                            unOptimizedDiskGroups.push({ diskGroupName, lunsToAdd });
                        }
                    }
                });
                targetConfigNamesForDemo.push(targetConfig.configurationName);
            }
        });

        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                targetConfigNamesForDemo,
                'STORAGE',
                instanceMetadata as DatabaseInstanceMetadata
            );
        }

        if (unOptimizedDiskGroups.length > 0) {
            await handleDiskgroupOptimization(managedInstance, unOptimizedDiskGroups, parentJobId);
            parentJobStatus = JOBSTATUS.COMPLETED;
        } else {
            parentJobStatus = JOBSTATUS.WARNING;
            parentJobError = 'No unoptimized ASM diskgroups matched the requested optimization targets.';
        }
    } catch (err) {
        parentJobStatus = JOBSTATUS.WARNING;
        parentJobError = (err as Error).message;
        logger.error('Failed optimizing Oracle ASM layout', err);
    } finally {
        if (parentJobStatus === JOBSTATUS.COMPLETED && managedInstance) {
            triggerOracleAssessment(
                managedInstance,
                parentJobId,
                [AssessmentCategoriesOracle.STORAGE],
                false,
                AssessmentTriggeredBy.SYSTEM
            );
        }
        updateJobDetails(accountId, parentJobId, {
            status: parentJobStatus,
            endTime: Date.now(),
            error: parentJobError
        });
    }
}

async function optimizeOracleStorageLayout(storageOptimizeParams: OptimizeStorageParams) {
    const { accountId, credentialsId, region, databaseHostId, databaseInstanceId, optimizationTargets } =
        storageOptimizeParams;
    logger.info('Optimizing Oracle storage layout for database instance', {
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseInstanceId
    });

    const parentJobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let parentJobError;

    const jobName = `Fix Oracle Storage Layout for DB Instance ${databaseInstanceId}`;
    const jobDescription = `Fix Oracle Storage Layout for DB Instance ${databaseInstanceId}`;
    const resourceWithInstanceName = databaseInstanceId;
    const { id: parentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: parentJobStatus,
        type: JOBTYPE.OPTIMIZATION
    });
    let managedInstance;
    try {
        const storageLayoutTargets = optimizationTargets.filter(target =>
            STORAGE_LAYOUT_OPTIMIZE_CONFIG_KEYS.includes(target.configurationName)
        );
        if (storageLayoutTargets.length > 0) {
            managedInstance = (await getInstanceInfo(
                accountId,
                credentialsId,
                databaseHostId,
                databaseInstanceId,
                region
            )) as DatabaseInstancesIncludingResource;
            if (!managedInstance) {
                return createError(404, `No database instance found for id ${databaseInstanceId}`);
            }
            triggerAssessmentAndStartOptimization(storageLayoutTargets, managedInstance, parentJobId);
        } else {
            parentJobError = 'No valid storage layout optimization configurations found for Oracle database instance.';
            logger.warn(parentJobError);

            await updateJobDetails(accountId, parentJobId, {
                status: JOBSTATUS.FAILED,
                endTime: Date.now(),
                error: parentJobError
            });
            return createError(400, parentJobError);
        }
    } catch (error) {
        const errMsg = `Error optimizing Oracle storage layout: ${(error as Error).message}`;
        logger.error(errMsg);
        throw createError(500, errMsg);
    }
    return parentJobId;
}

async function getOracleStorageConfigRecommendationMap(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    databaseInstanceName: string,
    deploymentType: string,
    activeNodeInstanceId: string,
    fileSystemId: string,
    optimizationTargets: OptimizeStorageRequestParamsType[],
    serverNameWithHostName: string,
    parentJobId: string
) {
    logger.info('Getting fresh recommendation', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        fileSystemId,
        optimizationTargets
    });

    const { id: jobId } = await registerJob(accountId, credentialsId, region, {
        name: `Fix storage for ${serverNameWithHostName}`,
        description: `Fetching latest ONTAP configuration for ${serverNameWithHostName}`,
        startTime: Date.now(),
        type: JOBTYPE.WELL_ARCHITECTED,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName,
        parentJobId
    });
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let jobError;

    try {
        await getOracleDatabaseMappedVolumes(accountId, credentialsId, region, databaseHostId, databaseInstanceId);

        const databaseInstanceConfigData = await listDatabaseInstanceConfigData({
            accountId,
            region,
            credentialsId,
            resourceId: databaseHostId,
            databaseInstanceIds: [databaseInstanceId]
        });

        const assessmentDataMap = databaseInstanceConfigData.reduce(
            (acc: Record<string, unknown>, config: { config_data_type: string; config_data: unknown }) => {
                acc[config.config_data_type] = acc[config.config_data_type] || config.config_data;
                return acc;
            },
            {} as Record<string, unknown>
        );

        const mappedOntapVolumes = assessmentDataMap[AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES] as Record<
            string,
            OracleMappedOntapVolumesResponse
        >;

        const storageDrift = calculateStorageDrift(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            activeNodeInstanceId,
            databaseInstanceId,
            databaseInstanceName,
            deploymentType,
            fileSystemId,
            mappedOntapVolumes,
            assessmentDataMap[AssessmentCategoriesOracle.STORAGE] as StorageAssessment
        );

        // recommendation map: config -> {recommendedValue -> [objectName]}
        const recommendationMap: { [key in OptimizeStorageConfigs]?: Record<string, string[]> } = {};

        const storageDriftTyped = storageDrift as StorageParameterDriftResponseType;
        if (isEmpty(storageDriftTyped.configuration)) {
            return;
        }

        const { volumes } = storageDriftTyped.configuration;
        if (isEmpty(volumes)) {
            return;
        }

        volumes
            .filter(({ name }) => name && oracleSpecialStorageConfigNames.includes(name as OptimizeStorageConfigs))
            .forEach(volume => {
                const { name: configKey, violationDetails } = volume as OracleGenericParameterDriftResponseType;
                if (!violationDetails) {
                    return;
                }

                optimizationTargets
                    .filter(({ configurationName }) => configurationName === configKey)
                    .forEach(({ objectsToOptimize }) => {
                        violationDetails
                            .filter(
                                ({ objectName, recommended }) =>
                                    objectName && recommended && objectsToOptimize.includes(objectName)
                            )
                            .forEach(({ objectName, recommended }) => {
                                if (!recommended) {
                                    return;
                                }
                                const key = configKey as OptimizeStorageConfigs;
                                recommendationMap[key] ??= {};
                                recommendationMap[key][recommended] ??= [];
                                recommendationMap[key][recommended].push(objectName);
                            });
                    });
            });
        return recommendationMap;
    } catch (error) {
        logger.error('Failed to refresh assessment data', { error });
        jobStatus = JOBSTATUS.FAILED;
        jobError = error;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to get recommendation map');
    } finally {
        await updateJobDetails(accountId, jobId, {
            status: jobStatus,
            error: jobStatus === JOBSTATUS.FAILED ? `Failed to get recommendation map; Error: ${jobError}` : undefined,
            endTime: Date.now()
        });
    }
}

export {
    optimizeOracleStorageLayout,
    getOracleStorageConfigRecommendationMap,
    oracleSpecialStorageConfigNames,
    handleAfdDriftOptimization,
    handleAsmLibDriftOptimization
};
