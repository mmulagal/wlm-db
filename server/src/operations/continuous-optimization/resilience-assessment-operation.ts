import createError from 'http-errors';
import moment from 'moment';
import { isEmpty } from 'lodash-es';
import {
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
    OptimizeStorageConfigs
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
import { MappedOnTapVolumeResponse } from '../database-hosts-operations';
import { describeFSx, describeFSxStorageVirtualMachines } from '../../lib/aws/fsx';
import { CROSS_REGION_REPLICATION_SCRIPT } from '../workloads/mssql/resiliency-scripts';
import { callSsmExecution } from '../aws/ssm-operations';

const isDemoFlow = isDemo();
const logger = getLogger();

async function getResilienceDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Getting resilience drift assessment for:', { credentialsId, databaseInstanceId, databaseHostId });
    try {
        const snapshotPolicy =
            (await getSnapshotPolicyDriftData(accountId, credentialsId, region, databaseHostId, databaseInstanceId)) ||
            Promise.resolve({});
        const assessmentData: ResilienceDriftAssessmentResponseType = {
            snapshotPolicy
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
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
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
            if (
                isEmpty(volDetails[OptimizeStorageConfigs.SNAPSHOT_POLICY]) ||
                volDetails[OptimizeStorageConfigs.SNAPSHOT_POLICY] === 'none'
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
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, (error as Error).message);
    }
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
                    if (error?.Code && error.Code === 'FileSystemNotFound') {
                        crrDetails.forEach((crrDetail: { peerClusterFsxId: string; isCRREnabled: boolean }) => {
                            crrDetail.isCRREnabled = true;
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

export { getResilienceDriftAssessment, initiateCrossRegionResiliencyAssessment };
