import createError from 'http-errors';
import { isEmpty, isNil } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import throat from 'throat';
import { DescribeInstancesCommandOutput } from '@aws-sdk/client-ec2';
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
    BulkOptimizeHASharedStorageRequestBodyType
} from '../../../routes/types/continuous-optimization.types';
import {
    DatabaseInstanceMetadata,
    Metadata,
    WorkloadInstance,
    MappedOnTapVolumeResponse,
    IgroupMissingInitiators
    // DatabaseInstance
} from '../../../utils/common-types';
import {
    AuditStatus,
    CUSTOM_SSM_EXECUTION_TIMEOUT,
    HttpErrorCodes,
    RESOURCESTYPE,
    SqlServerDeploymentModel,
    SSM_COMMAND_CACHE_TYPE
} from '../../../utils/consts';
import { activeSqlNodeDetails } from '../../cont-opt-optimize-operations';
import {
    GET_CLUSTER_SNAPSHOT_POLICIES,
    SET_VOLUME_SNAPSHOT_POLICY
} from '../../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../../aws/ssm-operations';
import {
    getServerNameWithHostname,
    isDemo,
    parseMultipleCommandResponse,
    retryWithDelay,
    sqlResponseParsing
} from '../../../utils/utils';
import { describeFSx, describeFSxStorageVirtualMachines } from '../../../lib/aws/fsx';
import { getMappedOntapVolumes } from '../../aws/fsx-operations';
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
    REMEDIATE_SQLSERVER_SERVICE_STARTUPTYPE,
    SQL_SERVER_SERVICES
} from '../../workloads/mssql/high-availability-scripts';
import { paginateListInstanceConfigData } from '../../database/instance-config-operations';
import { getPaginatedDatabaseInstances, getResources } from '../../database/database-operations';
import { describeInstance, describeSubnets } from '../../../lib/aws/ec2';
import { moveClusterGroupOwnership } from '../compute-optimize-operations';
import { listDatabaseInstances } from '../../../lib/database/db';

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
        const dbInstancesResult = await getPaginatedDatabaseInstances(accountId, {
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

    const response = await callSsmExecution(
        credentialsId,
        region,
        [ADD_INITIATOR_TO_IGROUP(fsxFileSystem, region, igroupMissingIqnsMap)],
        activeNodeInstanceid,
        `Add initiators to igroup on instance ${activeNodeInstanceid}`,
        accountId
    );

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
                    database_instances: { database_instance_name: instanceName = '' } = {},
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
                        .forEach(({ igroupName, initiatorNames }: LunDetail) => {
                            if (!allHostIqns.every((iqn: string) => initiatorNames.includes(iqn))) {
                                igroupsMissingInitiators.push({
                                    igroupName,
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

                    jobStatus =
                        parsedResponse.result === 'failed'
                            ? JOBSTATUS.FAILED
                            : parsedResponse.result === 'partial'
                            ? JOBSTATUS.WARNING
                            : JOBSTATUS.COMPLETED;

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

async function handleHeartbeatSettingsBulkOptimize(
    accountId: string,
    region: string,
    credentialsId: string,
    parentJobId: string,
    databaseHostId: string
) {
    logger.info('Starting heartbeat settings optimization', {
        accountId,
        region,
        credentialsId,
        databaseHostId,
        parentJobId
    });

    let errorMessage;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    logger.info(`Initiating heartbeat settings remediation for host "${databaseHostId}" in region "${region}".`);

    // Register a job for this host
    const { id: instanceOptimizeJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.WELL_ARCHITECTED,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: databaseHostId,
        name: `Fix heartbeat settings for ${databaseHostId}`,
        startTime: Date.now(),
        description: `Fix heartbeat settings for ${databaseHostId}`,
        parentJobId
    });

    try {
        logger.info(`Fetching instance configuration for host "${databaseHostId}" to remediate heartbeat settings.`);
        const {
            items: [instanceConfig]
        } = await paginateListInstanceConfigData({
            accountId,
            region,
            credentialsId,
            resourceId: databaseHostId,
            configDataType: AssessmentCategories.HIGH_AVAILABILITY,
            pageSize: 1,
            includeDatabaseInstance: true,
            includeResource: true
        });

        const {
            resource: { metadata = {} } = {},
            database_instances: { database_instance_id: databaseInstanceId } = {}
        } = instanceConfig || {};

        const { node1InstanceId } = metadata as Metadata;
        logger.info(
            `Running heartbeat settings remediation script on host "${databaseHostId}" (node: "${node1InstanceId}").`
        );
        // Call the remediation script
        const response = await callSsmExecution(
            credentialsId,
            region,
            [REMEDIATE_HEARTBEAT_SETTINGS],
            node1InstanceId,
            `Remediate heartbeat settings on host ${databaseHostId}`,
            accountId
        );
        const parsedResponse = sqlResponseParsing(response);

        jobStatus =
            parsedResponse.remediated === 'failed'
                ? JOBSTATUS.FAILED
                : parsedResponse.remediated === 'partial'
                ? JOBSTATUS.WARNING
                : JOBSTATUS.COMPLETED;

        if (jobStatus === JOBSTATUS.COMPLETED) {
            logger.info(`Heartbeat settings successfully remediated for host "${databaseHostId}".`);
        } else if (jobStatus === JOBSTATUS.WARNING) {
            logger.warn(`Heartbeat settings partially remediated for host "${databaseHostId}". Please check details.`);
        } else {
            logger.error(`Failed to remediate heartbeat settings for host "${databaseHostId}".`);
        }

        if (jobStatus !== JOBSTATUS.FAILED) {
            logger.info(`Triggering drift assessment for heartbeat settings on host "${databaseHostId}".`);
            await onDemandTriggerMssqlDriftAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId!,
                AssessmentTriggeredBy.SYSTEM,
                AssessmentCategories.HIGH_AVAILABILITY,
                parentJobId
            );
        } else if (!databaseInstanceId) {
            logger.warn(`databaseInstanceId not found for host ${databaseHostId}`);
        }
    } catch (error: any) {
        errorMessage = `${error.message}.`;
        logger.error(`Optimizing heartbeat settings failed for host "${databaseHostId}" with error: ${errorMessage}`);
        jobStatus = JOBSTATUS.FAILED;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    } finally {
        await updateJobDetails(accountId, instanceOptimizeJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
        logger.info(
            `Job for heartbeat settings remediation on host "${databaseHostId}" completed with status "${jobStatus}".`
        );
    }
}

async function handleClusterQuorumBulkOptimize(
    accountId: string,
    region: string,
    credentialsId: string,
    parentJobId: string,
    databaseHostId: string
) {
    logger.info('Starting cluster quorum optimization', {
        accountId,
        region,
        credentialsId,
        parentJobId,
        databaseHostId
    });

    let errorMessage;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    logger.info(`Initiating cluster quorum remediation for host "${databaseHostId}" in region "${region}".`);

    // Register a job for this host
    const { id: instanceOptimizeJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.WELL_ARCHITECTED,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: databaseHostId,
        name: `Fix cluster quorum settings for ${databaseHostId}`,
        startTime: Date.now(),
        description: `Fix cluster quorum settings for ${databaseHostId}`,
        parentJobId
    });

    try {
        logger.info(`Fetching instance configuration for host "${databaseHostId}" to remediate cluster quorum.`);
        const {
            items: [instanceConfig]
        } = await paginateListInstanceConfigData({
            accountId,
            region,
            credentialsId,
            resourceId: databaseHostId,
            configDataType: AssessmentCategories.HIGH_AVAILABILITY,
            pageSize: 1
        });
        const {
            resource: { metadata = {} } = {},
            database_instances: { database_instance_id: databaseInstanceId } = {}
        } = instanceConfig || {};

        const { node1InstanceId } = metadata as Metadata;

        logger.info(
            `Running cluster quorum remediation script on host "${databaseHostId}" (node: "${node1InstanceId}").`
        );
        // Call the remediation script
        const { instanceRecord } = await getActiveNodeInfo(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId!
        );
        const response = await callSsmExecution(
            credentialsId,
            region,
            [REMEDIATE_CLUSTER_QUORUM_SETTINGS],
            instanceRecord.activeNodeInstanceid,
            `Remediate cluster quorum settings on host ${instanceRecord.activeNodeInstanceid}`,
            accountId
        );
        const parsedResponse = sqlResponseParsing(response);

        jobStatus =
            parsedResponse.status === 'failed'
                ? JOBSTATUS.FAILED
                : parsedResponse.status === 'partial'
                ? JOBSTATUS.WARNING
                : JOBSTATUS.COMPLETED;
        if (jobStatus === JOBSTATUS.COMPLETED) {
            logger.info(`Cluster quorum successfully remediated for host "${databaseHostId}".`);
        } else if (jobStatus === JOBSTATUS.WARNING) {
            logger.warn(`Cluster quorum partially remediated for host "${databaseHostId}". Please check details.`);
        } else {
            logger.error(`Failed to remediate cluster quorum for host "${databaseHostId}".`);
        }

        if (jobStatus !== JOBSTATUS.FAILED) {
            logger.info(`Triggering drift assessment for cluster quorum on host "${databaseHostId}".`);
            await onDemandTriggerMssqlDriftAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId!,
                AssessmentTriggeredBy.SYSTEM,
                AssessmentCategories.HIGH_AVAILABILITY,
                parentJobId
            );
        } else if (!databaseInstanceId) {
            logger.warn(`databaseInstanceId not found for host ${databaseHostId}`);
        }
    } catch (error: any) {
        errorMessage = `${error.message}.`;
        logger.error(`Optimizing cluster quorum failed for host "${databaseHostId}" with error: ${errorMessage}`);
        jobStatus = JOBSTATUS.FAILED;
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    } finally {
        await updateJobDetails(accountId, instanceOptimizeJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
        logger.info(
            `Job for cluster quorum remediation on host "${databaseHostId}" completed with status "${jobStatus}".`
        );
    }
}

async function optimizeHighAvailabilityConfiguration(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    configurationName: string,
    masterOptimizeParentId: string
) {
    logger.info(
        `Optimizing high availability configurations for ${accountId}, ${credentialsId} ${databaseHostId} in ${region} for configuration ${configurationName}`
    );

    const {
        items: [resourceDetail]
    } = await getResources({
        accountId,
        resourceId: databaseHostId,
        credentialsId,
        region,
        resourceType: RESOURCESTYPE.MSSQL
    });

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const { metadata } = resourceDetail;
    const { sqlDeploymentType = '' } = metadata as unknown as Metadata;
    if (sqlDeploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT) {
        const errorMessage = 'Standalone SQL Server deployment is not supported for high availability optimization.';
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }

    switch (configurationName) {
        case OptimizeHighAvailabilityParams.HEARTBEAT_SETTINGS: {
            try {
                await handleHeartbeatSettingsBulkOptimize(
                    accountId,
                    region,
                    credentialsId,
                    masterOptimizeParentId,
                    databaseHostId
                );
                await updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            } catch (error) {
                const errorMessage = `Error while fixing heartbeat settings ${error}`;
                logger.error(errorMessage);
                updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);

                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
            }
            break;
        }
        case OptimizeHighAvailabilityParams.CLUSTER_QUORUM: {
            try {
                await handleClusterQuorumBulkOptimize(
                    accountId,
                    region,
                    credentialsId,
                    masterOptimizeParentId,
                    databaseHostId
                );
                await updateLongRunningAuditGroup(AuditStatus.SUCCESS);
            } catch (error) {
                const errorMessage = `Error while fixing Cluster Quorum settings: ${error}`;
                logger.error(errorMessage);
                updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
            }
            break;
        }
        default: {
            const errorMessage = `Invalid configuration name ${configurationName}`;
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
    configurationName: string,
    masterOptimizeParentId: string
) {
    logger.info(
        `Starting SQL Server Service optimization for account "${accountId}" (credentialsId: "${credentialsId}", region: "${region}", databaseHostId: "${databaseHostId}", databaseInstanceId: "${databaseInstanceId}", configurationName: "${configurationName}", parentJobId: "${masterOptimizeParentId}")`
    );

    const {
        items: [resourceDetail]
    } = await getResources({
        accountId,
        resourceId: databaseHostId,
        credentialsId,
        region,
        resourceType: RESOURCESTYPE.MSSQL
    });

    if (isEmpty(resourceDetail)) {
        const errorMessage = `No database host by id ${databaseHostId} for ${accountId} is found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    try {
        const [persistedConfigurationData] = await listInstanceConfigIncludingResourceAndInstance({
            accountId,
            region,
            credentialsId,
            resourceId: databaseHostId,
            databaseInstanceId,
            configDataType: AssessmentCategories.HIGH_AVAILABILITY,
            pageSize: 1
        });

        const instanceName = persistedConfigurationData?.database_instances?.database_instance_name ?? '';
        const metadata = (persistedConfigurationData?.resource?.metadata as Metadata) ?? {};
        const node1InstanceId = metadata?.node1InstanceId ?? '';
        const fsxid = persistedConfigurationData?.database_instances?.fsxn_ids ?? '';

        await handleSqlServerServiceBulkOptimizeStartUpType(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            masterOptimizeParentId,
            node1InstanceId
        );

        await givebackClusterOwnership(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            masterOptimizeParentId,
            fsxid,
            instanceName
        );
    } catch (error) {
        const errorMessage = `An error occurred while optimizing SQL Server Service for high availability: ${error}`;
        logger.error(errorMessage);
        await updateJobDetails(accountId, masterOptimizeParentId, {
            status: JOBSTATUS.FAILED,
            endTime: Date.now(),
            error: errorMessage
        });
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
    return { jobId: masterOptimizeParentId };
}

async function handleSqlServerServiceBulkOptimizeStartUpType(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    parentJobId: string,
    node1InstanceId: string
) {
    logger.info(`Starting SQL Server Service optimization for account "${accountId}"`);

    let errorMessage;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    logger.info(
        `Initiating SQL Server Service remediation for host "${databaseHostId}", instance "${databaseInstanceId}".`
    );

    // Register a job for this host/instance
    let instanceOptimizeJobId: string | undefined;
    try {
        const { id } = await registerJob(accountId, credentialsId, region, {
            type: JOBTYPE.WELL_ARCHITECTED,
            status: JOBSTATUS.IN_PROGRESS,
            resourceName: `${databaseHostId}:${databaseInstanceId}`,
            name: `Optimize SQL Server Service Start Type for ${databaseHostId} (instance: ${databaseInstanceId})`,
            startTime: Date.now(),
            description: `Optimize SQL Server Service Start Type for ${databaseHostId} (instance: ${databaseInstanceId})`,
            parentJobId
        });
        instanceOptimizeJobId = id;
    } catch (err) {
        logger.error(
            `Failed to register job for SQL Server Service optimization on host "${databaseHostId}", instance "${databaseInstanceId}": ${err}`
        );
        throw err;
    }

    try {
        logger.info(
            `Running SQL Server Service remediation script on host "${databaseHostId}" (instance: "${databaseInstanceId}", node: "${node1InstanceId}").`
        );
        // Call the remediation script
        const { instanceRecord } = await getActiveNodeInfo(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId
        );
        const response = await callSsmExecution(
            credentialsId,
            region,
            [REMEDIATE_SQLSERVER_SERVICE_STARTUPTYPE],
            instanceRecord.activeNodeInstanceid,
            `Remediate SQL Server Service settings on host ${instanceRecord.activeNodeInstanceid} (instance: ${databaseInstanceId})`,
            accountId
        );

        const parsedResponse = sqlResponseParsing(response);

        jobStatus =
            parsedResponse.status === 'failed'
                ? JOBSTATUS.FAILED
                : parsedResponse.status === 'partial'
                ? JOBSTATUS.WARNING
                : JOBSTATUS.COMPLETED;
        if (jobStatus === JOBSTATUS.COMPLETED) {
            logger.info(
                `SQL Server Service successfully remediated for host "${databaseHostId}", instance "${databaseInstanceId}".`
            );
        } else if (jobStatus === JOBSTATUS.WARNING) {
            logger.warn(
                `SQL Server Service partially remediated for host "${databaseHostId}", instance "${databaseInstanceId}". Please check details.`
            );
        } else {
            logger.error(
                `Failed to remediate SQL Server Service for host "${databaseHostId}", instance "${databaseInstanceId}".`
            );
        }

        if (jobStatus !== JOBSTATUS.FAILED) {
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
                parentJobId
            );
        } else if (!databaseInstanceId) {
            logger.warn(`databaseInstanceId not found for host ${databaseHostId}, instance ${databaseInstanceId}`);
        }
    } catch (error: any) {
        errorMessage = `${error.message}.`;
        logger.error(
            `Optimizing SQL Server Service failed for host "${databaseHostId}", instance "${databaseInstanceId}" with error: ${errorMessage}`
        );
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, instanceOptimizeJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
        logger.info(
            `Job for SQL Server Service remediation on host "${databaseHostId}", instance "${databaseInstanceId}" completed with status "${jobStatus}".`
        );
    }

    // Update parent job status and audit
    const status = await updateParentJobStatus(accountId, parentJobId);
    if (status === JOBSTATUS.COMPLETED) {
        logger.info(`SQL Server Service optimization completed successfully for account "${accountId}".`);
        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } else if (status === JOBSTATUS.FAILED) {
        logger.error(`An error occurred while optimizing SQL Server Service for account "${accountId}".`);
        updateLongRunningAuditGroup(
            AuditStatus.FAILED,
            `An error occurred while optimizing SQL Server Service for account "${accountId}".`
        );
    } else {
        logger.warn(`SQL Server Service optimization finished with status "${status}" for account "${accountId}".`);
    }
}

async function givebackClusterOwnership(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    parentJobId: string,
    fsxFileSystemId: string,
    instanceName: string
): Promise<void> {
    logger.info(`Starting cluster ownership giveback for account "${accountId}"`);

    let errorMessage: string | undefined;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    // Register a job for the giveback operation
    const { id: givebackJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.WELL_ARCHITECTED,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: `${databaseHostId}:${databaseInstanceId}`,
        name: `Giveback Cluster Ownership for ${databaseHostId} (instance: ${databaseInstanceId})`,
        startTime: Date.now(),
        description: `Giveback cluster group ownership to original primary node for ${databaseHostId} (instance: ${databaseInstanceId})`,
        parentJobId
    });

    try {
        const dbInstancesResult: any = await listDatabaseInstances(accountId, {
            resourceId: databaseHostId,
            credentialsId,
            sqlInstanceId: databaseInstanceId,
            region,
            shouldIncludeResource: true
        });
        const dbInstances = Array.isArray(dbInstancesResult) ? dbInstancesResult : dbInstancesResult?.items || [];
        const [
            {
                resource: { metadata }
            }
        ] = dbInstances;
        const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
        const [{ subnetId: fsxPreferredSubnetId, availabilityZone: fsxPreferredAZ }, node1Net, node2Net] =
            await Promise.all([
                getFSXPreferredSubnetAndAZ(credentialsId, region, fsxFileSystemId, accountId),
                getInstanceSubnetAndAZ(credentialsId, region, node1InstanceId),
                (() => {
                    if (!node2InstanceId) {
                        throw new Error('node2InstanceId is undefined.');
                    }
                    return getInstanceSubnetAndAZ(credentialsId, region, node2InstanceId);
                })()
            ]);

        // Determine preferred node
        let preferredNodeId: string | undefined;
        let nonPreferredNodeId: string | undefined;
        if (node1Net.subnetId === fsxPreferredSubnetId && node1Net.availabilityZone === fsxPreferredAZ) {
            preferredNodeId = node1InstanceId;
            nonPreferredNodeId = node2InstanceId;
        } else if (node2Net.subnetId === fsxPreferredSubnetId && node2Net.availabilityZone === fsxPreferredAZ) {
            preferredNodeId = node2InstanceId;
            nonPreferredNodeId = node1InstanceId;
        } else {
            throw new Error('Neither node is in the FSx preferred subnet and AZ.');
        }

        if (!preferredNodeId || !nonPreferredNodeId) {
            throw new Error('Preferred or non-preferred node ID is not available.');
        }

        // Check SQL Server service status on both nodes
        const [preferredNodeSqlStatus, nonPreferredNodeSqlStatus] = await Promise.all([
            getSqlServiceStatus(credentialsId, region, preferredNodeId, instanceName),
            getSqlServiceStatus(credentialsId, region, nonPreferredNodeId, instanceName)
        ]);
        logger.info(
            `SQL Server service status: preferred node (${preferredNodeId}) is "${preferredNodeSqlStatus}", non-preferred node (${nonPreferredNodeId}) is "${nonPreferredNodeSqlStatus}".`
        );
        if (preferredNodeSqlStatus === 'running' && nonPreferredNodeSqlStatus === 'stopped') {
            logger.info(
                `Optimized: SQL Server running on preferred node (${preferredNodeId}), stopped on non-preferred (${nonPreferredNodeId}).`
            );
            jobStatus = JOBSTATUS.COMPLETED;
            return;
        }
        if (preferredNodeSqlStatus === 'stopped' && nonPreferredNodeSqlStatus === 'running') {
            logger.info(
                `SQL Server running on non-preferred node (${nonPreferredNodeId}). Moving ownership to preferred node (${preferredNodeId}).`
            );
            logger.info(
                `Initiating giveback Cluster Ownership for host "${databaseHostId}", instance "${databaseInstanceId}".`
            );
            const result = await moveClusterGroupOwnership(credentialsId, region, preferredNodeId, nonPreferredNodeId);
            logger.info('Cluster ownership moved to preferred node.', {
                from: nonPreferredNodeId,
                to: preferredNodeId,
                result
            });
        } else {
            throw new Error(
                `Unexpected SQL Server status: preferred (${preferredNodeId}) is "${preferredNodeSqlStatus}", non-preferred (${nonPreferredNodeId}) is "${nonPreferredNodeSqlStatus}".`
            );
        }
    } catch (err: any) {
        errorMessage = `${err.message}.`;
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

    // Update parent job status and audit
    const status = await updateParentJobStatus(accountId, parentJobId);
    if (status === JOBSTATUS.COMPLETED) {
        logger.info(`Cluster ownership giveback completed successfully for account "${accountId}".`);
        updateLongRunningAuditGroup(AuditStatus.SUCCESS);
    } else if (status === JOBSTATUS.FAILED) {
        logger.error(`Error during cluster ownership giveback for account "${accountId}".`);
        updateLongRunningAuditGroup(
            AuditStatus.FAILED,
            `An error occurred during cluster ownership giveback for account "${accountId}".`
        );
    } else {
        logger.warn(`Cluster ownership giveback finished with status "${status}" for account "${accountId}".`);
    }
}

async function getSqlServiceStatus(
    credentialsId: string,
    region: string,
    instanceId: string,
    instanceName: string
): Promise<'running' | 'stopped'> {
    // Prepare the SSM command for SQL Server services
    const commands = [SQL_SERVER_SERVICES(instanceName)];
    const rawResponses = await callSsmExecution(
        credentialsId,
        region,
        commands,
        instanceId,
        `Fetch SQL Server service status for instance ${instanceName} on node ${instanceId}`,
        undefined,
        false,
        undefined,
        true
    );

    // Parse the SSM output
    const [parsedSqlServiceData] = parseMultipleCommandResponse(rawResponses);

    let services: any[] = [];
    services = Array.isArray(parsedSqlServiceData)
        ? parsedSqlServiceData
        : parsedSqlServiceData
        ? [parsedSqlServiceData]
        : [];

    // If any SQL Server service is running, return "running"
    const isRunning = services.some((svc: any) =>
        typeof svc.Status === 'string' ? svc.Status.toLowerCase() === 'running' : svc.Status === 4
    );

    return isRunning ? 'running' : 'stopped';
}

async function getFSXPreferredSubnetAndAZ(
    credentialsId: string,
    region: string,
    fileSystemId: string,
    accountId: string
) {
    // 1. Fetch FSx info
    const fsxnInfo = await describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId] }, accountId, {
        useCache: true
    });
    logger.info(`FSx info for file system ${fileSystemId}:`, fsxnInfo);

    // 2. Extract the preferred subnet ID
    const fsx = fsxnInfo?.FileSystems?.[0];
    const preferredSubnetId = fsx?.OntapConfiguration?.PreferredSubnetId;
    if (!preferredSubnetId) {
        throw new Error('PreferredSubnetId not found in FSx OntapConfiguration.');
    }

    // 3. Fetch subnet info using your helper
    const { Subnets } = await describeSubnets(credentialsId, region, { SubnetIds: [preferredSubnetId] });
    const subnet = Subnets?.[0];
    if (!subnet || !subnet.AvailabilityZone) {
        throw new Error('Subnet or Availability Zone not found.');
    }

    // 4. Return the result
    return {
        subnetId: preferredSubnetId,
        availabilityZone: subnet.AvailabilityZone
    };
}

async function getInstanceSubnetAndAZ(
    credentialsId: string,
    region: string,
    instanceId: string
): Promise<{ subnetId: string; availabilityZone: string }> {
    const ec2Info: DescribeInstancesCommandOutput = await describeInstance(
        credentialsId,
        region,
        { InstanceIds: [instanceId] },
        { useCache: true }
    );
    const reservation = ec2Info.Reservations?.[0];
    const instance = reservation?.Instances?.[0];
    if (!instance || !instance.SubnetId || !instance.Placement?.AvailabilityZone) {
        throw new Error(`Could not find subnet or AZ for instance ${instanceId}`);
    }
    return {
        subnetId: instance.SubnetId,
        availabilityZone: instance.Placement.AvailabilityZone
    };
}

export {
    getAvailableSnapshotPolicyList,
    handleResiliecyOptimize,
    handleSharedStorageOptimize,
    handleHeartbeatSettingsBulkOptimize,
    handleClusterQuorumBulkOptimize,
    optimizeHighAvailabilityConfiguration,
    optimizeSqlServerService
};
