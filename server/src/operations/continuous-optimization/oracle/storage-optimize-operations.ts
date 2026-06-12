import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty, uniq } from 'lodash-es';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories,
    AssessmentCategoriesOracle,
    AssessmentTriggeredBy,
    OptimizeOracleiSCSIStorageOperatingSystem,
    OptimizeOracleStorageSizing,
    OptimizeStorageConfigs,
    OptimizeStorageParams,
    OptimizeStorageRequestParams,
    OptimizeStorageRequestParamsType
} from '../../../utils/continous-optimization-consts';
import ORACLE_GOLDEN_CONFIG from './golden-config';
import { StorageAssessment } from './common-types';
import getLogger from '../../../utils/logger';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { getInstanceInfo } from '../../database/database-operations';
import {
    fetchOracleDriftAssessment,
    triggerOracleAssessment,
    triggerOracleAssessmentAfterOptimization
} from './assessment-operations';
import { DatabaseInstanceMetadata, DatabaseInstancesIncludingResource, Metadata } from '../../../utils/common-types';
import { OracleGenericParameterDriftResponseType } from '../../../routes/types/oracle-continuous-optimization.types';
import { listDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { IS_DEMO_FLOW, sqlResponseParsing } from '../../../utils/utils';
import { callSsmExecution } from '../../aws/ssm-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import { calculateStorageDrift, mapVolumeTypesToIdName } from './storage-assessment-operations';
import { OracleMappedOntapVolumesResponse } from '../../workloads/oracle/common-types';
import { activeSqlNodeDetails, handleOptimizeJobCreation, UnOptimizedDiskGroups } from '../assessment-utils';
import { CUSTOM_SSM_EXECUTION_TIMEOUT, HttpErrorCodes, RESOURCESTYPE } from '../../../utils/consts';
import { updateOptimizedConfigNameInInstanceTable } from '../../demo-operations';
import { getOracleDatabaseMappedVolumes } from '../../workloads/oracle/oracle-operations';
import {
    optimizeAfdDriftConfigParam,
    optimizeAsmLibDriftConfigParam,
    createAndMapLunsForDiskGroups,
    mountLunsToDisks,
    addDiskToDiskGroups
} from './ssm-scripts/storage-optimize-scripts';
import { OracleJobMetadata, oracleSpecialStorageConfigNames } from './consts';
import { headroomOptimization } from '../headroom-assessment';

const logger = getLogger();

const STORAGE_LAYOUT_OPTIMIZE_CONFIG_KEYS = ORACLE_GOLDEN_CONFIG.filter(
    entry =>
        entry.type === 'storage' &&
        entry.subType === 'layout' &&
        entry.resourceType === ASSESSMENT_RESOURCE_TYPE.DISK_GROUP
).map(entry => entry.id);

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
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [optimizeAfdDriftParam],
            ec2InstanceId: node1InstanceId,
            comment: optimizeAfdDriftParamComment,
            accountId,
            executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });
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
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [optimizeAsmLibParam],
            ec2InstanceId: node1InstanceId,
            comment: optimizeAsmLibParamComment,
            accountId,
            executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });
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
            const response = await callSsmExecution({
                credentialsId,
                region,
                commands: [createVolsCommand],
                ec2InstanceId: node1InstanceId,
                comment: createVolsComment,
                accountId,
                executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT,
                documentName: SSM_RUN_SHELL_SCRIPT_DOC,
                documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            });
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
            const addDiskResponse = await callSsmExecution({
                credentialsId,
                region,
                commands: [addToDiskgroupCommand],
                ec2InstanceId: node1InstanceId,
                comment: addToDiskgroupComment,
                accountId,
                executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT,
                documentName: SSM_RUN_SHELL_SCRIPT_DOC,
                documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            });
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
            const attachDiskResponse = await callSsmExecution({
                credentialsId,
                region,
                commands: [attachToDiskgroupCommand],
                ec2InstanceId: node1InstanceId,
                comment: attachToDiskgroupComment,
                accountId,
                executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT,
                documentName: SSM_RUN_SHELL_SCRIPT_DOC,
                documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            });
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
        // Storage layout drift items are flattened entries carrying subType 'layout'.
        const lunLayoutDrift = (driftAssessment?.assessments ?? []).filter(item =>
            STORAGE_LAYOUT_OPTIMIZE_CONFIG_KEYS.includes(item.id)
        );
        if (isEmpty(lunLayoutDrift)) {
            throw Error('No drift assessment found after triggering assessment for storage optimization');
        }

        const unOptimizedDiskGroups: UnOptimizedDiskGroups[] = [];
        const targetConfigNamesForDemo: string[] = [];
        lunLayoutDrift.forEach(lunDrift => {
            const targetConfig = storageLayoutTargets.find(target => target.configurationName === lunDrift.id);
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
        name: `Fix Oracle Storage Configuration for ${serverNameWithHostName}`,
        description: `Fetch latest ONTAP configuration for ${serverNameWithHostName}`,
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

        const storageDrift = await calculateStorageDrift(
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
        const recommendationMap: {
            [key in OptimizeStorageConfigs]?: {
                recommended: {
                    [recommendedValue: string]: string[];
                };
                additionalInfo: Record<string, unknown>;
            };
        } = {};

        // calculateStorageDrift now returns a flat array; filter by type/subType.
        const volumes = storageDrift.filter(item => item.type === 'storage' && item.subType === 'configuration');
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
                            .forEach(({ objectName, recommended, additionalInfo }) => {
                                if (!recommended) {
                                    return;
                                }
                                const key = configKey as OptimizeStorageConfigs;
                                if (!recommendationMap[key]) {
                                    recommendationMap[key] = {
                                        recommended: {},
                                        additionalInfo: additionalInfo ?? {}
                                    };
                                }
                                if (!recommendationMap[key].recommended[recommended]) {
                                    recommendationMap[key].recommended[recommended] = [];
                                }
                                recommendationMap[key].recommended[recommended].push(objectName as string);
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

async function oracleOptimizeStorageSizing(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    configurationName: string,
    masterOptimizeParentId?: string
) {
    logger.info(
        `Optimizing storage sizing for ${accountId}, ${credentialsId} ${databaseHostId} ${databaseInstanceId} in ${region} for configuration ${configurationName}`
    );

    const { activeNodeInstanceId, serverNameWithHostName, fsxId } = await activeSqlNodeDetails(
        credentialsId,
        region,
        accountId,
        databaseHostId,
        databaseInstanceId
    );

    if (!activeNodeInstanceId) {
        const errorMessage = `Unable to optimize storage sizing for ${databaseInstanceId} in account ${accountId}. Cannot retrieve active node ID from the Oracle configuration.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    let jobDescription = '';
    switch (configurationName) {
        case OptimizeOracleStorageSizing.HEADROOM:
            jobDescription = `Optimize storage headroom for ${serverNameWithHostName}`;
            break;
        default:
            jobDescription = '';
            break;
    }

    const jobMetadata: OracleJobMetadata = {
        hostsToOptimize: [
            {
                optimizationType: configurationName,
                resourceId: databaseHostId,
                databases: [databaseInstanceId]
            }
        ]
    };

    const parentJobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        serverNameWithHostName,
        JOBTYPE.WELL_ARCHITECTED,
        jobDescription,
        jobDescription,
        masterOptimizeParentId,
        jobMetadata
    );

    let parentJobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let parentJobError = '';

    switch (configurationName) {
        case OptimizeOracleStorageSizing.HEADROOM: {
            try {
                const result = await headroomOptimization(
                    accountId,
                    credentialsId,
                    region,
                    fsxId,
                    parentJobId,
                    serverNameWithHostName,
                    RESOURCESTYPE.ORACLE
                );

                if (result?.jobStatus === JOBSTATUS.FAILED) {
                    parentJobError = result.errorMessage || 'Headroom optimization failed';
                    logger.error(parentJobError);
                    parentJobStatus = JOBSTATUS.FAILED;
                }
                if (IS_DEMO_FLOW) {
                    await updateOptimizedConfigNameInInstanceTable(
                        accountId,
                        databaseInstanceId,
                        [OptimizeOracleStorageSizing.HEADROOM],
                        'SIZING',
                        jobMetadata as DatabaseInstanceMetadata
                    );
                }
            } catch (error) {
                parentJobError = String(error);
                logger.error(parentJobError);
                parentJobStatus = JOBSTATUS.FAILED;
            }
            break;
        }

        default:
            parentJobError = `Unknown configuration name: ${configurationName}`;
            logger.error(parentJobError);
            parentJobStatus = JOBSTATUS.FAILED;
            break;
    }

    await updateJobDetails(accountId, parentJobId, {
        status: parentJobStatus,
        endTime: Date.now(),
        error: parentJobError || undefined
    });

    if (parentJobStatus === JOBSTATUS.COMPLETED) {
        const instanceToAssess = {
            id: databaseInstanceId
        };
        await triggerOracleAssessmentAfterOptimization(
            credentialsId,
            region,
            accountId,
            databaseHostId,
            serverNameWithHostName,
            parentJobId,
            instanceToAssess,
            AssessmentCategories.STORAGE
        );
    }
}

export {
    optimizeOracleStorageLayout,
    getOracleStorageConfigRecommendationMap,
    handleAfdDriftOptimization,
    handleAsmLibDriftOptimization,
    oracleOptimizeStorageSizing
};
