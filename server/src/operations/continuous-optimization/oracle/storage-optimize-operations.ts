import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { uniq } from 'lodash-es';
import {
    AssessmentCategories,
    AssessmentCategoriesOracle,
    AssessmentTriggeredBy,
    OptimizeStorageParams,
    OptimizeStorageRequestParams
} from '../../../utils/continous-optimization-consts';
import getLogger from '../../../utils/logger';
import GOLDEN_CONFIG from './golden-config';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { getInstanceInfo } from '../../database/database-operations';
import { fetchOracleDriftAssessment, triggerOracleAssessment } from './assessment-operations';
import { DatabaseInstancesIncludingResource, Metadata } from '../../../utils/common-types';
import {
    OracleGenericParameterDriftResponseType,
    StorageParameterDriftResponseType
} from '../../../routes/types/oracle-continuous-optimization.types';
import { listDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { isDemo, sqlResponseParsing } from '../../../utils/utils';
import { demoFsxId } from '../../../utils/demo-utils/demoMockdata';
import {
    addDiskToDiskGroups,
    createAndMapLunsForDiskGroups,
    mountLunsToDisks
} from '../../workloads/oracle/storage-optimize-scripts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import { mapVolumeTypesToIdName } from './storage-assessment-operations';
import { OracleMappedOntapVolumesResponse } from '../../workloads/oracle/common-types';
import { UnOptimizedDiskGroups } from '../assessment-utils';
import { CUSTOM_SSM_EXECUTION_TIMEOUT } from '../../../utils/consts';

const logger = getLogger();
const isDemoFlow = isDemo();
const STORAGE_LAYOUT_OPTIMIZE_CONFIG_KEYS = [
    GOLDEN_CONFIG.dataDiskLunLayout.name,
    GOLDEN_CONFIG.redoLogDiskLunLayout.name,
    GOLDEN_CONFIG.fraDiskLunLayout.name,
    GOLDEN_CONFIG.archivelogDiskLunLayout.name
];

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
        const fsxId = isDemoFlow ? demoFsxId : managedInstance.fsxn_ids;
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
        resource_id: resourceId
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
            }
        });

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
                true,
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
export { optimizeOracleStorageLayout };
