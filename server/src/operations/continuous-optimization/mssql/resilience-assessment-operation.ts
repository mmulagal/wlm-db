import createError from 'http-errors';
import moment from 'moment';
import { compact, isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import {
    DriftAssessmentResponseType,
    GenericAssessmentResponseType,
    OntapVolumeType,
    ParameterDriftResponseType
} from '../../../routes/types/continuous-optimization.types';
import getLogger from '../../../utils/logger';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import {
    AssessmentCategories,
    AssessmentStatus,
    OptimizeStorageConfigs,
    SEVERITY,
    AwsWellArchitecturedPillars,
    ASSESSMENT_RESOURCE_TYPE
} from '../../../utils/continous-optimization-consts';
import storageGoldenConfigData from '../golden-configs/storage';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE, HttpErrorCodes } from '../../../utils/consts';
import {
    DatabaseInstance,
    DatabaseInstanceMetadata,
    StorageAssessment,
    WorkloadInstance,
    MappedOnTapVolumeResponse,
    AWSBackupAssessment,
    CrrAssessment,
    CrrDetails,
    HighAvailabilityAssessment
} from '../../../utils/common-types';
import { isDemo, sqlResponseParsing } from '../../../utils/utils';
import { getInstanceInfo } from '../../database/database-operations';
import { describeFSx } from '../../../lib/aws/fsx';
import { CROSS_REGION_REPLICATION_SCRIPT } from '../../workloads/mssql/resiliency-scripts';
import {
    FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS,
    GET_SNAPSHOT_DETAILS
} from '../../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { isFsxnAwsBackupEnabled } from '../../aws/fsx-operations';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import {
    CLUSTER_QUORUM_TYPE,
    SQL_SERVER_SERVICES,
    DRIVE_LETTER,
    HEARTBEAT_SETTINGS,
    GET_HOST_IQN,
    GET_LUN_MAPS,
    GET_IGROUP_UUID
} from '../../workloads/mssql/high-availability-scripts';
import { getActiveSqlNode } from '../../workloads/mssql/mssql-operations';

const isDemoFlow = isDemo();
const logger = getLogger();

function filterDataLogVolumes(instanceVolumeMapping: MappedOnTapVolumeResponse) {
    const volumeRecords =
        Object.values(instanceVolumeMapping)
            ?.map(i => i?.volumeRecords)
            .flat() || [];
    const volumeDBMap =
        Object.values(instanceVolumeMapping)
            ?.map(i => i?.volumeDBMap)
            .flat() || [];

    // Ignore tempdb volumes from resiliency assessment. If tempdb volume has a user database, it will be included in assessment.
    const nonTempDBVolumeUuids = [
        ...new Set(volumeDBMap.filter(volume => volume.databaseName !== 'tempdb').map(volume => volume.ontapVolumeuuid))
    ];
    const dataLogVolumeUuids = [
        ...new Set(
            volumeRecords.filter(volume => nonTempDBVolumeUuids.includes(volume.uuid)).map(volume => volume.uuid)
        )
    ];
    const dataLogVolumeNames = [
        ...new Set(
            volumeRecords
                .filter(volume => dataLogVolumeUuids.includes(volume.uuid as string))
                .map(volume => volume.name as string)
        )
    ];
    return { dataLogVolumeUuids, dataLogVolumeNames };
}

function getVolumesWithoutSnapshotPolicy(volumes: Array<{ Key?: string; Value?: string }> = []) {
    // if instance has volumes in violation list for snapshot-policy, collect snapshot copy data for additional checks.
    const violations: string[] = [];
    volumes.forEach((volDetails: Record<string, string>) => {
        if (
            isEmpty(volDetails[OptimizeStorageConfigs?.SNAPSHOT_POLICY]) ||
            volDetails[OptimizeStorageConfigs?.SNAPSHOT_POLICY] === 'none'
        ) {
            violations.push(volDetails?.name);
        }
    });
    return violations;
}

async function collectVolumeSnapshotCopiesData(
    credentialsId: string,
    accountId: string,
    instanceRecord: WorkloadInstance,
    volumeAssessmentData: Array<{ Key?: string; Value?: string }>,
    violations: string[]
) {
    logger.info('Checking for volume snapshot copies:', { volumeAssessmentData, violations });
    try {
        const { region } = instanceRecord;
        const fsxId = instanceRecord.fsxFileSystem.split(',')[0];
        const volumesToCheck = volumeAssessmentData
            .filter((vol: Record<string, string>) => violations?.includes(vol?.name))
            .map((vol: Record<string, string>) => vol?.uuid);

        const command = [GET_SNAPSHOT_DETAILS(volumesToCheck, fsxId, region)];
        const ssmComment = 'Get snapshot copy details for volumes';
        const rawResponse = await callSsmExecution(
            credentialsId,
            instanceRecord.region,
            command,
            instanceRecord.activeNodeInstanceid,
            ssmComment,
            accountId,
            true,
            undefined,
            true
        );
        const { response: ssmResponse, error: ssmError } = sqlResponseParsing(rawResponse);
        if (!isEmpty(ssmError)) {
            throw Error(
                `Error executing SSM command to retrieve snapshot copy details for volumes: ${volumesToCheck}. Error: ${ssmError}`
            );
        }
        return ssmResponse;
    } catch (error) {
        // Any error caught here shall not fail the resilience assessment as it is an additional check.
        logger.error('Error checking for volume snapshot copies', error);
    }
}

async function collectSnapshotCopyData(
    accountId: string,
    credentialsId: string,
    instanceRecord: WorkloadInstance,
    volumes: Array<{ Key?: string; Value?: string }> = []
) {
    logger.info('Collecting snapshot copy data for volumes:', instanceRecord?.name, volumes);
    const violatedVols = getVolumesWithoutSnapshotPolicy(volumes);
    try {
        if (violatedVols.length) {
            const res = await collectVolumeSnapshotCopiesData(
                credentialsId,
                accountId,
                instanceRecord,
                volumes,
                violatedVols
            );
            volumes.forEach((volDetail: Record<string, string>) => {
                const snapshotTimestamp = new Date(res?.[volDetail?.uuid]?.create_time).getTime().toString();
                volDetail[OptimizeStorageConfigs.MOST_RECENT_SNAPSHOT_TIMESTAMP] = snapshotTimestamp ?? null;
            });
        }
        return volumes;
    } catch (error) {
        // this is data collection for additional checks, don't throw error from here
        logger.error(
            'Error checking for volume snapshot objects details, using snapshot policy data for assessment',
            error
        );
    }
}

async function getResilienceDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fieldsValues: string[] = [],
    databaseInstanceConfigData: Array<{ config_data_type: string; config_data: any }> = []
) {
    logger.info('Getting resilience drift assessment for:', {
        credentialsId,
        databaseInstanceId,
        databaseHostId,
        fieldsValues
    });
    const shouldTriggerSnapshotPolicyAssessment =
        isEmpty(fieldsValues) || fieldsValues.includes(AssessmentCategories.SNAPSHOT_POLICY);
    const shouldTriggerCrrAssessment = isEmpty(fieldsValues) || fieldsValues.includes(AssessmentCategories.CRR);
    const shouldTriggerAwsBackupAssessment =
        isEmpty(fieldsValues) || fieldsValues.includes(AssessmentCategories.AWS_BACKUP);
    const shouldTriggerHighAvailabilityAssessment =
        isEmpty(fieldsValues) || fieldsValues.includes(AssessmentCategories.HIGH_AVAILABILITY);

    // filter out the config data which is not required for assessment and listDatabaseInstanceConfigData returns in descending order of creation time
    const configDataMap = databaseInstanceConfigData.reduce((acc, config) => {
        if (!acc[config.config_data_type]) {
            acc[config.config_data_type] = config.config_data;
        }
        return acc;
    }, {} as Record<string, any>);

    const mappedVolumesData = configDataMap[AssessmentCategories.MAPPED_ONTAP_VOLUMES];
    const storageAssessmentData = configDataMap[AssessmentCategories.STORAGE];
    const awsbackupAssessmentData = configDataMap[AssessmentCategories.AWS_BACKUP];
    const crrAssessmentData = configDataMap[AssessmentCategories.CRR];
    const highAvailabilityAssessmentData = configDataMap[AssessmentCategories.HIGH_AVAILABILITY];

    try {
        const [snapshotPolicy, crrData, awsBackup, haChecks] = await Promise.all([
            shouldTriggerSnapshotPolicyAssessment
                ? getSnapshotPolicyDriftData(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      mappedVolumesData,
                      storageAssessmentData as unknown as StorageAssessment
                  )
                : Promise.resolve(undefined),
            shouldTriggerCrrAssessment
                ? getCrrDriftData(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      crrAssessmentData as unknown as CrrAssessment
                  )
                : Promise.resolve(undefined),
            shouldTriggerAwsBackupAssessment
                ? getAwsBackupDriftData(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      awsbackupAssessmentData as unknown as AWSBackupAssessment
                  )
                : Promise.resolve(undefined),
            shouldTriggerHighAvailabilityAssessment
                ? getHighAvailabilityDriftData(
                      accountId,
                      credentialsId,
                      region,
                      databaseHostId,
                      databaseInstanceId,
                      highAvailabilityAssessmentData
                  )
                : Promise.resolve(undefined)
        ]);

        const assessmentData: DriftAssessmentResponseType = {
            snapshotPolicy,
            crr: crrData,
            awsBackup: awsBackup as ParameterDriftResponseType,
            highAvailability: haChecks as ParameterDriftResponseType[]
        };
        return assessmentData;
    } catch (error) {
        logger.error('Error getting resilience drift assessment', JSON.stringify(error));
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, JSON.stringify(error));
    }
}

async function getSnapshotPolicyDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    mappedVolumesData: MappedOnTapVolumeResponse[],
    storageAssessmentData: StorageAssessment
): Promise<GenericAssessmentResponseType> {
    logger.info('Calculate snapshot policy drift data for:', {
        accountId,
        credentialsId,
        region,
        databaseInstanceId,
        databaseHostId
    });
    let errorMessage;
    const snapshotPolicyAssessmentData: ParameterDriftResponseType = {
        ...storageGoldenConfigData.resiliency.snapshotPolicy,
        name: AssessmentCategories.SNAPSHOT_POLICY,
        status: AssessmentStatus.NOT_OPTIMIZED,
        objectsInViolation: [],
        totalObjectsInViolation: 0
    };
    try {
        if (isEmpty(storageAssessmentData)) {
            errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.SNAPSHOT_POLICY);
            return { errorMessage };
        }

        const { volumes, errors } = storageAssessmentData as unknown as StorageAssessment;

        if (errors?.volumes) {
            return { errorMessage: errors.volumes };
        }

        // Check if mapped volumes data is available and filter out only data and log volumes
        let dataLogVolumeUuids: string[] = [];
        if (!isEmpty(mappedVolumesData)) {
            ({ dataLogVolumeUuids } = filterDataLogVolumes(mappedVolumesData as unknown as MappedOnTapVolumeResponse));
        }

        snapshotPolicyAssessmentData.totalObjectsAssessed = dataLogVolumeUuids.length;
        volumes.forEach(volume => {
            const volDetails = volume as Record<string, string>;

            const latestSnapshotTimestamp = new Date(
                parseInt(volDetails?.[OptimizeStorageConfigs.MOST_RECENT_SNAPSHOT_TIMESTAMP] ?? 0, 10)
            );
            if (
                (isEmpty(volDetails?.[OptimizeStorageConfigs.SNAPSHOT_POLICY]) ||
                    volDetails?.[OptimizeStorageConfigs.SNAPSHOT_POLICY] === 'none') &&
                latestSnapshotTimestamp <= new Date(moment().subtract(2, 'days').format())
            ) {
                const vol: OntapVolumeType = { ontapVolumeName: volDetails?.name, ontapVolumeUuid: volDetails?.uuid };
                if (isEmpty(dataLogVolumeUuids) || dataLogVolumeUuids.includes(volDetails?.uuid)) {
                    snapshotPolicyAssessmentData?.objectsInViolation?.push(vol);
                }
            }
        });
        if (isDemoFlow) {
            snapshotPolicyAssessmentData.totalObjectsAssessed = volumes.length;
            const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
            const { configsOptimized } =
                ((instanceDetail as unknown as DatabaseInstance)?.metadata as DatabaseInstanceMetadata) ?? {};
            if (configsOptimized?.STORAGE?.includes(OptimizeStorageConfigs.SNAPSHOT_POLICY)) {
                snapshotPolicyAssessmentData.objectsInViolation = [];
            }
        }

        if (isEmpty(snapshotPolicyAssessmentData.objectsInViolation)) {
            snapshotPolicyAssessmentData.status = AssessmentStatus.OPTIMIZED;
        }
        snapshotPolicyAssessmentData.totalObjectsInViolation =
            snapshotPolicyAssessmentData?.objectsInViolation?.length ?? 0;
    } catch (error) {
        errorMessage = `Error getting snapshot policy drift data: ${error}`;
        return { errorMessage };
    }
    return snapshotPolicyAssessmentData;
}

async function initiateAWSBackupAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance,
    instanceVolumeMapping: MappedOnTapVolumeResponse[]
) {
    logger.info('Initiating Scheduled FSx for ONTAP backup assessment for:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId
    });

    const {
        resourceName,
        name: databaseInstanceName,
        id: databaseInstanceId,
        fsxFileSystem: fileSystemId
    } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const jobName = 'Scheduled FSx for ONTAP backup assessment';
    const jobDescription = `${jobName}`;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';
    const { id: awsBackupAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let isAWSBackupEnabled = false;
    try {
        const fsxnInfo = await describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId] }, accountId, {
            useCache: true
        });
        isAWSBackupEnabled = fsxnInfo?.FileSystems?.[0]?.OntapConfiguration?.AutomaticBackupRetentionDays !== undefined;
        logger.debug('Is Scheduled FSx for ONTAP backup enabled:', isAWSBackupEnabled);
        if (!isAWSBackupEnabled) {
            if (isEmpty(instanceVolumeMapping)) {
                errorMessage = `Found no FSx for ONTAP volumes for the instance ${instanceRecord.name}.`;
                logger.error(errorMessage);
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
            }
            const { dataLogVolumeUuids } = filterDataLogVolumes(
                instanceVolumeMapping as unknown as MappedOnTapVolumeResponse
            );

            const { volumeUuidsInBackups } =
                (await isFsxnAwsBackupEnabled(
                    credentialsId,
                    region,
                    fileSystemId,
                    dataLogVolumeUuids,
                    undefined,
                    undefined,
                    accountId
                )) || {};

            logger.debug('Is on-demand backup enabled:', volumeUuidsInBackups);

            if (volumeUuidsInBackups && !isEmpty(volumeUuidsInBackups)) {
                const backupVolumeSet = new Set(volumeUuidsInBackups);
                const allUuidsMatch = [...volumeUuidsInBackups].every(uuid => backupVolumeSet.has(uuid));
                isAWSBackupEnabled = allUuidsMatch;
            }
        }
    } catch (error) {
        errorMessage = `Error while assessing Scheduled FSx for ONTAP backup: ${error}.`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.AWS_BACKUP,
                config_data: { fileSystemId, isAWSBackupEnabled, errorMessage }
            }
        ]);
    }
    await updateJobDetails(accountId, awsBackupAssessmentJobId, {
        endTime: Date.now(),
        status: jobStatus,
        error: errorMessage
    });
}

async function getAwsBackupDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    awsBackupAssessmentData: AWSBackupAssessment
) {
    logger.info('Get Scheduled FSx for ONTAP backup assessment data', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    });

    if (isEmpty(awsBackupAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.AWS_BACKUP);
        logger.error(errorMessage);
        return { errorMessage } as ParameterDriftResponseType & { errorMessage: string };
    }

    const { fileSystemId, isAWSBackupEnabled, errorMessage } = awsBackupAssessmentData;
    if (errorMessage) {
        return { errorMessage };
    }
    const awsBackupAssesmentData: ParameterDriftResponseType = {
        ...storageGoldenConfigData.resiliency.awsBackup,
        name: 'scheduled-fsx-for-ontap-backups',
        status: isAWSBackupEnabled ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
        totalObjectsInViolation: isAWSBackupEnabled ? 0 : 1,
        recommended: 'aws-backup-enabled',
        objectsInViolation: isAWSBackupEnabled ? [] : [fileSystemId],
        totalObjectsAssessed: 1
    };
    return awsBackupAssesmentData;
}

async function initiateCrossRegionResiliencyAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance,
    instanceVolumeMapping: MappedOnTapVolumeResponse[]
) {
    logger.info('Initiating cross region resiliency assessment for:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId
    });

    let errorMessageText = '';
    const { resourceName, name: databaseInstanceName } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const jobName = 'Cross region replication assessment';
    const jobDescription = `${jobName}`;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;

    const { id: crrAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    try {
        if (isEmpty(instanceVolumeMapping)) {
            errorMessageText = `Found no FSx for ONTAP volumes for the instance ${instanceRecord.name}.`;
            logger.error(errorMessageText);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessageText);
        }

        const { dataLogVolumeUuids, dataLogVolumeNames } = filterDataLogVolumes(
            instanceVolumeMapping as unknown as MappedOnTapVolumeResponse
        );
        instanceRecord.mappedVolumesUuids = dataLogVolumeUuids;
        instanceRecord.mappedVolumeNames = dataLogVolumeNames;

        const command = [CROSS_REGION_REPLICATION_SCRIPT(instanceRecord)];
        const ssmComment = 'Get Cross Region Replication Assessment';

        const response = await callSsmExecution(
            credentialsId,
            region,
            command,
            instanceRecord.activeNodeInstanceid,
            ssmComment,
            accountId,
            false,
            undefined,
            true
        );

        const { crrDetails, errorMessage } = response
            ? sqlResponseParsing(response)
            : { crrDetails: [], errorMessage: '' };

        const peerFileSystemIds = [
            ...new Set(
                compact(
                    crrDetails
                        .map((crrDetail: { peerClusterFsxId: string | string[] }) => crrDetail.peerClusterFsxId)
                        .flat()
                ) as string[]
            )
        ];

        // Check if PeerFileSystemIds are NOT deployed in the same region as source fsx
        // 1. No two fsx in any region can have same id.
        // 2. On describe-file-system call with region as source fsx  → If error says "File system 'fs-0e39d51dc9d0468ca' does not exist.", then fsx is deployed in a region different from source fsx
        // 3. With vpc peering or transit gateway, if describe-file-system call with region as source fsx does not result in an error, extract region from ResourceArn (example:ResourceARN": "arn:aws:fsx:ap-southeast-1:464262061435:file-system/fs-00e6530a84ccd0a01")

        if (!isEmpty(peerFileSystemIds)) {
            await Promise.all(
                peerFileSystemIds.map(async (peerFileSystemId: string) => {
                    try {
                        const fsxInfo = await describeFSx(
                            credentialsId,
                            region,
                            { FileSystemIds: [peerFileSystemId] },
                            accountId,
                            { useCache: true }
                        );
                        const resourceArn = fsxInfo?.FileSystems?.[0]?.ResourceARN;

                        crrDetails.forEach(
                            (crrDetail: { peerClusterFsxId: string | string[]; isCRREnabled: boolean }) => {
                                crrDetail.isCRREnabled =
                                    crrDetail.isCRREnabled ||
                                    ((crrDetail.peerClusterFsxId === peerFileSystemId ||
                                        crrDetail.peerClusterFsxId?.includes(peerFileSystemId)) &&
                                        !resourceArn?.includes(region)) ||
                                    false;
                            }
                        );
                    } catch (error: any) {
                        if (error?.name && error.name === 'FileSystemNotFound') {
                            crrDetails.forEach(
                                (crrDetail: { peerClusterFsxId: string | string[]; isCRREnabled: boolean }) => {
                                    crrDetail.isCRREnabled =
                                        crrDetail.isCRREnabled ||
                                        crrDetail.peerClusterFsxId === peerFileSystemId ||
                                        crrDetail.peerClusterFsxId?.includes(peerFileSystemId) ||
                                        false;
                                }
                            );
                        }
                    }
                })
            );
        }

        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: instanceRecord.id,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.CRR,
                config_data: { crrDetails, errorMessage }
            }
        ]);
    } catch (error) {
        errorMessageText = `Error while initiating cross region resiliency assessment: ${error}`;
        logger.error(errorMessageText);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, crrAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus,
            error: errorMessageText
        });
    }
}

async function getCrrDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    crrAssessmentData: CrrAssessment
) {
    logger.info('Calculate crr drift data for:', {
        accountId,
        region,
        credentialsId,
        databaseInstanceId,
        databaseHostId
    });

    if (isEmpty(crrAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.CRR);
        return { errorMessage } as ParameterDriftResponseType & { errorMessage: string };
    }

    const { crrDetails } = crrAssessmentData;

    try {
        const allVolumesOptimized: boolean = crrDetails.every((detail: CrrDetails) => detail.isCRREnabled);

        const response: ParameterDriftResponseType = {
            name: 'crr',
            status: allVolumesOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
            severity: SEVERITY.WARNING,
            recommendation:
                'Workload Factory recommends enabling Cross-Region Replication (CRR) for your FSx for ONTAP filesystems. CRR ensures that your data is replicated to another AWS region, providing enhanced data durability and availability. It is recommended to configure CRR for disaster recovery and compliance requirements.',
            objectsInViolation: allVolumesOptimized
                ? []
                : crrDetails.filter(detail => !detail.isCRREnabled).map(detail => detail.volumeName),
            totalObjectsAssessed: crrDetails.length,
            totalObjectsInViolation: allVolumesOptimized ? 0 : crrDetails.filter(detail => !detail.isCRREnabled).length,
            tags: [AwsWellArchitecturedPillars.RELIABILITY],
            resourceType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
            recommended: 'crr-enabled'
        };

        return response;
    } catch (error) {
        logger.error('Error fetching crr drift data:', error);
        return { errorMessage: (error as Error).message } as ParameterDriftResponseType & { errorMessage: string };
    }
}

function checkFCIDeploymentType(instanceDetail: DatabaseInstance, context: string) {
    const sqlDeploymentType =
        typeof instanceDetail?.database_deployment_type === 'string'
            ? instanceDetail.database_deployment_type
            : undefined;
    if (!sqlDeploymentType || sqlDeploymentType.toUpperCase() !== 'FCI') {
        const message = `SQL deployment type is '${
            sqlDeploymentType ?? 'unknown'
        }'. High Availability configuration assessment (${context}) is only applicable for FCI deployment type.`;
        logger.info(message);
        return { error: message };
    }
    return null;
}
async function getSharedStorageAssessment(
    credentialsId: string,
    region: string,
    accountId: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance,
    instanceVolumeMapping: MappedOnTapVolumeResponse[]
) {
    try {
        const instanceDetail = (await getInstanceInfo(
            accountId,
            credentialsId,
            databaseHostId,
            instanceRecord.id
        )) as DatabaseInstance;
        logger.info('Instance detail for SQL Server Services assessment:', instanceDetail.metadata);

        // Only run assessment if deployment type is FCI
        const fciCheck = checkFCIDeploymentType(instanceDetail, 'shared-storage');
        if (fciCheck) {
            return fciCheck;
        }

        const { node1InstanceId, node2InstanceId } = (instanceDetail?.resource?.metadata || {}) as {
            node1InstanceId?: string;
            node2InstanceId?: string;
        };

        if (!node1InstanceId && !node2InstanceId) {
            throw new Error('node1instanceid and node2instanceid not found in instanceRecord metadata');
        }

        // Get HOST IQN details for both nodes
        logger.info('Fetching HOST IQN details for both nodes:', { node1InstanceId, node2InstanceId });
        const hostIqnCommand = [GET_HOST_IQN];
        const [hostIqnRespNode1, hostIqnRespNode2] = await Promise.all([
            node1InstanceId
                ? callSsmExecution(
                      credentialsId,
                      region,
                      hostIqnCommand,
                      node1InstanceId,
                      'Get HOST IQN details (node1)',
                      accountId,
                      false,
                      undefined,
                      true
                  )
                : undefined,
            node2InstanceId
                ? callSsmExecution(
                      credentialsId,
                      region,
                      hostIqnCommand,
                      node2InstanceId,
                      'Get HOST IQN details (node2)',
                      accountId,
                      false,
                      undefined,
                      true
                  )
                : undefined
        ]);

        const hostIqnNode1 = hostIqnRespNode1 as string | undefined;
        const hostIqnNode2 = hostIqnRespNode2 as string | undefined;

        if (!instanceVolumeMapping || instanceVolumeMapping.length === 0) {
            const errorMessage = `Found no FSx for ONTAP volumes for the instance ${instanceRecord.name}.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }

        const lunRecords = Object.values(instanceVolumeMapping).flatMap(i => i.lunRecords || []);

        const results = await Promise.all(
            lunRecords.map(async lun => {
                const lunUuid = lun.uuid;
                const lunName = lun.name;

                // Get LUN maps (to extract igroupUuid)
                const lunMapsCommand = [
                    GET_LUN_MAPS({
                        fsxId: instanceRecord.fsxFileSystem,
                        region,
                        apiEndpoint: `/protocols/san/lun-maps/${lunUuid}`,
                        apiQueryFilter: 'fields=space,igroup'
                    })
                ];
                const lunMapsResp = await callSsmExecution(
                    credentialsId,
                    region,
                    lunMapsCommand,
                    instanceRecord.activeNodeInstanceid,
                    `Get ONTAP LUN details for LUN ${lunUuid}`,
                    accountId,
                    false,
                    undefined,
                    true
                );
                const lunMapsParsed = sqlResponseParsing(lunMapsResp);

                // Inline PowerShell-style string parsing for igroup
                const records = Array.isArray(lunMapsParsed?.records)
                    ? lunMapsParsed.records
                    : lunMapsParsed?.records
                    ? [lunMapsParsed.records]
                    : [];

                let igroupUuid: string | undefined;
                let igroupName: string | undefined;

                const igroupRecord = records.find(
                    (r: any) => typeof r?.igroup === 'string' && r.igroup.startsWith('@{')
                );

                if (igroupRecord && typeof igroupRecord.igroup === 'string') {
                    const str = igroupRecord.igroup;
                    if (str.startsWith('@{') && str.endsWith('}')) {
                        const body = str.slice(2, -1);
                        for (const pair of body
                            .split(';')
                            .map((s: string) => s.trim())
                            .filter(Boolean)) {
                            const [key, ...rest] = pair.split('=');
                            const value = rest.join('=').trim();
                            if (key.trim() === 'uuid') {
                                igroupUuid = value;
                            }
                            if (key.trim() === 'name') {
                                igroupName = value;
                            }
                        }
                    }
                }

                // Get IGROUP details (to fetch initiator names)
                let initiatorNames: string[] = [];
                if (igroupUuid) {
                    const igroupCommand = [
                        GET_IGROUP_UUID({
                            fsxId: instanceRecord.fsxFileSystem,
                            region,
                            apiEndpoint: `/protocols/san/igroups/${igroupUuid}`,
                            apiQueryFilter: 'fields=initiators'
                        })
                    ];
                    const igroupResp = await callSsmExecution(
                        credentialsId,
                        region,
                        igroupCommand,
                        instanceRecord.activeNodeInstanceid,
                        `Get ONTAP igroup details for igroup ${igroupUuid}`,
                        accountId,
                        false,
                        undefined,
                        true
                    );
                    const igroupParsed = sqlResponseParsing(igroupResp);
                    initiatorNames = Array.isArray(igroupParsed?.initiators)
                        ? igroupParsed.initiators.map((initiator: { name: string }) => initiator.name)
                        : [];
                    logger.info('Fetched initiator names:', initiatorNames);
                }

                // Assessment: Check if any of hostIqnNode1 or hostIqnNode2 is present in initiatorNames
                const hostIqnsToCheck = [hostIqnNode1, hostIqnNode2].filter(Boolean) as string[];
                const initiatorAssessmentStatus = hostIqnsToCheck.some(iqn => initiatorNames.includes(iqn))
                    ? AssessmentStatus.OPTIMIZED
                    : AssessmentStatus.NOT_OPTIMIZED;

                return {
                    lunUuid,
                    lunName,
                    status: initiatorAssessmentStatus,
                    igroupDetails: {
                        igroupUuid,
                        igroupName,
                        initiatorNames,
                        hostIqnsChecked: hostIqnsToCheck
                    }
                };
            })
        );

        const allOptimized = results.every(r => r.status === AssessmentStatus.OPTIMIZED);
        return {
            status: allOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
            lunDetails: results
        };
    } catch (err) {
        logger.error('Exception running SSM for shared-storage:', err);
        return { status: AssessmentStatus.NOT_OPTIMIZED, lunDetails: null, error: err?.toString() };
    }
}

async function getDriveLetterAssessment(
    credentialsId: string,
    region: string,
    accountId: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance,
    instanceVolumeMapping: MappedOnTapVolumeResponse[]
) {
    try {
        const instanceDetail = (await getInstanceInfo(
            accountId,
            credentialsId,
            databaseHostId,
            instanceRecord.id
        )) as DatabaseInstance;
        logger.info('Instance detail for Drive Letter assessment:', instanceDetail.metadata);

        const { node1InstanceId, node2InstanceId } = (instanceDetail?.resource?.metadata || {}) as {
            node1InstanceId?: string;
            node2InstanceId?: string;
        };
        if (!node1InstanceId || !node2InstanceId) {
            const message = 'Both node1InstanceId and node2InstanceId are required for drive letter assessment.';
            logger.error(message);
            return { error: message };
        }

        const { activeNodeInstanceId, standbyNodeInstanceId } = await getActiveSqlNode(credentialsId, region, {
            node1InstanceId,
            node2InstanceId
        });

        let mappedVolumeDriveLetters: string[] = [];
        const mappedVolumeDriveLetterMap: {
            data: Record<string, string>;
            log: Record<string, string>;
            tempDb: Record<string, string>;
        } = { data: {}, log: {}, tempDb: {} };

        try {
            if (!activeNodeInstanceId || !standbyNodeInstanceId) {
                throw new Error('activeNodeInstanceId or standbyNodeInstanceId is undefined');
            }
            const fetchDriveDetailsCommand = [FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS(instanceRecord)];
            let driveDetails: any = await callSsmExecution(
                credentialsId,
                region,
                fetchDriveDetailsCommand,
                activeNodeInstanceId,
                'Fetch drive letters for mapped volumes',
                accountId,
                false,
                undefined,
                true
            );
            driveDetails = JSON.parse(driveDetails);
            const sections = ['data', 'log', 'tempDb'] as const;
            mappedVolumeDriveLetters = sections.flatMap(section => {
                mappedVolumeDriveLetterMap[section] = {};
                if (Array.isArray(driveDetails[section])) {
                    return driveDetails[section]
                        .map(item => {
                            const driveLetter = item?.driveLetter;
                            if (driveLetter) {
                                const key = item.name || item.lunUuid || item.ontapVolumeName;
                                mappedVolumeDriveLetterMap[section][key] = driveLetter;
                                return driveLetter;
                            }
                            return null;
                        })
                        .filter(Boolean) as string[];
                }
                return [];
            });
        } catch (err) {
            logger.error('Failed to fetch mapped volume drive letters:', err);
        }

        if (mappedVolumeDriveLetters.length === 0 && Array.isArray(instanceVolumeMapping)) {
            mappedVolumeDriveLetters = instanceVolumeMapping.map((vol: any) => vol?.driveLetter).filter(Boolean);
        }

        let standbyNodeDriveLetters: string[] = [];
        try {
            if (!standbyNodeInstanceId) {
                throw new Error('standbyNodeInstanceId is undefined');
            }
            const standbyResp = await callSsmExecution(
                credentialsId,
                region,
                [DRIVE_LETTER],
                standbyNodeInstanceId,
                'Get drive letters on standby node',
                accountId,
                false,
                undefined,
                true
            );
            const standbyRespParsed = sqlResponseParsing(standbyResp);
            standbyNodeDriveLetters = Array.isArray(standbyRespParsed)
                ? standbyRespParsed
                      .map(letter => (typeof letter === 'string' ? letter.trim().toUpperCase() : ''))
                      .filter(letter => /^[A-Z]$/.test(letter))
                : [];
        } catch (err) {
            logger.error('Failed to fetch drive letters on standby node:', err);
            return { error: err?.toString() };
        }

        const uniqueMappedVolumeDriveLetters = Array.from(new Set(mappedVolumeDriveLetters));
        const allPresent = uniqueMappedVolumeDriveLetters.every(letter => standbyNodeDriveLetters.includes(letter));
        const missingDriveLetters = uniqueMappedVolumeDriveLetters.filter(
            letter => !standbyNodeDriveLetters.includes(letter)
        );

        return {
            status: allPresent ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
            details: { missingDriveLetters }
        };
    } catch (err) {
        logger.error('Exception running SSM for drive-letter:', err);
        return { status: AssessmentStatus.NOT_OPTIMIZED, details: null, error: err?.toString() };
    }
}

async function getClusterQuorumAssessment(
    credentialsId: string,
    region: string,
    accountId: string,
    instanceRecord: WorkloadInstance
) {
    try {
        const command = [CLUSTER_QUORUM_TYPE];
        const rawResponse = await callSsmExecution(
            credentialsId,
            region,
            command,
            instanceRecord.activeNodeInstanceid,
            'Get High Availability Assessment: cluster-quorum',
            accountId,
            false,
            undefined,
            true
        );
        const response = sqlResponseParsing(rawResponse);

        let quorumResult;
        try {
            quorumResult = typeof response === 'string' ? JSON.parse(response) : response;
        } catch {
            return {
                status: AssessmentStatus.NOT_OPTIMIZED,
                details: null,
                error: 'Failed to parse quorum script output'
            };
        }
        if (quorumResult.IsPhysicalDiskAndMajority === true) {
            return { status: AssessmentStatus.OPTIMIZED, details: quorumResult };
        }
        return { status: AssessmentStatus.NOT_OPTIMIZED, details: quorumResult };
    } catch (err) {
        return { status: AssessmentStatus.NOT_OPTIMIZED, details: null, error: err?.toString() };
    }
}

async function getHeartbeatSettingsAssessment(
    credentialsId: string,
    region: string,
    accountId: string,
    instanceRecord: WorkloadInstance
) {
    try {
        const command = [HEARTBEAT_SETTINGS];
        const rawResponse = await callSsmExecution(
            credentialsId,
            region,
            command,
            instanceRecord.activeNodeInstanceid,
            'Get High Availability Assessment: heartbeat-settings',
            accountId,
            false,
            undefined,
            true
        );
        let responseObj: any;
        try {
            responseObj = typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse;
        } catch {
            return {
                status: AssessmentStatus.NOT_OPTIMIZED,
                details: null,
                error: 'Failed to parse heartbeat script output'
            };
        }
        const recommended = {
            SameSubnetDelay: 1000,
            SameSubnetThreshold: 10,
            CrossSubnetDelay: 1000,
            CrossSubnetThreshold: 20,
            CrossSiteDelay: 1000,
            CrossSiteThreshold: 20
        };

        let settings: Record<string, any> = {};
        try {
            settings = typeof responseObj === 'string' ? JSON.parse(responseObj) : responseObj;
        } catch {
            return {
                status: AssessmentStatus.NOT_OPTIMIZED,
                details: null,
                error: 'Failed to parse heartbeat script output'
            };
        }

        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
            return {
                status: AssessmentStatus.NOT_OPTIMIZED,
                details: null,
                error: 'Heartbeat settings are missing or invalid'
            };
        }

        const notOptimized: Record<string, { current: number; recommended: number }> = {};
        let allOptimized = true;

        for (const key of Object.keys(recommended) as (keyof typeof recommended)[]) {
            const foundKey = Object.keys(settings).find(k => k.toLowerCase() === key.toLowerCase());
            const current = foundKey ? Number(settings[foundKey]) : NaN;
            const rec = recommended[key];
            if (current !== rec) {
                notOptimized[key] = { current, recommended: rec };
                allOptimized = false;
            }
        }

        if (allOptimized) {
            return {
                status: AssessmentStatus.OPTIMIZED,
                details: settings
            };
        }

        const details: Record<string, { current: number; recommended: number }> = {};
        for (const key of Object.keys(recommended) as (keyof typeof recommended)[]) {
            const foundKey = Object.keys(settings).find(k => k.toLowerCase() === key.toLowerCase());
            details[key] = {
                current: foundKey ? Number(settings[foundKey]) : NaN,
                recommended: recommended[key]
            };
        }
        return {
            status: AssessmentStatus.NOT_OPTIMIZED,
            details
        };
    } catch (err) {
        logger.error('Exception running SSM for heartbeat-settings:', err);
        return { status: AssessmentStatus.NOT_OPTIMIZED, details: null, error: err?.toString() };
    }
}

async function getSqlServerServicesAssessment(
    credentialsId: string,
    region: string,
    accountId: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance
) {
    try {
        const command = [SQL_SERVER_SERVICES(instanceRecord.name)];
        const rawResponse = await callSsmExecution(
            credentialsId,
            region,
            command,
            instanceRecord.activeNodeInstanceid,
            'Get High Availability Assessment: sql-server-services',
            accountId,
            false,
            undefined,
            true
        );
        const response = sqlResponseParsing(rawResponse);

        let services: any[] = [];
        if (Array.isArray(response)) {
            services = response;
        } else if (response && typeof response === 'object') {
            services = [response];
        }

        const allManualAndRunning = services.every(
            (svc: any) =>
                svc.StartType?.toLowerCase() === 'manual' &&
                (typeof svc.Status === 'string' ? svc.Status.toLowerCase() === 'running' : svc.Status === 4)
        );

        const details = services.map((svc: any) => ({
            Name: svc.Name,
            Status: svc.Status,
            StartType: svc.StartType
        }));

        return allManualAndRunning
            ? { status: AssessmentStatus.OPTIMIZED, details }
            : { status: AssessmentStatus.NOT_OPTIMIZED, details, error: null };
    } catch (err) {
        logger.error('Exception running SSM for sql-server-services:', err);
        return { status: AssessmentStatus.NOT_OPTIMIZED, details: null, error: err?.toString() };
    }
}

async function initiateHighAvailabilityAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance,
    instanceVolumeMapping: MappedOnTapVolumeResponse[]
) {
    logger.info('Get Cluster High Availability assessment data', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId,
        instanceRecord
    });

    if (!instanceRecord) {
        throw new Error('Instance record required for SSM checks');
    }

    const instanceDetail = (await getInstanceInfo(
        accountId,
        credentialsId,
        databaseHostId,
        instanceRecord.id
    )) as DatabaseInstance;

    // Only run assessment if deployment type is FCI
    const fciCheck = checkFCIDeploymentType(instanceDetail, 'main');
    if (fciCheck) {
        const { resourceName, name: databaseInstanceName, id: databaseInstanceId } = instanceRecord;
        const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
        const jobName = 'High Availability Assessment';
        const jobDescription = jobName;
        const jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
        const errorMessage = fciCheck.error;

        const { id: highAvailabilityAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
            name: jobName,
            description: jobDescription,
            resourceName: resourceWithInstanceName,
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.ASSESSMENT
        });

        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.HIGH_AVAILABILITY,
                config_data: {
                    sharedStorage: fciCheck,
                    clusterQuorum: fciCheck,
                    heartbeat: fciCheck,
                    sqlServerServices: fciCheck,
                    errorMessage
                }
            }
        ]);
        await updateJobDetails(accountId, highAvailabilityAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus,
            error: errorMessage
        });
        return;
    }

    const { resourceName, name: databaseInstanceName, id: databaseInstanceId } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const jobName = 'High Availability Assessment';
    const jobDescription = jobName;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    const { id: highAvailabilityAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT
    });

    let sharedStorageResult;
    let clusterQuorumResult;
    let heartbeatResult;
    let sqlServerServicesResult;
    let driveLetterResult;
    try {
        [sharedStorageResult, driveLetterResult, clusterQuorumResult, heartbeatResult, sqlServerServicesResult] =
            await Promise.all([
                getSharedStorageAssessment(
                    credentialsId,
                    region,
                    accountId,
                    databaseHostId,
                    instanceRecord,
                    instanceVolumeMapping
                ),
                getDriveLetterAssessment(
                    credentialsId,
                    region,
                    accountId,
                    databaseHostId,
                    instanceRecord,
                    instanceVolumeMapping
                ),
                getClusterQuorumAssessment(credentialsId, region, accountId, instanceRecord),
                getHeartbeatSettingsAssessment(credentialsId, region, accountId, instanceRecord),
                getSqlServerServicesAssessment(credentialsId, region, accountId, databaseHostId, instanceRecord)
            ]);
    } catch (err) {
        logger.error('Error running high availability assessment:', err);
        errorMessage = err?.toString?.() || String(err);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.HIGH_AVAILABILITY,
                config_data: {
                    sharedStorage: sharedStorageResult,
                    driveLetter: driveLetterResult,
                    clusterQuorum: clusterQuorumResult,
                    heartbeat: heartbeatResult,
                    sqlServerServices: sqlServerServicesResult
                }
            }
        ]);
    }
    await updateJobDetails(accountId, highAvailabilityAssessmentJobId, {
        endTime: Date.now(),
        status: jobStatus,
        error: errorMessage
    });
}

async function getHighAvailabilityDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    highAvailabilityAssessmentData: HighAvailabilityAssessment
): Promise<ParameterDriftResponseType[] | (ParameterDriftResponseType & { errorMessage: string })> {
    logger.info('Calculate high Availability drift data for:', {
        accountId,
        region,
        credentialsId,
        databaseInstanceId,
        databaseHostId
    });

    if (isEmpty(highAvailabilityAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.HIGH_AVAILABILITY);
        return { errorMessage } as ParameterDriftResponseType & { errorMessage: string };
    }

    try {
        const { sharedStorage, driveLetter, clusterQuorum, heartbeat, sqlServerServices } =
            highAvailabilityAssessmentData;

        const haChecks: ParameterDriftResponseType[] = [
            {
                name: 'shared-storage',
                status: (sharedStorage?.status ?? AssessmentStatus.NOT_OPTIMIZED) as AssessmentStatus,
                recommended: 'All shared disks should be accessible by both nodes',
                severity: SEVERITY.CRITICAL,
                recommendation: 'All shared disks (iSCSI LUNs) should be accessible by both nodes to allow failover.',
                objectsInViolation: Array.isArray(sharedStorage?.lunDetails)
                    ? sharedStorage.lunDetails
                          .filter((lun: any) => lun.status !== AssessmentStatus.OPTIMIZED)
                          .map((lun: any) => lun.lunName)
                    : [],
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                totalObjectsAssessed: Array.isArray(sharedStorage?.lunDetails) ? sharedStorage.lunDetails.length : 0,
                totalObjectsInViolation: Array.isArray(sharedStorage?.lunDetails)
                    ? sharedStorage.lunDetails.filter((lun: any) => lun.status !== AssessmentStatus.OPTIMIZED).length
                    : 0,
                resourceType: ASSESSMENT_RESOURCE_TYPE.LUN
            },
            {
                name: 'drive-letter',
                status: (driveLetter?.status ?? AssessmentStatus.NOT_OPTIMIZED) as AssessmentStatus,
                recommended: 'Validate availability of same drive letters on standby node',
                severity: SEVERITY.CRITICAL,
                recommendation: 'Validate availability of same drive letters on standby node.',
                objectsInViolation: Array.isArray(driveLetter?.details?.missingDriveLetters)
                    ? driveLetter.details.missingDriveLetters
                    : [],
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                totalObjectsAssessed: Array.isArray(driveLetter?.details?.missingDriveLetters)
                    ? driveLetter.details.missingDriveLetters.length
                    : 0,
                totalObjectsInViolation: Array.isArray(driveLetter?.details?.missingDriveLetters)
                    ? driveLetter.details.missingDriveLetters.length
                    : 0,
                resourceType: ASSESSMENT_RESOURCE_TYPE.LUN
            },
            {
                name: 'cluster-quorum',
                status: (clusterQuorum?.status ?? AssessmentStatus.NOT_OPTIMIZED) as AssessmentStatus,
                recommended: 'Cluster quorum should be optimized',
                severity: SEVERITY.CRITICAL,
                recommendation: 'The quorum configuration should be appropriate for the cluster size and environment.',
                objectsInViolation:
                    clusterQuorum?.status !== AssessmentStatus.OPTIMIZED && clusterQuorum?.details
                        ? [
                              `IsMajority: ${clusterQuorum.details.IsMajority}, IsPhysicalDisk: ${clusterQuorum.details.IsPhysicalDisk}, QuorumResourceName: ${clusterQuorum.details.QuorumResourceName}`
                          ]
                        : [],
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                totalObjectsAssessed: 1,
                totalObjectsInViolation: clusterQuorum?.status !== AssessmentStatus.OPTIMIZED ? 1 : 0,
                resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE
            },
            {
                name: 'heartbeat-settings',
                status: (heartbeat?.status ?? AssessmentStatus.NOT_OPTIMIZED) as AssessmentStatus,
                recommended: 'Heartbeat settings should be optimized',
                severity: SEVERITY.CRITICAL,
                recommendation: 'Cluster heartbeat settings should be optimized to prevent unnecessary failovers.',
                objectsInViolation:
                    heartbeat?.status !== AssessmentStatus.OPTIMIZED && heartbeat?.details
                        ? Object.entries(heartbeat.details)
                              .filter(
                                  ([, value]: [string, any]) =>
                                      value && typeof value === 'object' && value.current !== value.recommended
                              )
                              .map(([key]) => key)
                        : [],
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                totalObjectsAssessed: heartbeat?.details ? Object.keys(heartbeat.details).length : 0,
                totalObjectsInViolation:
                    heartbeat?.details && typeof heartbeat.details === 'object'
                        ? Object.values(heartbeat.details).filter(
                              (value: any) => value && typeof value === 'object' && value.current !== value.recommended
                          ).length
                        : 0,
                resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE
            },
            {
                name: 'sqlServer-service',
                status: (sqlServerServices?.status ?? AssessmentStatus.NOT_OPTIMIZED) as AssessmentStatus,
                recommended: 'SQL Server services should be set to start automatically',
                severity: SEVERITY.CRITICAL,
                recommendation:
                    'SQL Server services should be set to start automatically and run on the primary node and stopped on the secondary node.',
                objectsInViolation:
                    sqlServerServices?.status !== AssessmentStatus.OPTIMIZED &&
                    Array.isArray(sqlServerServices?.details)
                        ? sqlServerServices.details
                        : [],
                tags: [AwsWellArchitecturedPillars.RELIABILITY],
                totalObjectsAssessed: Array.isArray(sqlServerServices?.details) ? sqlServerServices.details.length : 0,
                totalObjectsInViolation:
                    sqlServerServices?.status !== AssessmentStatus.OPTIMIZED &&
                    Array.isArray(sqlServerServices?.details)
                        ? sqlServerServices.details.length
                        : 0,
                resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE
            }
        ];

        return haChecks;
    } catch (error) {
        logger.error('Error fetching high availability drift data:', error);
        return { errorMessage: (error as Error).message } as ParameterDriftResponseType & { errorMessage: string };
    }
}

export {
    getResilienceDriftAssessment,
    initiateCrossRegionResiliencyAssessment,
    collectSnapshotCopyData,
    collectVolumeSnapshotCopiesData,
    getVolumesWithoutSnapshotPolicy,
    initiateAWSBackupAssessment,
    initiateHighAvailabilityAssessment,
    getHighAvailabilityDriftData
};
