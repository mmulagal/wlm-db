import createError from 'http-errors';
import { isEmpty, isNil } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import throat from 'throat';
import getLogger from '../../../utils/logger';
import { OntapVolumeType } from '../../../routes/types/continuous-optimization.types';
import {
    AvailableSnapshotPoliciesResponseType,
    BulkOptimizeSnapshotPolicyRequestBody,
    OptimizeResiliencyBodyType,
    SnapshotPolicyDetailsType,
    SnapshotPolicyType,
    SnapshotScheduleType,
    BulkOptimizeSnapshotPolicyParamsType,
    BulkOptimizeHASharedStorageRequestBodyType
} from '../../../routes/types/mssql-continuous-optimisation.types';
import {
    DatabaseInstanceMetadata,
    Metadata,
    WorkloadInstance,
    MappedOnTapVolumeResponse,
    IgroupMissingInitiators,
    DatabaseInstance
} from '../../../utils/common-types';
import {
    AuditStatus,
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    HttpErrorCodes,
    RESOURCESTYPE,
    SqlServerDeploymentModel,
    SSM_COMMAND_CACHE_TYPE
} from '../../../utils/consts';
import {
    IS_DEMO_FLOW,
    getResourceNameFromTags,
    getServerNameWithHostname,
    retryWithDelay,
    sqlResponseParsing
} from '../../../utils/utils';
import { activeSqlNodeDetails } from '../../cont-opt-optimize-operations';
import { GET_CLUSTER_SNAPSHOT_POLICIES } from '../../workloads/mssql/assessment-scripts';
import { SET_VOLUME_SNAPSHOT_POLICY } from '../../workloads/mssql/optimization-scripts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { describeFSxStorageVirtualMachines } from '../../../lib/aws/fsx';
import { getMappedOntapVolumes, getMZFsxnNodePreference } from '../../aws/fsx-operations';
import { handleOptimizeJobCreation, JobMetadata } from '../assessment-utils';
import { registerJob, updateJobDetails, updateParentJobStatus } from '../../database/job-operations';
import { updateLongRunningAuditGroup } from '../../cloud-manager/audit-operations';
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

import {
    ADD_INITIATOR_TO_IGROUP,
    REMEDIATE_CLUSTER_QUORUM_SETTINGS,
    REMEDIATE_HEARTBEAT_SETTINGS,
    REMEDIATE_SQLSERVER_SERVICE_STARTUPTYPE
} from '../../workloads/mssql/high-availability-scripts';
import { paginateListInstanceConfigData } from '../../database/instance-config-operations';
import {
    getPaginatedDatabaseInstances,
    getResources,
    updateResourceMetaData
} from '../../database/database-operations';
import { moveClusterGroupOwnership } from '../compute-optimize-operations';
import { describeInstance } from '../../../lib/aws/ec2';

const logger = getLogger();

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
        const dbInstancesResult = await getPaginatedDatabaseInstances(accountId, {
            resourceId: databaseHostId,
            credentialsId,
            databaseInstanceId,
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
            if (IS_DEMO_FLOW) {
                return svm;
            }
            return svm?.StorageVirtualMachineId === (svmRecord as Record<string, string>)[fsxId];
        });
        if (!svmIdAssignedToInstance) {
            throw Error(`No SVM found for the given host ${databaseHostId} and instance ${databaseInstanceId}`);
        }

        const command = [GET_CLUSTER_SNAPSHOT_POLICIES(fsxId, region)];
        const ssmComment = 'Get available snapshot policies';
        const rawResponse = await callSsmExecution({
            credentialsId,
            region,
            commands: command,
            ec2InstanceId: activeNodeInstanceId,
            comment: ssmComment,
            accountId,
            shouldReadFromCloudWatchLogs: true
        });
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
                callSsmExecution.bind(null, {
                    credentialsId,
                    region,
                    commands: command,
                    ec2InstanceId: instanceRecord.activeNodeInstanceid,
                    comment: ssmComment,
                    accountId,
                    executionTimeout: CUSTOM_SSM_EXECUTION_TIMEOUT
                })
            );
            const { response: ssmResponse, error: ssmError } = sqlResponseParsing(response);
            if (!isEmpty(ssmError)) {
                logger.error('Error executing SSM command to set snapshot for volumes', ssmError, volumeUuids);
                jobError = `Failed to set snapshot policy for volumes: ${ssmError}`;
                jobStatus = JOBSTATUS.FAILED;
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, ssmError);
            }
            if (!IS_DEMO_FLOW && ssmResponse.length !== volumeUuids.length) {
                logger.error('Error setting snapshot policy for volumes. ONTAP job IDs:', ssmResponse, volumeUuids);
                jobError = `Failed to set snapshot policy for some volumes: ONTAP job IDs:', ${ssmResponse}`;
                jobStatus = JOBSTATUS.WARNING;
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Error setting snapshot policy for volumes');
            }
            jobStatus = JOBSTATUS.COMPLETED;
        }
        if (IS_DEMO_FLOW) {
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                instanceRecord.id,
                [OptimizeStorageConfigs.SNAPSHOT_POLICY],
                'STORAGE',
                instanceMetadata || ({} as DatabaseInstanceMetadata)
            );
            jobStatus = JOBSTATUS.COMPLETED;
        }
        if (!IS_DEMO_FLOW && missingVolumes.length > 0) {
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

interface LunDetail {
    lunUuid: string;
    lunName: string;
    igroupName: string;
    igroupUuid: string;
    initiatorNames: string[] | string;
}

async function optimizeHASharedStorageData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    igroupMissingIqnsMap: IgroupMissingInitiators[]
) {
    logger.info(`Optimizing shared storage for instance "${databaseInstanceId}" in account "${accountId}"`);

    let errorMessage;

    const { instanceRecord } = await getActiveNodeInfo(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    );

    const { fsxFileSystem, activeNodeInstanceid } = instanceRecord;
    if (!fsxFileSystem) {
        errorMessage = 'FSx file system is not defined. Cannot add initiators to igroup.';
        logger.error('Optimizing shared storage failed', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            errorMessage
        });
        throw createError(HttpErrorCodes.PRECONDITION_FAILED, errorMessage);
    }

    const response = await callSsmExecution({
        credentialsId,
        region,
        commands: [ADD_INITIATOR_TO_IGROUP(fsxFileSystem, region, igroupMissingIqnsMap)],
        ec2InstanceId: activeNodeInstanceid,
        comment: `Add initiators to igroup on instance ${activeNodeInstanceid}`,
        accountId
    });

    const parsedResponse = sqlResponseParsing(response);

    return parsedResponse;
}

function extractInstancesToOptimize(hostsToOptimize: BulkOptimizeHASharedStorageRequestBodyType[]) {
    return hostsToOptimize.flatMap(({ databaseHosts }) =>
        databaseHosts.flatMap(({ sqlServerInstances, region, credentialsId, id: databaseHostId }) =>
            sqlServerInstances.map(({ databaseInstanceId, ontapLunPaths }) => ({
                databaseInstanceId,
                ontapLunPaths,
                region,
                credentialsId,
                databaseHostId
            }))
        )
    );
}

async function handleSharedStorageOptimize(
    accountId: string,
    hostsToOptimize: BulkOptimizeHASharedStorageRequestBodyType[],
    parentJobId: string
) {
    logger.info(`Starting shared storage optimization for account "${accountId}"`);

    const flattenedInstances = extractInstancesToOptimize(hostsToOptimize);
    await Promise.all(
        flattenedInstances.map(
            throat(3, async ({ databaseInstanceId, region, credentialsId, databaseHostId, ontapLunPaths }) => {
                let errorMessage;
                let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
                const {
                    items: [persistedConfigurationData]
                } = await paginateListInstanceConfigData({
                    accountId,
                    region,
                    credentialsId,
                    resourceId: databaseHostId,
                    databaseInstanceId,
                    configDataType: AssessmentCategories.HIGH_AVAILABILITY,
                    includeDatabaseInstance: true,
                    includeResource: true
                });

                const {
                    config_data: configData,
                    database_instances: { database_instance_name: instanceName = '', metadata: instanceMetaData } = {},
                    resource: { resource_name: sqlServerName = '' } = {}
                } = persistedConfigurationData || {};

                const serverNameWithHostName = getServerNameWithHostname(sqlServerName!, instanceName);

                const { id: instanceOptimizeJobId } = await registerJob(accountId, credentialsId, region, {
                    type: JOBTYPE.WELL_ARCHITECTED,
                    status: JOBSTATUS.IN_PROGRESS,
                    resourceName: serverNameWithHostName as string,
                    name: `Fix shared storage for ${serverNameWithHostName}`,
                    startTime: Date.now(),
                    description: `Fix shared storage for ${serverNameWithHostName}`,
                    parentJobId
                });

                try {
                    if (!configData) {
                        errorMessage = 'Assessment record is missing';
                        logger.error(errorMessage);
                        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
                    }

                    const { sharedStorage: { lunDetails, allHostIqns } = {} } = configData;

                    if (isEmpty(lunDetails) || isEmpty(allHostIqns)) {
                        errorMessage = 'Lun details and (or) host iqns are missing.';
                        logger.error(errorMessage);
                        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
                    }

                    const igroupsMissingInitiators: IgroupMissingInitiators[] = [];
                    lunDetails
                        .filter(({ lunName }: LunDetail) => ontapLunPaths.includes(lunName))
                        .forEach(({ igroupName, igroupUuid, initiatorNames }: LunDetail) => {
                            if (!allHostIqns.every((iqn: string) => initiatorNames.includes(iqn))) {
                                igroupsMissingInitiators.push({
                                    igroupName,
                                    igroupUuid,
                                    missingIqns: allHostIqns.filter((iqn: string) => !initiatorNames.includes(iqn))
                                });
                            }
                        });

                    if (isEmpty(igroupsMissingInitiators)) {
                        errorMessage = 'All required initiators are part of igroups. No action required.';
                        logger.error(errorMessage);
                        jobStatus = JOBSTATUS.WARNING;
                        throw createError(HttpErrorCodes.PRECONDITION_FAILED, errorMessage);
                    }

                    const parsedResponse = await optimizeHASharedStorageData(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        igroupsMissingInitiators
                    );
                    errorMessage =
                        parsedResponse.error && parsedResponse.error.trim() !== '' ? parsedResponse.error : undefined;

                    jobStatus =
                        parsedResponse.result === 'failed'
                            ? JOBSTATUS.FAILED
                            : parsedResponse.result === 'partial'
                            ? JOBSTATUS.WARNING
                            : JOBSTATUS.COMPLETED;

                    if (IS_DEMO_FLOW) {
                        // update metadata in instances table to mark optimized configuration
                        await updateOptimizedConfigNameInInstanceTable(
                            accountId,
                            databaseInstanceId,
                            ['shared-storage'],
                            'HIGH_AVAILABILITY',
                            instanceMetaData as DatabaseInstanceMetadata
                        );
                    }

                    if (jobStatus !== JOBSTATUS.FAILED) {
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
                    }
                } catch (error: any) {
                    errorMessage = `${error.message}.`;
                    logger.error(`Optimizing shared storage failed with error ${errorMessage}`);
                    jobStatus = jobStatus !== JOBSTATUS.WARNING ? JOBSTATUS.FAILED : jobStatus;
                } finally {
                    await updateJobDetails(accountId, instanceOptimizeJobId, {
                        status: jobStatus,
                        endTime: Date.now(),
                        error: errorMessage
                    });
                }
            })
        )
    );

    // Update parent job status and audit
    const status = await updateParentJobStatus(accountId, parentJobId);
    if (status === JOBSTATUS.COMPLETED) {
        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } else if (status === JOBSTATUS.FAILED) {
        updateLongRunningAuditGroup(
            AuditStatus.FAILED,
            `An error occurred while optimizing High Availability for account "${accountId}".`
        );
    }
}

async function handleHeartbeatSettings(
    accountId: string,
    region: string,
    credentialsId: string,
    databaseHostId: string,
    databaseHostName: string,
    activeNodeInstanceId: string,
    databaseInstanceId: string,
    parentJobId: string,
    metadata: Metadata
) {
    logger.info('Starting heartbeat settings optimization', {
        accountId,
        region,
        credentialsId,
        databaseHostId,
        activeNodeInstanceId,
        databaseInstanceId,
        databaseHostName,
        parentJobId
    });

    let errorMessage;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    // Register a job for this host
    const { id: instanceOptimizeJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.WELL_ARCHITECTED,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: databaseHostName,
        name: `Fix heartbeat settings for ${databaseHostName}`,
        startTime: Date.now(),
        description: `Fix heartbeat settings for ${databaseHostName}`,
        parentJobId
    });

    try {
        // Call the remediation script
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [REMEDIATE_HEARTBEAT_SETTINGS],
            ec2InstanceId: activeNodeInstanceId,
            comment: `Remediate heartbeat settings on host ${databaseHostId}`,
            accountId
        });
        const parsedResponse = sqlResponseParsing(response);

        jobStatus =
            parsedResponse.status === 'failed'
                ? JOBSTATUS.FAILED
                : parsedResponse.status === 'partial'
                ? JOBSTATUS.WARNING
                : JOBSTATUS.COMPLETED;

        errorMessage =
            parsedResponse.errorMessage && parsedResponse.errorMessage.trim() !== ''
                ? parsedResponse.errorMessage
                : undefined;

        if (jobStatus === JOBSTATUS.COMPLETED) {
            logger.info(`Heartbeat settings successfully remediated for host "${databaseHostId}".`);
        } else if (jobStatus === JOBSTATUS.WARNING) {
            logger.warn(`Heartbeat settings partially remediated for host "${databaseHostId}". Please check details.`);
        } else {
            logger.error(`Failed to remediate heartbeat settings for host "${databaseHostId}".`);
        }

        if (IS_DEMO_FLOW) {
            metadata.isHeartBeatOptimized = true;
            updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
        }

        if (jobStatus !== JOBSTATUS.FAILED) {
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
        }
    } catch (error: any) {
        errorMessage = `${error.message}.`;
        logger.error(`Optimizing heartbeat settings failed for host "${databaseHostId}" with error: ${errorMessage}`);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, instanceOptimizeJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
    }
}

async function handleClusterQuorum(
    accountId: string,
    region: string,
    credentialsId: string,
    databaseHostId: string,
    databaseHostName: string,
    activeNodeInstanceId: string,
    databaseInstanceId: string,
    parentJobId: string,
    metadata: Metadata
) {
    logger.info('Starting cluster quorum optimization', {
        accountId,
        region,
        credentialsId,
        parentJobId,
        databaseHostName,
        activeNodeInstanceId,
        databaseInstanceId,
        databaseHostId
    });

    let errorMessage;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    // Register a job for this host
    const { id: instanceOptimizeJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.WELL_ARCHITECTED,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: databaseHostName,
        name: `Fix cluster quorum settings for ${databaseHostName}`,
        startTime: Date.now(),
        description: `Fix cluster quorum settings for ${databaseHostName}`,
        parentJobId
    });

    try {
        // Call the remediation script
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [REMEDIATE_CLUSTER_QUORUM_SETTINGS],
            ec2InstanceId: activeNodeInstanceId,
            comment: `Remediate cluster quorum settings on host ${activeNodeInstanceId}`,
            accountId
        });
        const parsedResponse = sqlResponseParsing(response);

        jobStatus =
            parsedResponse.status === 'failed'
                ? JOBSTATUS.FAILED
                : parsedResponse.status === 'partial'
                ? JOBSTATUS.WARNING
                : JOBSTATUS.COMPLETED;

        errorMessage = parsedResponse.error && parsedResponse.error.trim() !== '' ? parsedResponse.error : undefined;

        if (jobStatus === JOBSTATUS.COMPLETED) {
            logger.info(`Cluster quorum successfully remediated for host "${databaseHostId}".`);
        } else if (jobStatus === JOBSTATUS.WARNING) {
            logger.warn(`Cluster quorum partially remediated for host "${databaseHostId}". Please check details.`);
        } else {
            logger.error(`Failed to remediate cluster quorum for host "${databaseHostId}".`);
        }

        if (IS_DEMO_FLOW) {
            metadata.isClusterQuorumOptimized = true;
            updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
        }

        if (jobStatus !== JOBSTATUS.FAILED) {
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
        }
    } catch (error: any) {
        errorMessage = `${error.message}.`;
        logger.error(`Optimizing cluster quorum failed for host "${databaseHostId}" with error: ${errorMessage}`);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, instanceOptimizeJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
    }
}

async function optimizeHighAvailabilityConfiguration(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstances: string[],
    configurationName: string,
    masterOptimizeParentId: string
) {
    logger.info(
        `Optimizing high availability configurations for ${accountId}, ${credentialsId} ${databaseHostId} in ${region} for configuration ${configurationName}`
    );
    let errorMessage = '';
    const {
        items: [resourceDetail]
    } = await getResources({
        accountId,
        resourceId: databaseHostId,
        credentialsId,
        region,
        resourceType: RESOURCESTYPE.MSSQL,
        includeDatabaseInstances: true
    });

    if (isEmpty(resourceDetail)) {
        errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const { metadata, resource_name: sqlServerName } = resourceDetail;
    const { sqlDeploymentType = '', node1InstanceId, node2InstanceId } = metadata as Metadata;
    if (sqlDeploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT) {
        errorMessage = 'Standalone SQL Server deployment is not supported for high availability optimization.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }

    const { isSSMConnected, activeNodeInstanceId } = await getActiveSqlNode(credentialsId, region, {
        node1InstanceId,
        node2InstanceId
    });

    if (!isSSMConnected && activeNodeInstanceId === undefined) {
        errorMessage = `Unable to fix host ${sqlServerName} in account ${accountId} due to SSM connection issues.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    switch (configurationName) {
        case OptimizeHighAvailabilityParams.HEARTBEAT_SETTINGS: {
            try {
                await handleHeartbeatSettings(
                    accountId,
                    region,
                    credentialsId,
                    databaseHostId,
                    sqlServerName || '',
                    activeNodeInstanceId!,
                    databaseInstances[0],
                    masterOptimizeParentId,
                    metadata as Metadata
                );
                await updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            } catch (error) {
                errorMessage = `Error while fixing heartbeat settings ${error}`;
                logger.error(errorMessage);
                updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);

                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
            }
            break;
        }
        case OptimizeHighAvailabilityParams.CLUSTER_QUORUM: {
            try {
                await handleClusterQuorum(
                    accountId,
                    region,
                    credentialsId,
                    databaseHostId,
                    sqlServerName || '',
                    activeNodeInstanceId!,
                    databaseInstances[0],
                    masterOptimizeParentId,
                    metadata as Metadata
                );
                await updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            } catch (error) {
                errorMessage = `Error while fixing Cluster Quorum settings: ${error}`;
                logger.error(errorMessage);
                updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
            }
            break;
        }
        default: {
            errorMessage = `Invalid configuration name ${configurationName}`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
        }
    }
}

async function optimizeSqlServerService(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    masterOptimizeParentId: string
) {
    logger.info(
        `Starting SQL Server Service optimization for account "${accountId}" (credentialsId: "${credentialsId}", region: "${region}", databaseHostId: "${databaseHostId}", databaseInstanceId: "${databaseInstanceId}", parentJobId: "${masterOptimizeParentId}")`
    );
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    const {
        items: [resourceDetail]
    } = await getResources({
        accountId,
        resourceId: databaseHostId,
        credentialsId,
        region,
        resourceType: RESOURCESTYPE.MSSQL,
        includeDatabaseInstances: true
    });

    if (isEmpty(resourceDetail)) {
        errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    try {
        const { metadata: resourceMetadata, database_instances: databaseInstances } = resourceDetail;
        const { node1InstanceId, node2InstanceId } = resourceMetadata as Metadata;
        const instanceDetail = databaseInstances?.find(
            (instance: DatabaseInstance) => instance.database_instance_id === databaseInstanceId
        );
        if (!instanceDetail) {
            errorMessage = `No database instance by id ${databaseInstanceId} for ${accountId} is found.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
        }
        let fsxId: string | undefined;
        if (Array.isArray(instanceDetail.fsxn_ids)) {
            [fsxId] = instanceDetail.fsxn_ids;
        } else if (typeof instanceDetail.fsxn_ids === 'string') {
            [fsxId] = instanceDetail.fsxn_ids.split(',');
        }

        const { activeNodeInstanceId, standbyNodeInstanceId } = await getActiveSqlNode(credentialsId, region, {
            node1InstanceId,
            node2InstanceId,
            resourceId: databaseHostId,
            accountId
        });
        if (!activeNodeInstanceId || !standbyNodeInstanceId) {
            errorMessage = `Unable to fix host ${databaseHostId} in account ${accountId} due to SSM connection issues (activeNodeInstanceId or standbyNodeInstanceId missing).`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
        if (!fsxId) {
            errorMessage = `FSx ID is undefined for host ${databaseHostId} and instance ${databaseInstanceId}.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
        const {
            items: [persistedConfigurationData]
        } = await paginateListInstanceConfigData({
            accountId,
            region,
            credentialsId,
            resourceId: databaseHostId,
            databaseInstanceId,
            configDataType: AssessmentCategories.HIGH_AVAILABILITY,
            includeDatabaseInstance: true,
            includeResource: true
        });

        const {
            database_instances: { database_instance_name: instanceName = '', metadata: instanceMetadata } = {},
            resource: { resource_name: sqlServerName = '' } = {}
        } = persistedConfigurationData || {};

        const serverNameWithHostName = getServerNameWithHostname(sqlServerName!, instanceName);
        logger.info(
            `Optimizing SQL Server Service for sqlServerName "${sqlServerName}", instancename "${instanceName}" (server: "${serverNameWithHostName}")`
        );
        const [node1StartupTypeJobstatus, node2StartupTypeJobstatus, givebackJobstatus] = await Promise.all([
            handleSqlServerServiceBulkOptimizeStartUpType(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                activeNodeInstanceId,
                instanceName,
                serverNameWithHostName,
                masterOptimizeParentId
            ),
            handleSqlServerServiceBulkOptimizeStartUpType(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                standbyNodeInstanceId,
                instanceName,
                serverNameWithHostName,
                masterOptimizeParentId
            ),
            givebackClusterOwnership(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                masterOptimizeParentId,
                fsxId,
                activeNodeInstanceId,
                standbyNodeInstanceId,
                serverNameWithHostName
            )
        ]);

        if (IS_DEMO_FLOW) {
            // update metadata in instances table to mark optimized configuration
            await updateOptimizedConfigNameInInstanceTable(
                accountId,
                databaseInstanceId,
                ['sql-server-services'],
                'HIGH_AVAILABILITY',
                instanceMetadata as DatabaseInstanceMetadata
            );
        }

        if (
            node1StartupTypeJobstatus !== JOBSTATUS.FAILED ||
            node2StartupTypeJobstatus !== JOBSTATUS.FAILED ||
            givebackJobstatus !== JOBSTATUS.FAILED
        ) {
            logger.info(
                `Triggering drift assessment for SQL Server Service on host "${databaseHostId}", instance "${databaseInstanceId}".`
            );
            await onDemandTriggerMssqlDriftAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                AssessmentTriggeredBy.SYSTEM,
                AssessmentCategories.HIGH_AVAILABILITY,
                masterOptimizeParentId
            );
        } else if (!databaseInstanceId) {
            logger.warn(`databaseInstanceId not found for host ${databaseHostId}, instance ${databaseInstanceId}`);
        }
    } catch (error) {
        errorMessage = `An error occurred while optimizing SQL Server Service for high availability: ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        // Update parent job status and audit
        await updateParentJobStatus(accountId, masterOptimizeParentId, false, errorMessage);
        updateLongRunningAuditGroup(
            jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED,
            errorMessage
        );
    }
}

async function handleSqlServerServiceBulkOptimizeStartUpType(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    nodeInstanceId: string,
    instanceName: string,
    serverNameWithHostName: string,
    parentJobId: string
) {
    logger.info('Starting SQL Server Service optimization', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        parentJobId
    });

    let errorMessage;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    // Register a job for this host/instance
    let instanceOptimizeJobId: string | undefined;
    try {
        const { id } = await registerJob(accountId, credentialsId, region, {
            type: JOBTYPE.WELL_ARCHITECTED,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: `${serverNameWithHostName}`,
            name: `Fix SQL Server Service startup type for node "${nodeInstanceId}"`,
            startTime: Date.now(),
            description: `Fix SQL Server Service startup type for node "${nodeInstanceId}".`,
            parentJobId
        });
        instanceOptimizeJobId = id;
    } catch (err) {
        logger.error(`Failed to register job for SQL Server Service optimization on host "${nodeInstanceId}": ${err}`);
        throw err;
    }

    try {
        logger.info(`Running SQL Server Service remediation script on host "${nodeInstanceId}".`);
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [REMEDIATE_SQLSERVER_SERVICE_STARTUPTYPE],
            ec2InstanceId: nodeInstanceId,
            comment: `Fix SQL Server Service settings on host ${nodeInstanceId} and instance: ${instanceName})`,
            accountId
        });

        const parsedResponse = sqlResponseParsing(response);

        jobStatus =
            parsedResponse.status === 'failed'
                ? JOBSTATUS.FAILED
                : parsedResponse.status === 'partial'
                ? JOBSTATUS.WARNING
                : JOBSTATUS.COMPLETED;

        errorMessage = parsedResponse.errMsg && parsedResponse.errMsg.trim() !== '' ? parsedResponse.errMsg : undefined;

        if (jobStatus === JOBSTATUS.COMPLETED) {
            logger.info(
                `SQL Server Service successfully fixed for host "${nodeInstanceId}", instance "${databaseInstanceId}".`
            );
        } else if (jobStatus === JOBSTATUS.WARNING) {
            logger.warn(
                `SQL Server Service partially fixed for host "${nodeInstanceId}", instance "${databaseInstanceId}". Please check details.`
            );
        } else {
            logger.error(
                `Failed to remediate SQL Server Service for host "${nodeInstanceId}", instance "${databaseInstanceId}".`
            );
        }
    } catch (error: any) {
        errorMessage = `${error.message}.`;
        logger.error(
            `Optimizing SQL Server Service failed for host "${nodeInstanceId}", instance "${databaseInstanceId}" with error: ${errorMessage}`
        );
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, instanceOptimizeJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
        logger.info(
            `Job for SQL Server Service remediation on host "${nodeInstanceId}", instance "${databaseInstanceId}" completed with status "${jobStatus}".`
        );
    }
    return jobStatus;
}

async function givebackClusterOwnership(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    parentJobId: string,
    fsxFileSystemId: string,
    activeNodeInstanceId: string,
    standbyNodeInstanceId: string,
    serverNameWithHostName: string
) {
    logger.info(`Starting cluster ownership giveback for account "${accountId}"`);

    let errorMessage: string | undefined;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    // Register a job for the giveback operation
    const { id: givebackJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.WELL_ARCHITECTED,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: `${serverNameWithHostName}`,
        name: 'Giveback Cluster Ownership',
        startTime: Date.now(),
        description: 'Giveback Cluster Ownership',
        parentJobId
    });

    try {
        const { preferredNodeId, standbyNodeId } = await getMZFsxnNodePreference(
            accountId,
            credentialsId,
            region,
            activeNodeInstanceId,
            standbyNodeInstanceId,
            fsxFileSystemId
        );

        if (!preferredNodeId || !standbyNodeId) {
            throw new Error('Preferred or non-preferred node ID is not available.');
        }

        if (!activeNodeInstanceId) {
            throw new Error('activeNodeInstanceId is not available in metadata.');
        }

        logger.info(
            `Preferred node: ${preferredNodeId}, Non-preferred node: ${standbyNodeId}, Active node: ${activeNodeInstanceId}`
        );

        if (activeNodeInstanceId === preferredNodeId || IS_DEMO_FLOW) {
            // IS_DEMO_FLOW check is used to skip the giveback operation in demo mode
            jobStatus = JOBSTATUS.WARNING;
            errorMessage = `Cluster ownership is already on the preferred node (${preferredNodeId}).`;
        } else if (activeNodeInstanceId === standbyNodeId) {
            try {
                const { Reservations = [] } = await describeInstance(credentialsId, region, {
                    InstanceIds: [activeNodeInstanceId!, standbyNodeInstanceId!]
                });
                const preferredNodeName = getResourceNameFromTags(Reservations?.[0]?.Instances?.[0].Tags);

                if (!preferredNodeName) {
                    throw new Error(
                        'Unable to determine the preferred node name from EC2 instance. Please ensure the instance has the correct tags and try again.'
                    );
                }
                await moveClusterGroupOwnership(credentialsId, region, preferredNodeName, standbyNodeId);
                logger.info(`Successfully moved cluster ownership from ${standbyNodeId} to ${preferredNodeId}`);
            } catch (moveError: any) {
                const moveErrorMessage =
                    moveError?.message || moveError?.toString() || 'Error occurred during cluster ownership move';
                throw new Error(`Failed to move cluster ownership: ${moveErrorMessage}`);
            }
        } else {
            throw new Error(
                `Active node (${activeNodeInstanceId}) is not recognized as preferred (${preferredNodeId}) or non-preferred (${standbyNodeId}).`
            );
        }
    } catch (err: any) {
        errorMessage = err?.message || err?.toString() || 'Error occurred during cluster ownership giveback';
        logger.error(
            `Failed to give back cluster ownership for host "${databaseHostId}", instance "${databaseInstanceId}": ${errorMessage}`
        );
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, givebackJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
        logger.info(
            `Job for cluster ownership giveback on host "${databaseHostId}", instance "${databaseInstanceId}" completed with status "${jobStatus}".`
        );
    }
    return jobStatus;
}

export {
    getAvailableSnapshotPolicyList,
    handleResiliecyOptimize,
    handleSharedStorageOptimize,
    optimizeHighAvailabilityConfiguration,
    optimizeSqlServerService
};
