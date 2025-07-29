import createError from 'http-errors';
import moment from 'moment';
import { compact, isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import {
    DriftAssessmentResponseType,
    ErrorResponseType,
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
    HighAvailabilityAssessment,
    Metadata,
    ResourceAssessmentData
} from '../../../utils/common-types';
import { isDemo, parseMultipleCommandResponse, sqlResponseParsing } from '../../../utils/utils';
import { getInstanceInfo } from '../../database/database-operations';
import { describeFSx } from '../../../lib/aws/fsx';
import { CROSS_REGION_REPLICATION_SCRIPT } from '../../workloads/mssql/resiliency-scripts';
import {
    FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS,
    GET_SNAPSHOT_DETAILS
} from '../../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { isFsxnAwsBackupEnabled, getFSXPreferredSubnetAndAZ } from '../../aws/fsx-operations';
import { getInstanceSubnetAndAZ } from '../../aws/ec2-operations';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import {
    CLUSTER_QUORUM_TYPE,
    SQL_SERVER_SERVICES,
    DRIVE_LETTER,
    HEARTBEAT_SETTINGS,
    GET_LUN_IGROUP_INITIATOR_NAMES_AND_HOSTIQN
} from '../../workloads/mssql/high-availability-scripts';

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
    resourceName: string,
    databaseInstanceId: string,
    databaseInstanceName: string,
    fieldsValues: string[] = [],
    resourceAssessmentData: ResourceAssessmentData = {},
    databaseInstanceConfigData: Array<{ config_data_type: string; config_data: any }> = []
) {
    logger.info('Getting resilience drift assessment for:', {
        credentialsId,
        databaseInstanceId,
        databaseHostId,
        resourceName,
        databaseInstanceName,
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
                      resourceName,
                      databaseInstanceId,
                      databaseInstanceName,
                      resourceAssessmentData,
                      highAvailabilityAssessmentData
                  )
                : Promise.resolve(undefined)
        ]);

        const haChecksArray =
            haChecks && !Array.isArray(haChecks) && haChecks.errorMessage
                ? [haChecks]
                : Array.isArray(haChecks)
                ? haChecks
                : [];

        const assessmentData: DriftAssessmentResponseType = {
            snapshotPolicy,
            crr: crrData,
            awsBackup: awsBackup as ParameterDriftResponseType,
            highAvailability: !isEmpty(haChecksArray) ? haChecksArray : undefined
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
        if (isEmpty(instanceRecord.mappedVolumesUuids)) {
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

interface LunMapping {
    lunUuid: string;
    lunName: string;
    igroupUuid: string;
    igroupName: string;
    initiatorNames: string[];
}
interface LunIqnDetails {
    hostIqns: string;
    lunMappings: [LunMapping];
}

async function getSharedStorageAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance
) {
    logger.info('Fetching shared storage details', { accountId, credentialsId, region, databaseHostId });

    let errorMessage;
    try {
        const { fsxFileSystem, databaseInstanceObject, mappedLunUuids, id: databaseInstanceId } = instanceRecord;

        const { metadata: resourceMetadata } = (databaseInstanceObject as DatabaseInstance).resource;
        const { node1InstanceId, node2InstanceId } = resourceMetadata as Metadata;

        if (!node1InstanceId || !node2InstanceId) {
            errorMessage = `Unable to fetch primary node and (or) standby node details for ${accountId}, ${credentialsId}, ${databaseHostId}, ${databaseInstanceId}.`;
            throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
        }

        const command = GET_LUN_IGROUP_INITIATOR_NAMES_AND_HOSTIQN(fsxFileSystem, region, mappedLunUuids || []);
        const [primaryNodeResponse, standbyNodeResponse] = await Promise.all([
            callSsmExecution(
                credentialsId,
                region,
                [command],
                node1InstanceId,
                `Get Host IQN and LUN mappings from node ${node1InstanceId}`,
                accountId,
                false,
                undefined,
                true
            ),
            callSsmExecution(
                credentialsId,
                region,
                [command],
                node2InstanceId,
                `Get Host IQN and LUN mappings from node ${node2InstanceId}`,
                accountId,
                false,
                undefined,
                true
            )
        ]);

        let primaryNodeParsedResponse: LunIqnDetails | null = null;
        let standbyNodeParsedResponse: LunIqnDetails | null = null;

        try {
            primaryNodeParsedResponse =
                primaryNodeResponse &&
                typeof primaryNodeResponse === 'string' &&
                primaryNodeResponse.trim().startsWith('{')
                    ? (JSON.parse(primaryNodeResponse) as LunIqnDetails)
                    : null;
        } catch (e) {
            logger.error('Failed to parse primaryNodeResponse JSON:', e);
            primaryNodeParsedResponse = null;
        }

        try {
            standbyNodeParsedResponse =
                standbyNodeResponse &&
                typeof standbyNodeResponse === 'string' &&
                standbyNodeResponse.trim().startsWith('{')
                    ? (JSON.parse(standbyNodeResponse) as LunIqnDetails)
                    : null;
        } catch (e) {
            logger.error('Failed to parse standbyNodeResponse JSON:', e);
            standbyNodeParsedResponse = null;
        }

        if (!primaryNodeParsedResponse || !standbyNodeParsedResponse) {
            throw new Error('Unable to fetch LUN IQN details for shared storage assessment.');
        }

        const primaryHostIqns = primaryNodeParsedResponse?.hostIqns?.split(',').map((iqn: string) => iqn.trim()) || [];
        const standbyHostIqns = standbyNodeParsedResponse?.hostIqns?.split(',').map((iqn: string) => iqn.trim()) || [];
        const allHostIqns = [...new Set([...primaryHostIqns, ...standbyHostIqns])];

        const primaryNodeLunMappings = primaryNodeParsedResponse?.lunMappings || [];

        const lunDetails = primaryNodeLunMappings.map(lunMapping => ({
            ...lunMapping,
            lunName: lunMapping.lunName,
            status: allHostIqns.every(iqn => lunMapping.initiatorNames.includes(iqn))
                ? AssessmentStatus.OPTIMIZED
                : AssessmentStatus.NOT_OPTIMIZED
        }));

        return {
            status:
                lunDetails.length > 0 && lunDetails.every(lun => lun.status === AssessmentStatus.OPTIMIZED)
                    ? AssessmentStatus.OPTIMIZED
                    : AssessmentStatus.NOT_OPTIMIZED,
            lunDetails,
            allHostIqns
        };
    } catch (err) {
        logger.error('Exception running SSM for shared-storage:', err);
        return { status: AssessmentStatus.NOT_OPTIMIZED, lunDetails: null, error: err?.toString() };
    }
}

async function getDriveLetterAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance
) {
    logger.info('Fetch drive letter assessment for', {
        credentialsId,
        region,
        accountId,
        databaseHostId,
        databaseInstanceId: instanceRecord.id
    });

    let errorMessage;
    try {
        const { databaseInstanceObject, id: databaseInstanceId, activeNodeInstanceid } = instanceRecord;
        const { metadata: resourceMetadata } = (databaseInstanceObject as DatabaseInstance).resource;
        const { node1InstanceId, node2InstanceId } = resourceMetadata as Metadata;
        if (!node1InstanceId || !node2InstanceId) {
            errorMessage = `Unable to fetch primary node and (or) standby node details for ${accountId}, ${credentialsId}, ${databaseHostId}, ${databaseInstanceId}.`;
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }
        const isActiveNodePrimary = activeNodeInstanceid === node1InstanceId;
        const [primaryNodeResponse, standbyNodeResponse] = await Promise.all([
            callSsmExecution(
                credentialsId,
                region,
                [FETCH_MSSQL_INSTANCE_VOLUME_LUN_DRIVE_DETAILS(instanceRecord)],
                isActiveNodePrimary ? node1InstanceId : node2InstanceId,
                `Fetch drive letters for mapped volumes on primary node ${
                    isActiveNodePrimary ? node1InstanceId : node2InstanceId
                }`,
                accountId,
                false,
                undefined,
                true
            ),
            callSsmExecution(
                credentialsId,
                region,
                [DRIVE_LETTER],
                isActiveNodePrimary ? node2InstanceId : node1InstanceId,
                `Fetch available drive letters on standby node ${
                    isActiveNodePrimary ? node2InstanceId : node1InstanceId
                }`,
                accountId,
                false,
                undefined,
                true
            )
        ]);

        const primaryNodeParsedResponse = sqlResponseParsing(primaryNodeResponse);
        const standbyNodeParsedResponse = sqlResponseParsing(standbyNodeResponse);
        const driveLetterSections: string[] = ['data', 'log', 'tempDb'];

        const primaryNodeDriveLetters = driveLetterSections.flatMap(section =>
            (primaryNodeParsedResponse[section] || []).map((item: any) => item?.driveLetter).filter(Boolean)
        );
        const standbyNodeDriveLetters = Array.isArray(standbyNodeParsedResponse)
            ? standbyNodeParsedResponse.map(letter => (typeof letter === 'string' ? letter.trim().toUpperCase() : ''))
            : [];

        const missingDriveLetters = [
            ...new Set(primaryNodeDriveLetters.filter(letter => !standbyNodeDriveLetters.includes(letter)))
        ];
        return {
            status: isEmpty(missingDriveLetters) ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
            details: { missingDriveLetters, primaryNodeDriveLetters }
        };
    } catch (err) {
        logger.error('Exception running SSM for drive-letter:', err);
        return { status: AssessmentStatus.NOT_OPTIMIZED, details: null, error: err?.toString() };
    }
}

interface HeartbeatSettings {
    CrossSiteDelay: number;
    SameSubnetDelay: number;
    CrossSubnetDelay: number;
    CrossSiteThreshold: number;
    SameSubnetThreshold: number;
    CrossSubnetThreshold: number;
}

// Determines the preferred node based on FSx preferred subnet and AZ
async function determinePreferredNode(
    accountId: string,
    credentialsId: string,
    region: string,
    node1InstanceId: string,
    node2InstanceId: string,
    fsxFileSystem: string
): Promise<{ preferredNodeId: string; nonPreferredNodeId: string }> {
    const fsxFileSystemId = fsxFileSystem.split(',')[0];
    const [{ subnetId: fsxPreferredSubnetId, availabilityZone: fsxPreferredAZ }, node1Net, node2Net] =
        await Promise.all([
            getFSXPreferredSubnetAndAZ(credentialsId, region, fsxFileSystemId, accountId),
            getInstanceSubnetAndAZ(credentialsId, region, node1InstanceId),
            getInstanceSubnetAndAZ(credentialsId, region, node2InstanceId)
        ]);

    // Determine preferred node based on FSx preferred subnet and AZ
    let preferredNodeId: string;
    let nonPreferredNodeId: string;

    if (node1Net.subnetId === fsxPreferredSubnetId && node1Net.availabilityZone === fsxPreferredAZ) {
        preferredNodeId = node1InstanceId;
        nonPreferredNodeId = node2InstanceId;
    } else if (node2Net.subnetId === fsxPreferredSubnetId && node2Net.availabilityZone === fsxPreferredAZ) {
        preferredNodeId = node2InstanceId;
        nonPreferredNodeId = node1InstanceId;
    } else {
        throw new Error('Neither node is in the FSx preferred subnet and AZ.');
    }

    return { preferredNodeId, nonPreferredNodeId };
}

async function getSqlServiceStartupAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceRecord: WorkloadInstance
) {
    logger.info('Fetch sql service status for instance', {
        accountId,
        credentialsId,
        region,
        databaseInstanceId: instanceRecord.id
    });

    try {
        const { databaseInstanceObject, fsxFileSystem, activeNodeInstanceid } = instanceRecord;
        const { metadata: resourceMetadata } = (databaseInstanceObject as DatabaseInstance).resource;
        const { node1InstanceId, node2InstanceId } = resourceMetadata as Metadata;

        // Ensure both node1InstanceId and node2InstanceId are defined
        if (!node1InstanceId || !node2InstanceId) {
            throw new Error('Both node1InstanceId and node2InstanceId must be available for FCI instances.');
        }

        // 1. Determine preferred and non-preferred nodes
        const { preferredNodeId, nonPreferredNodeId } = await determinePreferredNode(
            accountId,
            credentialsId,
            region,
            node1InstanceId,
            node2InstanceId,
            fsxFileSystem
        );

        if (!preferredNodeId || !nonPreferredNodeId) {
            throw new Error('Preferred or non-preferred node ID is not available.');
        }

        if (!activeNodeInstanceid) {
            throw new Error('activeNodeInstanceid is not available in metadata.');
        }

        logger.info(
            `Preferred node: ${preferredNodeId}, Non-preferred node: ${nonPreferredNodeId}, Active node: ${activeNodeInstanceid}`
        );

        // 2. Prepare SSM commands for both nodes
        const { name: instanceName } = instanceRecord;
        const commands = compact([SQL_SERVER_SERVICES(instanceName)]);

        // 3. Run SSM command on both nodes in parallel
        const [preferredNodeRaw, nonPreferredNodeRaw] = await Promise.all([
            callSsmExecution(
                credentialsId,
                region,
                commands,
                preferredNodeId,
                `Fetch sql service status for instance ${instanceName} on preferred node ${preferredNodeId}`,
                accountId,
                false,
                undefined,
                true
            ),
            callSsmExecution(
                credentialsId,
                region,
                commands,
                nonPreferredNodeId,
                `Fetch sql service status for instance ${instanceName} on non-preferred node ${nonPreferredNodeId}`,
                accountId,
                false,
                undefined,
                true
            )
        ]);

        // 4. Parse SSM outputs
        const [parsedPreferred] = parseMultipleCommandResponse(preferredNodeRaw);
        const [parsedNonPreferred] = parseMultipleCommandResponse(nonPreferredNodeRaw);

        const servicesPreferred = (
            Array.isArray(parsedPreferred) ? parsedPreferred : parsedPreferred ? [parsedPreferred] : []
        ).map(svc => ({ ...svc, preferredInstanceId: preferredNodeId }));

        const servicesNonPreferred = (
            Array.isArray(parsedNonPreferred) ? parsedNonPreferred : parsedNonPreferred ? [parsedNonPreferred] : []
        ).map(svc => ({ ...svc, nonPreferredInstanceId: nonPreferredNodeId }));

        // 6. Check StartType on both nodes
        const allManualPreferred =
            servicesPreferred.length > 0 &&
            servicesPreferred.every((svc: any) => svc.StartType?.toLowerCase() === 'manual');
        const allManualNonPreferred =
            servicesNonPreferred.length > 0 &&
            servicesNonPreferred.every((svc: any) => svc.StartType?.toLowerCase() === 'manual');

        // 7. Final assessment
        if (allManualPreferred && allManualNonPreferred && activeNodeInstanceid === preferredNodeId) {
            return {
                status: AssessmentStatus.OPTIMIZED,
                details: [...servicesPreferred, ...servicesNonPreferred]
            };
        }
        logger.info(
            'SQL Server services are NOT set to Manual on both nodes or active node is not preferred. Not Optimized.'
        );
        return {
            status: AssessmentStatus.NOT_OPTIMIZED,
            details: [...servicesPreferred, ...servicesNonPreferred]
        };
    } catch (err) {
        logger.error('Error high availability SQL server service assessment:', err);
        return { error: err?.toString() };
    }
}

async function initiateHostLevelHighAvailabilityAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance,
    parentJobId: string
) {
    logger.info('Fetch cluster quorum, heartbeat settings for instance', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId
    });

    const { resourceName, name: databaseInstanceName, activeNodeInstanceid } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;

    const jobName = `Microsoft SQL server high availability assessment for heartbeat and quorum settings for ${resourceName}`;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage;

    let response;
    const { id: highAvailabilityAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobName,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    try {
        // Prepare all commands in a single SSM document execution

        const commands = [CLUSTER_QUORUM_TYPE, HEARTBEAT_SETTINGS];
        const rawResponses = await callSsmExecution(
            credentialsId,
            region,
            commands,
            activeNodeInstanceid,
            `Fetch cluster quorum, heartbeat settings on node ${activeNodeInstanceid}`,
            accountId,
            false,
            undefined,
            true
        );

        // Parse SSM output into separate objects
        const rawResponsesParsed = parseMultipleCommandResponse(rawResponses);
        const [parsedQuorumData, parsedHeartSettingsData] = rawResponsesParsed;

        // --- Cluster Quorum ---
        const clusterQuorumResult =
            !parsedQuorumData || typeof parsedQuorumData !== 'object'
                ? {
                      status: AssessmentStatus.NOT_OPTIMIZED,
                      details: null,
                      error: 'Unable to parse quorum data from ssm response'
                  }
                : {
                      status: parsedQuorumData.IsPhysicalDiskAndMajority
                          ? AssessmentStatus.OPTIMIZED
                          : AssessmentStatus.NOT_OPTIMIZED,
                      details: {
                          isMajority: parsedQuorumData.IsMajority,
                          quorumType: parsedQuorumData.QuorumType,
                          isPhysicalDisk: parsedQuorumData.IsPhysicalDisk,
                          quorumResourceName: parsedQuorumData.QuorumResourceName,
                          isPhysicalDiskAndMajority: parsedQuorumData.IsPhysicalDiskAndMajority
                      }
                  };

        // --- Heartbeat Settings ---
        const recommendedHeartbeatSettings = storageGoldenConfigData.resiliency.heartbeatSettings as HeartbeatSettings;
        let heartbeatResult: {
            status: AssessmentStatus;
            details: Record<string, { current: number; recommended: number; status: AssessmentStatus }> | null;
            error?: string;
        };

        if (
            !parsedHeartSettingsData ||
            typeof parsedHeartSettingsData !== 'object' ||
            Array.isArray(parsedHeartSettingsData)
        ) {
            heartbeatResult = {
                status: AssessmentStatus.NOT_OPTIMIZED,
                details: null,
                error: 'Heartbeat settings are missing or invalid'
            };
        } else {
            const heartbeatDetails = Object.entries(recommendedHeartbeatSettings).reduce(
                (acc, [key, recommendedValue]) => {
                    const currentValue = parsedHeartSettingsData[key];
                    acc[key] = {
                        current: currentValue,
                        recommended: recommendedValue,
                        status:
                            currentValue === recommendedValue
                                ? AssessmentStatus.OPTIMIZED
                                : AssessmentStatus.NOT_OPTIMIZED
                    };
                    return acc;
                },
                {} as Record<string, { current: number; recommended: number; status: AssessmentStatus }>
            );

            const allOptimized = Object.values(heartbeatDetails).every(
                detail => detail.status === AssessmentStatus.OPTIMIZED
            );

            heartbeatResult = {
                status: allOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
                details: heartbeatDetails
            };
        }

        response = {
            clusterQuorum: clusterQuorumResult,
            heartbeat: heartbeatResult
        };
    } catch (err: any) {
        errorMessage = `Error while running heartbeat settings and cluster quorum type assessment. Error:${err.message}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        response = {
            clusterQuorum: { status: AssessmentStatus.NOT_OPTIMIZED, details: null, error: err?.toString() },
            heartbeat: { status: AssessmentStatus.NOT_OPTIMIZED, details: null, error: err?.toString() }
        };
    } finally {
        await updateJobDetails(accountId, highAvailabilityAssessmentJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
    }
    return response;
}

async function initiateInstanceLevelHighAvailabilityAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    instanceRecord: WorkloadInstance,
    parentJobId: string
) {
    logger.info('Initiating High availability resiliency assessment for:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId
    });

    const { resourceName, name: databaseInstanceName, id: databaseInstanceId } = instanceRecord;

    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const jobName = 'Shared storage, drive mappings and SQL service configuration high availability assessment';
    const jobDescription = jobName;
    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    const { id: highAvailabilityAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let sharedStorageResult: any;
    let driveLetterResult: any;
    let sqlServerServicesResult: any;

    try {
        const [sharedStorage, driveLetter, sqlService] = await Promise.all([
            getSharedStorageAssessment(accountId, credentialsId, region, databaseHostId, instanceRecord),
            getDriveLetterAssessment(accountId, credentialsId, region, databaseHostId, instanceRecord),
            getSqlServiceStartupAssessment(accountId, credentialsId, region, instanceRecord)
        ]);

        sharedStorageResult = sharedStorage;
        driveLetterResult = driveLetter;
        sqlServerServicesResult = sqlService;
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
    resourceName: string,
    databaseInstanceId: string,
    databaseInstanceName: string,
    resourceAssessmentData: ResourceAssessmentData,
    highAvailabilityAssessmentData: HighAvailabilityAssessment
) {
    logger.info('Initiating High availability resiliency assessment for:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        resourceName,
        databaseInstanceId
    });

    if (isEmpty(highAvailabilityAssessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.HIGH_AVAILABILITY);
        logger.error('No high availability assessment data found.');
        return { errorMessage } as ErrorResponseType;
    }

    try {
        const { highAvailability: { clusterQuorum, heartbeat } = {} } = resourceAssessmentData;

        const { sharedStorage, driveLetter, sqlServerServices } = highAvailabilityAssessmentData;

        logger.debug(
            `Assessment data found for: sharedStorage=${!!sharedStorage}, driveLetter=${!!driveLetter}, clusterQuorum=${!!clusterQuorum}, heartbeat=${!!heartbeat}, sqlServerServices=${!!sqlServerServices}`
        );

        const resiliencyConfig = storageGoldenConfigData.resiliency;

        const haChecks: GenericAssessmentResponseType[] = [
            isEmpty(sharedStorage)
                ? { errorMessage: GENERIC_ASSESSMENT_ERROR_MESSAGE('shared-storage') }
                : sharedStorage.error
                ? { errorMessage: sharedStorage.error }
                : {
                      ...resiliencyConfig.highAvailability.sharedStorage,
                      name: 'shared-storage',
                      status: sharedStorage.status as AssessmentStatus,
                      objectsInViolation:
                          sharedStorage.lunDetails
                              ?.filter(lun => lun.status !== AssessmentStatus.OPTIMIZED)
                              .map(lun => lun.lunName) || [],
                      totalObjectsInViolation:
                          sharedStorage.lunDetails?.filter(lun => lun.status !== AssessmentStatus.OPTIMIZED).length || 0
                  },
            isEmpty(driveLetter)
                ? { errorMessage: GENERIC_ASSESSMENT_ERROR_MESSAGE('drive-letter') }
                : driveLetter.error
                ? { errorMessage: driveLetter.error }
                : {
                      ...resiliencyConfig.highAvailability.driveLetter,
                      name: 'drive-letter',
                      status: driveLetter.status as AssessmentStatus,
                      objectsInViolation: driveLetter.details.missingDriveLetters || [],
                      totalObjectsInViolation: driveLetter.details.missingDriveLetters?.length || 0
                  },
            isEmpty(clusterQuorum)
                ? { errorMessage: GENERIC_ASSESSMENT_ERROR_MESSAGE('cluster-quorum') }
                : clusterQuorum.error
                ? { errorMessage: clusterQuorum.error }
                : {
                      ...resiliencyConfig.highAvailability.clusterQuorum,
                      name: 'cluster-quorum',
                      status: clusterQuorum.status as AssessmentStatus,
                      objectsInViolation:
                          clusterQuorum.status !== AssessmentStatus.OPTIMIZED && clusterQuorum.details
                              ? [
                                    `IsMajority: ${clusterQuorum.details.isMajority}, IsPhysicalDisk: ${clusterQuorum.details.isPhysicalDisk}`
                                ]
                              : [],
                      totalObjectsAssessed: 1,
                      totalObjectsInViolation: clusterQuorum.status !== AssessmentStatus.OPTIMIZED ? 1 : 0
                  },
            isEmpty(heartbeat)
                ? { errorMessage: GENERIC_ASSESSMENT_ERROR_MESSAGE('heartbeat') }
                : heartbeat.error
                ? { errorMessage: heartbeat.error }
                : {
                      ...resiliencyConfig.highAvailability.heartbeat,
                      name: 'heartbeat-settings',
                      status: heartbeat.status as AssessmentStatus,
                      objectsInViolation: heartbeat.status === AssessmentStatus.OPTIMIZED ? [] : [resourceName],
                      totalObjectsAssessed: 1,
                      totalObjectsInViolation: heartbeat.status === AssessmentStatus.OPTIMIZED ? 0 : 1
                  },
            isEmpty(sqlServerServices) || !sqlServerServices.status
                ? { errorMessage: GENERIC_ASSESSMENT_ERROR_MESSAGE('sql-server-service') }
                : sqlServerServices.error
                ? { errorMessage: sqlServerServices.error }
                : {
                      ...resiliencyConfig.highAvailability.sqlServerService,
                      name: 'sqlServer-service',
                      status: sqlServerServices.status as AssessmentStatus,
                      objectsInViolation:
                          sqlServerServices.status !== AssessmentStatus.OPTIMIZED ? [databaseInstanceName] : [],
                      totalObjectsAssessed: 1,
                      totalObjectsInViolation: sqlServerServices.status !== AssessmentStatus.OPTIMIZED ? 1 : 0
                  }
        ];
        return haChecks;
    } catch (error) {
        logger.error('Error calculating high availability drift data:', error);
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
    initiateInstanceLevelHighAvailabilityAssessment,
    getHighAvailabilityDriftData,
    initiateHostLevelHighAvailabilityAssessment,
    getSqlServiceStartupAssessment,
    determinePreferredNode
};
