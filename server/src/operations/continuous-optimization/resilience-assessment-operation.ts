import createError from 'http-errors';
import moment from 'moment';
import { isEmpty } from 'lodash-es';
import {
    ParameterDriftResponseType,
    ResilienceDriftAssessmentResponseType,
    SnapshotPolicyAssesmentDataType
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
import { HttpErrorCodes } from '../../utils/consts';
import {
    DatabaseInstance,
    databaseInstanceMetadata,
    StorageAssessment,
    WorkloadInstance
} from '../../utils/common-types';
import { isDemo, sqlResponseParsing } from '../../utils/utils';
import { getInstanceInfo } from '../database/database-operations';
import { getInstanceDetails, MappedOnTapVolumeResponse } from '../database-hosts-operations';
import { describeFSx, describeFSxStorageVirtualMachines } from '../../lib/aws/fsx';
import { CROSS_REGION_REPLICATION_SCRIPT } from '../workloads/mssql/resiliency-scripts';
import { GET_LATEST_SNAPSHOT_TIME } from '../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../aws/ssm-operations';
import { isFsxnAwsBackupEnabled } from '../aws/fsx-operations';

const isDemoFlow = isDemo();
const logger = getLogger();

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
    databaseInstanceId: string
) {
    logger.info('Getting resilience drift assessment for:', { credentialsId, databaseInstanceId, databaseHostId });
    try {
        const [snapshotPolicy, crrData] = await Promise.all([
            getSnapshotPolicyDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId),
            getCrrDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId)
        ]);

        const awsBackup =
            (await getAwsBackupDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId)) || {};
        const assessmentData: ResilienceDriftAssessmentResponseType = {
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
) {
    logger.info('Calculate snapshot policy drift data for:', { credentialsId, databaseInstanceId, databaseHostId });
    try {
        const [persistedConfigurationData] = await listDatabaseInstanceConfigData(
            accountId,
            region,
            credentialsId,
            databaseHostId,
            databaseInstanceId,
            AssessmentCategories.STORAGE // Snapshot-policy is stored with storage assesment data
        );

        if (isEmpty(persistedConfigurationData)) {
            const errorMessage = `No ${AssessmentCategories.RESILIENCY} assessment data found. Assessment is scheduled to run every 24 hours and may not have run on the instance. Please try again later.`;
            throw new Error(errorMessage);
        }
        const { config_data: configData } = persistedConfigurationData;
        const { volumes, errors } = configData as unknown as StorageAssessment;

        if (errors?.volumes) {
            return { errorMessage: errors.volumes };
        }

        const snapshotPolicyAssesmentData: SnapshotPolicyAssesmentDataType = {
            ...storageGoldenConfigData.resiliency.snapshotPolicy,
            timestamp: moment(persistedConfigurationData.creation_time).unix() * 1000,
            status: AssessmentStatus.NOT_OPTIMIZED,
            violations: [],
            totalObjectsAssessed: volumes.length,
            totalObjectsInViolation: 0
        };
        volumes.forEach(volume => {
            const volDetails = volume as Record<string, string>;
            const latestSnapshotTimestamp = new Date(
                parseInt(volDetails?.[OptimizeStorageConfigs.MOST_RECENT_SNAPSHOT_TIMESTAMP] ?? 0, 10)
            );
            if (
                isEmpty(volDetails?.[OptimizeStorageConfigs.SNAPSHOT_POLICY]) ||
                volDetails?.[OptimizeStorageConfigs.SNAPSHOT_POLICY] === 'none' ||
                latestSnapshotTimestamp <= new Date(moment().subtract(2, 'days').format())
            ) {
                snapshotPolicyAssesmentData.violations.push(volDetails?.name);
            }
        });
        if (isDemoFlow) {
            const instanceDetail = await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId);
            const { configsOptimized } =
                ((instanceDetail as unknown as DatabaseInstance)?.metadata as databaseInstanceMetadata) ?? {};
            if (configsOptimized?.STORAGE?.includes(OptimizeStorageConfigs.SNAPSHOT_POLICY)) {
                snapshotPolicyAssesmentData.violations = [];
            }
        }

        if (isEmpty(snapshotPolicyAssesmentData.violations)) {
            snapshotPolicyAssesmentData.status = AssessmentStatus.OPTIMIZED;
        }
        snapshotPolicyAssesmentData.totalObjectsInViolation = snapshotPolicyAssesmentData.violations.length;

        return snapshotPolicyAssesmentData;
    } catch (error) {
        logger.error('Error getting snapshot policy drift data', error);
        throw error;
    }
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
    const awsBackupAssesmentData: ParameterDriftResponseType = {
        ...storageGoldenConfigData.resiliency.awsBackup,
        name: 'scheduled-fsx-for-ontap-backups',
        status: AssessmentStatus.NOT_OPTIMIZED,
        totalObjectsInViolation: 0,
        recommended: 'To have AWS Backup enabled',
        objectsInViolation: []
    };

    // Fetch the FSX ID for given instance
    let newDatabaseInstanceDetails;
    let instanceDetails;

    try {
        instanceDetails = await getInstanceDetails(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId
        );

        newDatabaseInstanceDetails = instanceDetails.newDatabaseInstanceDetails;
    } catch (error) {
        const errorMessage = `Error while fetching instance details: ${accountId} ${databaseInstanceId}. Error: ${error}.`;
        logger.error(errorMessage);
        return errorMessage;
    }

    const { fsxn_ids: fileSystemId } = newDatabaseInstanceDetails || {};

    const fsxnInfo = await describeFSx(credentialsId, region, { FileSystemIds: [fileSystemId] });
    const isAwsBackupEnabled =
        fsxnInfo?.FileSystems?.[0]?.OntapConfiguration?.AutomaticBackupRetentionDays !== undefined;
    logger.info('Is AWS Backup enabled:', isAwsBackupEnabled);
    if (isAwsBackupEnabled) {
        awsBackupAssesmentData.totalObjectsAssessed = 1;
        awsBackupAssesmentData.status = AssessmentStatus.OPTIMIZED;
        return awsBackupAssesmentData;
    }

    // Fetch the OnTap volumes from storage assessment
    const [persistedConfigurationData] = await listDatabaseInstanceConfigData(
        accountId,
        region,
        credentialsId,
        databaseHostId,
        databaseInstanceId,
        AssessmentCategories.STORAGE
    );

    // Check that the persisted configuration data exists
    if (isEmpty(persistedConfigurationData)) {
        const errorMessage = `No ${AssessmentCategories.RESILIENCY} assessment data found. Assessment is scheduled to run every 24 hours and may not have run on the instance. Please try again later.`;
        throw new Error(errorMessage);
    }

    // Extract configuration data from the persisted data
    const { config_data: configData } = persistedConfigurationData;
    const { volumes, errors } = configData as unknown as StorageAssessment;

    // If there are errors related to volumes, return early
    if (errors?.volumes) {
        return { errorMessage: errors.volumes };
    }
    const ontapVolumeIds: string[] = [];
    const ontapVolumeMap: { name: string }[] = [];
    volumes.forEach(volume => {
        const volDetails = volume as Record<string, string>;
        ontapVolumeIds.push(volDetails?.uuid);
        ontapVolumeMap.push({ name: volDetails?.name });
    });

    logger.info('Ontap volume ids:', ontapVolumeIds);
    logger.info('Ontap volume map:', ontapVolumeMap);

    const backupResult = await isFsxnAwsBackupEnabled(
        credentialsId,
        region,
        fileSystemId,
        [...new Set(ontapVolumeIds)],
        ontapVolumeMap
    );

    const volumeUuidsInBackups =
        backupResult && typeof backupResult === 'object' && 'volumeUuidsInBackups' in backupResult
            ? backupResult.volumeUuidsInBackups
            : undefined;
    logger.info('Is on-demand backup enabled:', volumeUuidsInBackups);
    awsBackupAssesmentData.totalObjectsAssessed = 1;
    if (volumeUuidsInBackups) {
        const ontapVolumeSet = new Set(ontapVolumeIds);
        const backupVolumeSet = new Set(volumeUuidsInBackups);

        const allUuidsMatch = [...ontapVolumeSet].every(uuid => backupVolumeSet.has(uuid));
        awsBackupAssesmentData.status = allUuidsMatch ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
    } else {
        awsBackupAssesmentData.status = AssessmentStatus.NOT_OPTIMIZED;
    }
    awsBackupAssesmentData.totalObjectsInViolation = volumeUuidsInBackups ? 0 : 1;
    return awsBackupAssesmentData;
}

async function initiateCrossRegionResiliencyAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    jobId: string,
    instanceRecord: WorkloadInstance,
    instanceVolumeMapping: MappedOnTapVolumeResponse[]
) {
    logger.info('Initiating cross region resiliency assessment for:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        jobId
    });

    const { StorageVirtualMachines: svms = [] } = await describeFSxStorageVirtualMachines(
        credentialsId,
        region,
        instanceRecord.fsxFileSystem
    );

    instanceRecord.svmOntapUuid = svms.find(svm =>
        isDemoFlow ? svm : svm?.StorageVirtualMachineId === instanceRecord.svmId
    )?.UUID;

    if (isEmpty(instanceVolumeMapping)) {
        const errorMessage = `No ONTAP volumes found for the instance ${instanceRecord.name}.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const volumeRecords =
        Object.values(instanceVolumeMapping)
            ?.map(i => i?.volumeRecords)
            .flat() || [];
    instanceRecord.mappedVolumesUuids = volumeRecords.map(volume => volume.uuid as string);
    instanceRecord.mappedVolumeNames = volumeRecords.map(volume => volume.name as string);

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

    const { crrDetails, errorMessage } = response ? sqlResponseParsing(response) : { crrDetails: [], errorMessage: '' };

    const peerFileSystemIds = crrDetails
        ?.filter((crrDetail: { peerClusterFsxId: string }) => crrDetail.peerClusterFsxId)
        .map((crrDetail: { peerClusterFsxId: string }) => crrDetail.peerClusterFsxId);

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

                    crrDetails.forEach((crrDetail: { peerClusterFsxId: string; isCRREnabled: boolean }) => {
                        if (crrDetail.peerClusterFsxId === peerFileSystemId) {
                            crrDetail.isCRREnabled = !resourceArn?.includes(region);
                        }
                    });
                } catch (error: any) {
                    if (error?.name && error.name === 'FileSystemNotFound') {
                        crrDetails.forEach((crrDetail: { peerClusterFsxId: string; isCRREnabled: boolean }) => {
                            if (crrDetail.peerClusterFsxId === peerFileSystemId) {
                                crrDetail.isCRREnabled = true;
                            }
                        });
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
        const errorMessage =
            'No CRR assessment data found. Assessment is scheduled to run every 24 hours and may not have run on the instance. Please try again later.';
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
    getVolumesWithoutSnapshotPolicy
};
