import createError from 'http-errors';
import moment from 'moment';
import { isEmpty } from 'lodash-es';
import {
    ResilienceDriftAssessmentResponseType,
    SnapshotPolicyAssesmentDataType
} from '../../routes/types/continuous-optimization.types';
import getLogger from '../../utils/logger';
import { listDatabaseInstanceConfigData } from '../../lib/database/database-instance-config';
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
import { GET_VOLUME_SNAPSHOT_COPIES } from '../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../aws/ssm-operations';

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

        const command = [GET_VOLUME_SNAPSHOT_COPIES(volumesToCheck, fsxId, region)];
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

        if (isDemo()) {
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

export {
    getResilienceDriftAssessment,
    collectSnapshotCopyData,
    collectVolumeSnapshotCopiesData,
    getVolumesWithoutSnapshotPolicy
};
