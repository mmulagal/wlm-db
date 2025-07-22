import createError from 'http-errors';
import { isEmpty, isNil } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import throat from 'throat';
import getLogger from '../../../utils/logger';
import {
    AvailableSnapshotPoliciesResponseType,
    BulkOptimizeSnapshotPolicyRequestBody,
    OntapVolumeType,
    OptimizeResiliencyBodyType,
    SnapshotPolicyDetailsType,
    SnapshotPolicyType,
    SnapshotScheduleType,
    BulkOptimizeSnapshotPolicyParamsType,
    OptimizeHASharedStorageRequestBodyType,
    FlattenedInstanceType,
    OptimizationPreparationType,
    LunDetailType
} from '../../../routes/types/continuous-optimization.types';
import {
    DatabaseInstanceMetadata,
    Metadata,
    WorkloadInstance,
    MappedOnTapVolumeResponse
} from '../../../utils/common-types';
import {
    AuditStatus,
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    HttpErrorCodes,
    SSM_COMMAND_CACHE_TYPE
} from '../../../utils/consts';
import { activeSqlNodeDetails } from '../../cont-opt-optimize-operations';
import {
    GET_CLUSTER_SNAPSHOT_POLICIES,
    SET_VOLUME_SNAPSHOT_POLICY
} from '../../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { getServerNameWithHostname, isDemo, retryWithDelay, sqlResponseParsing } from '../../../utils/utils';
import { describeFSxStorageVirtualMachines } from '../../../lib/aws/fsx';
import { getMappedOntapVolumes } from '../../aws/fsx-operations';
import { handleOptimizeJobCreation, JobMetadata } from '../assessment-utils';
import { registerJob, updateJobDetails, updateParentJobStatus } from '../../database/job-operations';
import { updateLongRunningAuditGroup } from '../../cloud-manager/audit-operations';
import { listDatabaseInstances } from '../../../lib/database/db';
import { getActiveSqlNode } from '../../workloads/mssql/mssql-operations';
import {
    AssessmentCategories,
    AssessmentTriggeredBy,
    OPTIMIZE_RESILIENCY_CONFIGS,
    OptimizeHighAvailabilityParams,
    OptimizeStorageConfigs
} from '../../../utils/continous-optimization-consts';
import { updateOptimizedConfigNameInInstanceTable } from '../../demo-operations';
import { resetCache } from '../../../utils/cache';
import { onDemandTriggerMssqlDriftAssessment } from './assessment-operations';
import { ADD_INITIATOR_TO_IGROUP } from '../../workloads/mssql/high-availability-scripts';
import { listInstanceConfigIncludingResourceAndInstance } from '../../database/instance-config-operations';

const logger = getLogger();
const isDemoFlow = isDemo();

async function getMappedVolumeDetails(credentialsId: string, region: string, instanceRecord: WorkloadInstance) {
    return (
        ((await getMappedOntapVolumes(
            credentialsId,
            region,
            instanceRecord.fsxFileSystem,
            false,
            instanceRecord.activeNodeInstanceid,
            [instanceRecord.name],
            instanceRecord.sqlAuthEnabled,
            true
        )) as MappedOnTapVolumeResponse[]) || [{ volumeRecords: [], volumeDBMap: {} }]
    );
}

async function getActiveNodeInfo(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    const {
        sqlAuthEnabled,
        activeNodeInstanceId,
        fsxId,
        instanceId,
        instanceName,
        databaseType,
        awsAccountId,
        serverNameWithHostName,
        svmDetails,
        instanceMetadata
    } = await activeSqlNodeDetails(credentialsId, region, accountId, databaseHostId, databaseInstanceId);

    const instanceRecord: WorkloadInstance = {
        id: instanceId,
        name: instanceName,
        type: databaseType,
        region,
        sqlAuthEnabled: sqlAuthEnabled || false,
        fsxFileSystem: fsxId,
        activeNodeInstanceid: activeNodeInstanceId!,
        cloudProviderAccountId: awsAccountId!,
        resourceName: serverNameWithHostName
    };

    return { instanceRecord, fsxId, svmDetails, instanceMetadata };
}

async function getAvailableSnapshotPolicyList(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
): Promise<AvailableSnapshotPoliciesResponseType> {
    logger.info('Getting available snapshot policy list', { credentialsId, databaseInstanceId, databaseHostId });
    const response: AvailableSnapshotPoliciesResponseType = {
        snapshotPolicies: [],
        errorMessage: ''
    };
    try {
        const dbInstancesResult = await listDatabaseInstances(accountId, {
            resourceId: databaseHostId,
            credentialsId,
            sqlInstanceId: databaseInstanceId,
            region,
            shouldIncludeResource: true
        });
        const dbInstances = Array.isArray(dbInstancesResult) ? dbInstancesResult : dbInstancesResult?.items || [];
        const [
            {
                resource: { metadata, resource_id: resourceId },
                fsx_svm_id: svmRecord,
                fsxn_ids: fsxnIds
            }
        ] = dbInstances;

        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
        const { activeNodeInstanceId = '' } = await getActiveSqlNode(credentialsId, region, {
            node1InstanceId,
            node2InstanceId,
            resourceId,
            accountId
        });

        const fsxId = fsxnIds?.split(',')[0];
        const { StorageVirtualMachines: svms = [] } = await describeFSxStorageVirtualMachines(
            credentialsId,
            region,
            [fsxId],
            { useCache: true }
        );
        const svmIdAssignedToInstance = svms.find(svm => {
            if (isDemoFlow) {
                return svm;
            }
            return svm?.StorageVirtualMachineId === (svmRecord as Record<string, string>)[fsxId];
        });
        if (!svmIdAssignedToInstance) {
            throw Error(`No SVM found for the given host ${databaseHostId} and instance ${databaseInstanceId}`);
        }

        const command = [GET_CLUSTER_SNAPSHOT_POLICIES(fsxId, region)];
        const ssmComment = 'Get available snapshot policies';
        const rawResponse = await callSsmExecution(
            credentialsId,
            region,
            command,
            activeNodeInstanceId,
            ssmComment,
            accountId,
            true,
            undefined,
            true
        );
        const {
            response: { snapshotSchedules, snapshotPolicies },
            errors: { snapshotSchedules: snapshotSchedulesError, snapshotPolicies: snapshotPoliciesError }
        } = sqlResponseParsing(rawResponse) || {};
        if (!isEmpty(snapshotSchedulesError) || !isEmpty(snapshotPoliciesError)) {
            const errMsg = 'Error executing SSM command while getting snapshot policy list';
            logger.error(errMsg, { snapshotPoliciesError, snapshotSchedulesError });
            throw Error(errMsg);
        }

        const eligiblePolicies = snapshotPolicies?.records
            ?.filter(
                (record: { scope: string; svm: { uuid: string | undefined } }) =>
                    record.scope === 'cluster' || record.svm.uuid === svmIdAssignedToInstance?.UUID
            )
            .map((record: { name: string; uuid: string; copies: any }) => record);
        const eligibleSchedules = snapshotSchedules?.records?.reduce((mp: any, record: Record<string, string>) => {
            mp[record.uuid] = record;
            return mp;
        }, {});

        eligiblePolicies?.forEach((policy: { name: string; uuid: string; copies: any }) => {
            const policyObj: SnapshotPolicyDetailsType = {
                uuid: policy?.uuid,
                name: policy?.name,
                schedules: []
            };
            policy?.copies?.forEach((copyDetails: any) => {
                const scheduleDetails = eligibleSchedules?.[copyDetails?.schedule?.uuid];
                const scheduleObj: SnapshotScheduleType = {
                    uuid: scheduleDetails?.uuid,
                    name: scheduleDetails?.name,
                    cron: scheduleDetails?.cron,
                    retention: copyDetails?.retention_period
                };
                policyObj.schedules?.push(scheduleObj);
            });
            response.snapshotPolicies?.push(policyObj);
        });
    } catch (error) {
        logger.error('Error getting available snapshot policy list', error);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, error as Error);
    }
    return response;
}

async function setSnapshotPolicyForVolumes(
    instanceRecord: WorkloadInstance,
    accountId: string,
    credentialsId: string,
    region: string,
    snapshotPolicy: SnapshotPolicyType,
    parentJobId?: string,
    instanceMetadata?: DatabaseInstanceMetadata,
    volumesToOptimize?: OntapVolumeType[]
) {
    logger.info('Setting snapshot policy for volumes of instace: ', { instance: instanceRecord?.name, snapshotPolicy });
    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let jobError = '';
    let subJobId = null;
    try {
        const jobMetadata: JobMetadata = {
            hostsToOptimize: [
                {
                    optimizationType: 'resiliency',
                    resourceId: instanceRecord.resourceName,
                    sqlServerInstances: [instanceRecord.activeNodeInstanceid]
                }
            ]
        };
        const subJobDetails = `Fix snapshot policy for ${instanceRecord.resourceName}`;
        subJobId = await handleOptimizeJobCreation(
            accountId,
            credentialsId,
            region,
            instanceRecord.resourceName,
            JOBTYPE.WELL_ARCHITECTED,
            subJobDetails,
            subJobDetails,
            parentJobId,
            jobMetadata
        );
        let volumeUuids = [];
        const instanceVolumeMapping = await getMappedVolumeDetails(credentialsId, region, instanceRecord);
        const mappedVolumeUUIDs = (
            Object.values(instanceVolumeMapping)
                ?.map(i => i?.volumeRecords)
                .flat() || []
        )?.map(volume => volume.uuid as string);
        const missingVolumes: string[] = [];
        if (volumesToOptimize && !isEmpty(volumesToOptimize)) {
            volumeUuids = volumesToOptimize.map(volume => volume.ontapVolumeUuid as string);
            volumeUuids = volumeUuids.filter(volumeUuid => {
                if (!mappedVolumeUUIDs.includes(volumeUuid)) {
                    missingVolumes.push(volumeUuid);
                    return false;
                }
                return true;
            });
        } else {
            volumeUuids = mappedVolumeUUIDs;
        }

        if (!isEmpty(volumeUuids)) {
            const params: BulkOptimizeSnapshotPolicyParamsType = {
                fsxId: instanceRecord.fsxFileSystem,
                region,
                volUuids: JSON.stringify(volumeUuids),
                apiBody: JSON.stringify({ snapshot_policy: snapshotPolicy })
            };

            const command = [SET_VOLUME_SNAPSHOT_POLICY(params)];
            const ssmComment = 'Set snapshot policy for volumes';

            const response = await retryWithDelay(
                callSsmExecution.bind(
                    null,
                    credentialsId,
                    region,
                    command,
                    instanceRecord.activeNodeInstanceid,
                    ssmComment,
                    accountId,
                    false,
                    CUSTOM_SSM_EXECUTION_TIMEOUT
                )
            );
            const { response: ssmResponse, error: ssmError } = sqlResponseParsing(response);
            if (!isEmpty(ssmError)) {
                logger.error('Error executing SSM command to set snapshot for volumes', ssmError, volumeUuids);
                jobError = `Failed to set snapshot policy for volumes: ${ssmError}`;
                jobStatus = JOBSTATUS.FAILED;
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, ssmError);
            }
            if (!isDemoFlow && ssmResponse.length !== volumeUuids.length) {
                logger.error('Error setting snapshot policy for volumes. ONTAP job IDs:', ssmResponse, volumeUuids);
                jobError = `Failed to set snapshot policy for some volumes: ONTAP job IDs:', ${ssmResponse}`;
                jobStatus = JOBSTATUS.WARNING;
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error setting snapshot policy for volumes');
            }
            jobStatus = JOBSTATUS.COMPLETED;
        }
        if (isDemoFlow) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                instanceRecord.id,
                [OptimizeStorageConfigs.SNAPSHOT_POLICY],
                'STORAGE',
                instanceMetadata || ({} as DatabaseInstanceMetadata)
            );
            jobStatus = JOBSTATUS.COMPLETED;
        }
        if (!isDemoFlow && missingVolumes.length > 0) {
            jobError = `Volumes UUIDs: ${missingVolumes.join(', ')} are not found for database instance: ${
                instanceRecord.resourceName
            }`;
            jobStatus = JOBSTATUS.WARNING;
        }
    } catch (error) {
        const errMsg = JSON.stringify(error);
        logger.error('Error setting snapshot policy for volumes', errMsg);
        jobStatus = JOBSTATUS.FAILED;
        jobError = errMsg;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errMsg);
    } finally {
        // TODO: Handle job errors for parent and each sub job separately to prevent job status from being overwritten
        if (!isNil(parentJobId)) {
            await updateJobDetails(accountId, parentJobId, {
                status: jobStatus,
                endTime: Date.now(),
                error: jobError
            });
        }
        if (!isNil(subJobId)) {
            await updateJobDetails(accountId, subJobId, {
                status: jobStatus,
                endTime: Date.now(),
                error: jobError
            });
        }
        const auditStatus = jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED;
        updateLongRunningAuditGroup(auditStatus, jobError);
    }
}

async function handleResiliecyOptimize(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    request: OptimizeResiliencyBodyType
) {
    logger.info('Optimize resiliency for: ', {
        region,
        accountId,
        credentialsId,
        databaseInstanceId,
        databaseHostId,
        request
    });
    const shouldOptimizeSnapshotPolicy = !!request.configurationName.filter(
        configurationName => configurationName === OPTIMIZE_RESILIENCY_CONFIGS.SNAPSHOT_POLICY
    ).length;
    const params = request.params!;
    const { instanceRecord, instanceMetadata } = await getActiveNodeInfo(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    );
    const jobMetadata: JobMetadata = {
        hostsToOptimize: [
            {
                optimizationType: 'resiliency',
                resourceId: databaseHostId,
                sqlServerInstances: [databaseInstanceId]
            }
        ]
    };
    // check whether any jobs on the same resource running
    const jobDetails = `Fix resiliency for ${instanceRecord.resourceName}`;
    const jobId = await handleOptimizeJobCreation(
        accountId,
        credentialsId,
        region,
        instanceRecord.resourceName,
        JOBTYPE.WELL_ARCHITECTED,
        jobDetails,
        jobDetails,
        undefined,
        jobMetadata
    );
    if (shouldOptimizeSnapshotPolicy) {
        const [{ snapshotPolicy, volumes }] = params.filter(
            param => typeof param === typeof BulkOptimizeSnapshotPolicyRequestBody
        );

        setSnapshotPolicyForVolumes(
            instanceRecord,
            accountId,
            credentialsId,
            region,
            snapshotPolicy,
            jobId,
            (instanceMetadata ?? {}) as DatabaseInstanceMetadata,
            volumes
        );

        // clearning all the ssm command cache so that we will get the fresh data in assessment
        resetCache(SSM_COMMAND_CACHE_TYPE);
        // trigger assesment to update the assessment config data
        onDemandTriggerMssqlDriftAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            AssessmentTriggeredBy.SYSTEM,
            AssessmentCategories.SNAPSHOT_POLICY,
            jobId
        );
    }
    return { jobId };
}
async function getSharedStorage(accountId: string, instance: FlattenedInstanceType): Promise<any> {
    const [{ config_data: { sharedStorage } = {} } = {}] = await listInstanceConfigIncludingResourceAndInstance({
        accountId,
        region: instance.region,
        credentialsId: instance.credentialsId,
        resourceId: instance.databaseHostId,
        databaseInstanceId: instance.databaseInstanceId,
        configDataType: AssessmentCategories.HIGH_AVAILABILITY,
        pageSize: 1
    });
    return sharedStorage;
}

// --- Prepare optimization data for all hosts/instances ---
async function prepareHASharedStorageOptimizationData(
    accountId: string,
    hostsToOptimize: {
        configurationName: OptimizeHighAvailabilityParams;
        databaseHosts: OptimizeHASharedStorageRequestBodyType[];
    }[],
    ontapLunUuids: string[] | undefined
): Promise<OptimizationPreparationType[]> {
    const flattenedInstances: FlattenedInstanceType[] = hostsToOptimize.flatMap(host =>
        (host.databaseHosts || []).flatMap(databaseHost =>
            (databaseHost.sqlServerInstances || []).map(instance => ({
                ...instance,
                region: databaseHost.region,
                credentialsId: databaseHost.credentialsId,
                databaseHostId: databaseHost.id,
                databaseInstanceId: instance.databaseInstanceId
            }))
        )
    );

    const throttle = throat(3);

    const preparationsPromises = flattenedInstances.map(flattenedInstance =>
        throttle(async () => {
            const sharedStorage = await getSharedStorage(accountId, flattenedInstance);

            let allHostIqnsArr: string[] = [];
            if (Array.isArray(sharedStorage?.allHostIqns)) {
                allHostIqnsArr = sharedStorage.allHostIqns;
            } else if (typeof sharedStorage?.allHostIqns === 'string') {
                allHostIqnsArr = sharedStorage.allHostIqns.split(' ').filter(Boolean);
            }

            let lunsToOptimize: LunDetailType[] = [];
            if (Array.isArray(ontapLunUuids) && Array.isArray(sharedStorage?.lunDetails)) {
                lunsToOptimize = sharedStorage.lunDetails.filter((lun: LunDetailType) =>
                    ontapLunUuids.includes(lun.lunUuid)
                );
            }

            // --- Single igroup per LUN version ---
            const igroupMissingIqnsMap = new Map<string, { igroupName: string; missingIqns: Set<string> }>();

            for (const lun of lunsToOptimize) {
                // Get initiator names as array
                const initiatorNamesArr: string[] = Array.isArray(lun.initiatorNames)
                    ? lun.initiatorNames
                    : typeof lun.initiatorNames === 'string'
                    ? lun.initiatorNames.split(' ').filter(Boolean)
                    : [];

                // Find which IQNs are missing from this LUN's igroup
                const missingInitiators = allHostIqnsArr.filter(iqn => !initiatorNamesArr.includes(iqn));

                // Only process if igroupUuid is present
                if (typeof lun.igroupUuid === 'string') {
                    if (!igroupMissingIqnsMap.has(lun.igroupUuid)) {
                        igroupMissingIqnsMap.set(lun.igroupUuid, {
                            igroupName: lun.igroupName ?? '',
                            missingIqns: new Set()
                        });
                    }
                    const entry = igroupMissingIqnsMap.get(lun.igroupUuid)!;
                    missingInitiators.forEach(iqn => entry.missingIqns.add(iqn));
                }
            }

            return {
                instance: flattenedInstance,
                lunsToOptimize,
                allHostIqnsArr,
                igroupMissingIqnsMap
            } as OptimizationPreparationType;
        })
    );

    return Promise.all(preparationsPromises);
}

async function optimizeHASharedStorageData(
    igroupMissingIqnsMap: Map<string, { igroupName: string; missingIqns: Set<string> }>,
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    parentJobId?: string,
    sqlServerName?: string,
    instanceName?: string
): Promise<void> {
    const igroupUuidsToFetch = Array.from(igroupMissingIqnsMap.keys());
    if (igroupUuidsToFetch.length === 0) {
        return;
    }
    let subJobId = '';
    const serverNameWithHostName = getServerNameWithHostname(sqlServerName, instanceName);
    const { id } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.WELL_ARCHITECTED,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: serverNameWithHostName as string,
        name: `High Availability Shared Storage optimization for ${serverNameWithHostName}`,
        startTime: Date.now(),
        description: `High Availability Shared Storage optimization for ${serverNameWithHostName}`,
        parentJobId
    });
    subJobId = id;

    const { instanceRecord } = await getActiveNodeInfo(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    );
    const { fsxFileSystem, activeNodeInstanceid } = instanceRecord;
    if (!fsxFileSystem) {
        logger.error('FSx file system is not defined. Cannot add initiators to igroup.');
        return;
    }
    logger.info('igroupUuidsToFetch:', igroupUuidsToFetch);
    logger.info('igroupMissingIqnsMap:', Array.from(igroupMissingIqnsMap.entries()));
    const commands: string[] = [];
    for (const uuid of igroupUuidsToFetch) {
        const { missingIqns } = igroupMissingIqnsMap.get(uuid)!;
        missingIqns.forEach(iqn => {
            commands.push(ADD_INITIATOR_TO_IGROUP(fsxFileSystem, region, iqn, uuid));
        });
    }
    logger.info('Running SSM commands to add initiators to igroup:', { commands });
    try {
        await callSsmExecution(
            credentialsId,
            region,
            commands,
            activeNodeInstanceid,
            'Add initiators to igroup',
            accountId
        );
        await updateJobDetails(accountId, subJobId, {
            status: JOBSTATUS.COMPLETED,
            endTime: Date.now()
        });
    } catch (err) {
        const errorMessage = `Error while fixing shared storage for disk ${err}`;
        logger.error(errorMessage);
        await updateJobDetails(accountId, subJobId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function handleSharedStorageOptimize(
    accountId: string,
    ontapLunUuids: string[] | undefined,
    hostsToOptimize: {
        configurationName: OptimizeHighAvailabilityParams;
        databaseHosts: OptimizeHASharedStorageRequestBodyType[];
    }[],
    parentJobId: string
) {
    const preparations = await prepareHASharedStorageOptimizationData(accountId, hostsToOptimize, ontapLunUuids);

    if (preparations.length === 0) {
        logger.warn('No instances found to optimize shared storage.');
        return;
    }

    await Promise.all(
        preparations.map(async prep => {
            const { instance, igroupMissingIqnsMap } = prep;
            const { databaseInstanceId, region, credentialsId, databaseHostId } = instance;

            logger.info('Starting shared storage optimization.', {
                region,
                accountId,
                credentialsId,
                databaseInstanceId,
                databaseHostId,
                ontapLunUuidsLength: ontapLunUuids?.length,
                ontapLunUuids,
                parentJobId
            });

            // Check if there are any missing IQNs to add
            const hasMissingIqns = Array.from(igroupMissingIqnsMap.values()).some(
                entry =>
                    (entry as { missingIqns: Set<string> }).missingIqns &&
                    (entry as { missingIqns: Set<string> }).missingIqns.size > 0
            );

            if (hasMissingIqns) {
                await optimizeHASharedStorageData(
                    igroupMissingIqnsMap,
                    accountId,
                    credentialsId,
                    region,
                    databaseHostId,
                    databaseInstanceId
                );
            } else {
                logger.info('No missing IQNs found, skipping SSM execution and proceeding to drift assessment.');
            }

            // Always trigger drift assessment
            await onDemandTriggerMssqlDriftAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                AssessmentTriggeredBy.SYSTEM,
                AssessmentCategories.HIGH_AVAILABILITY,
                parentJobId
            );
        })
    );

    // Update parent job status and audit
    const status = await updateParentJobStatus(accountId, parentJobId);
    if (status === JOBSTATUS.COMPLETED) {
        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } else if (status === JOBSTATUS.FAILED) {
        updateLongRunningAuditGroup(
            AuditStatus.FAILED,
            `Error occurred while fixing High Availability for account ${accountId}`
        );
    }
}

export { getAvailableSnapshotPolicyList, handleResiliecyOptimize, handleSharedStorageOptimize };
