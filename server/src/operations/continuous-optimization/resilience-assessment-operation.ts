import createError from 'http-errors';
import moment from 'moment';
import { compact, isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import {
    DriftAssessmentResponseType,
    GenericAssessmentResponseType,
    OntapVolumeType,
    ParameterDriftResponseType
} from '../../routes/types/continuous-optimization.types';
import getLogger from '../../utils/logger';
import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../../lib/database/database-instance-config';
import {
    AssessmentCategories,
    AssessmentStatus,
    OptimizeStorageConfigs,
    SEVERITY,
    AwsWellArchitecturedPillars,
    ASSESSMENT_RESOURCE_TYPE
} from '../../utils/continous-optimization-consts';
import storageGoldenConfigData from './golden-configs/storage';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE, HttpErrorCodes } from '../../utils/consts';
import {
    DatabaseInstance,
    DatabaseInstanceMetadata,
    StorageAssessment,
    WorkloadInstance,
    MappedOnTapVolumeResponse,
    AWSBackupAssessment
} from '../../utils/common-types';
import { isDemo, sqlResponseParsing } from '../../utils/utils';
import { getInstanceInfo } from '../database/database-operations';
import { describeFSx } from '../../lib/aws/fsx';
import { CROSS_REGION_REPLICATION_SCRIPT } from '../workloads/mssql/resiliency-scripts';
import { GET_LATEST_SNAPSHOT_TIME } from '../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../aws/ssm-operations';
import { isFsxnAwsBackupEnabled } from '../aws/fsx-operations';
import { registerJob, updateJobDetails } from '../database/job-operations';

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

        const command = [GET_LATEST_SNAPSHOT_TIME(volumesToCheck, fsxId, region)];
        const ssmComment = 'Get snapshot copy details for volumes';
        const rawResponse = await callSsmExecution(
            credentialsId,
            instanceRecord.region,
            command,
            instanceRecord.activeNodeInstanceid,
            ssmComment,
            accountId
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
                const snapshotTimestamp = new Date(res?.[volDetail?.uuid]).getTime().toString();
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
    fields: string = ''
) {
    logger.info('Getting resilience drift assessment for:', {
        credentialsId,
        databaseInstanceId,
        databaseHostId,
        fields
    });
    const fieldsArray = fields ? fields.split(',') : [];
    const shouldTriggerSnapshotPolicyAssessment =
        isEmpty(fieldsArray) || fieldsArray.includes(AssessmentCategories.SNAPSHOT_POLICY);
    const shouldTriggerCrrAssessment = isEmpty(fieldsArray) || fieldsArray.includes(AssessmentCategories.CRR);
    const shouldTriggerAwsBackupAssessment =
        isEmpty(fieldsArray) || fieldsArray.includes(AssessmentCategories.AWS_BACKUP);

    try {
        const [snapshotPolicy, crrData, awsBackup] = await Promise.all([
            shouldTriggerSnapshotPolicyAssessment
                ? getSnapshotPolicyDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
                : Promise.resolve(undefined),
            shouldTriggerCrrAssessment
                ? getCrrDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
                : Promise.resolve(undefined),
            shouldTriggerAwsBackupAssessment
                ? getAwsBackupDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
                : Promise.resolve(undefined)
        ]);

        const assessmentData: DriftAssessmentResponseType = {
            snapshotPolicy,
            crr: crrData,
            awsBackup: awsBackup as ParameterDriftResponseType
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
    databaseInstanceId: string
): Promise<GenericAssessmentResponseType> {
    logger.info('Calculate snapshot policy drift data for:', { credentialsId, databaseInstanceId, databaseHostId });
    let errorMessage;
    const snapshotPolicyAssessmentData: ParameterDriftResponseType = {
        ...storageGoldenConfigData.resiliency.snapshotPolicy,
        name: AssessmentCategories.SNAPSHOT_POLICY,
        status: AssessmentStatus.NOT_OPTIMIZED,
        objectsInViolation: [],
        totalObjectsInViolation: 0
    };
    try {
        const [[persistedConfigurationData], [mappedVolumesData]] = await Promise.all([
            listDatabaseInstanceConfigData(
                accountId,
                region,
                credentialsId,
                databaseHostId,
                databaseInstanceId,
                AssessmentCategories.STORAGE
            ),
            listDatabaseInstanceConfigData(
                accountId,
                region,
                credentialsId,
                databaseHostId,
                databaseInstanceId,
                AssessmentCategories.MAPPED_ONTAP_VOLUMES // Snapshot-policy is stored with storage assesment data
            )
        ]);

        if (isEmpty(persistedConfigurationData)) {
            errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.SNAPSHOT_POLICY);
            return { errorMessage };
        }
        const { config_data: configData } = persistedConfigurationData;
        const { volumes, errors } = configData as unknown as StorageAssessment;

        if (errors?.volumes) {
            return { errorMessage: errors.volumes };
        }

        // Check if mapped volumes data is available and filter out only data and log volumes
        let dataLogVolumeUuids: string[] = [];
        if (!isEmpty(mappedVolumesData)) {
            const { config_data: mappedVolumes } = mappedVolumesData;
            ({ dataLogVolumeUuids } = filterDataLogVolumes(mappedVolumes as unknown as MappedOnTapVolumeResponse));
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
    logger.info('Initiating AWS Backup assessment for:', {
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
    const jobName = 'AWS backup assessment';
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
        const fsxnInfo = await describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId] });
        isAWSBackupEnabled = fsxnInfo?.FileSystems?.[0]?.OntapConfiguration?.AutomaticBackupRetentionDays !== undefined;
        logger.debug('Is AWS Backup enabled:', isAWSBackupEnabled);
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
                (await isFsxnAwsBackupEnabled(credentialsId, region, fileSystemId, dataLogVolumeUuids, undefined)) ||
                {};

            logger.debug('Is on-demand backup enabled:', volumeUuidsInBackups);

            if (volumeUuidsInBackups && !isEmpty(volumeUuidsInBackups)) {
                const backupVolumeSet = new Set(volumeUuidsInBackups);
                const allUuidsMatch = [...volumeUuidsInBackups].every(uuid => backupVolumeSet.has(uuid));
                isAWSBackupEnabled = allUuidsMatch;
            }
        }
    } catch (error) {
        errorMessage = `Error while assessing aws backup: ${error}.`;
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
    databaseInstanceId: string
) {
    logger.info('Get AWS Backup assessment data', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    });

    const [persistedConfigurationData] = await listDatabaseInstanceConfigData(
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseInstanceId,
        AssessmentCategories.AWS_BACKUP
    );
    if (isEmpty(persistedConfigurationData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.AWS_BACKUP);
        logger.error(errorMessage);
        return { errorMessage } as ParameterDriftResponseType & { errorMessage: string };
    }

    const { fileSystemId, isAWSBackupEnabled, errorMessage } =
        persistedConfigurationData.config_data as unknown as AWSBackupAssessment;
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
            false
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
                            accountId
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
    databaseInstanceId: string
) {
    logger.info('Calculate crr drift data for:', {
        accountId,
        region,
        credentialsId,
        databaseInstanceId,
        databaseHostId
    });
    const [persistedConfigurationData] = await listDatabaseInstanceConfigData(
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseInstanceId,
        AssessmentCategories.CRR
    );
    if (isEmpty(persistedConfigurationData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.CRR);
        return { errorMessage } as ParameterDriftResponseType & { errorMessage: string };
    }

    try {
        const { crrDetails } = persistedConfigurationData.config_data as { crrDetails: any[] };
        const allVolumesOptimized: boolean = crrDetails.every(
            (detail: { isCRREnabled: boolean }) => detail.isCRREnabled
        );

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
export {
    getResilienceDriftAssessment,
    initiateCrossRegionResiliencyAssessment,
    collectSnapshotCopyData,
    collectVolumeSnapshotCopiesData,
    getVolumesWithoutSnapshotPolicy,
    initiateAWSBackupAssessment
};
