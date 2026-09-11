import { AWSBackupAssessment, WorkloadInstance } from '../../../utils/common-types';
import { initiateAwsBackupAssessment, getAwsBackupDriftData } from '../resilience-awsBackup-operations';
import type { AssessmentItemType, AssessmentErrorItemType } from '../../../routes/types/continuous-optimization.types';
import ORACLE_GOLDEN_CONFIG from './golden-config';
import getLogger from '../../../utils/logger';

const logger = getLogger();

async function initiateOracleAWSBackupAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance
) {
    const {
        resourceName,
        name: databaseInstanceName,
        id: databaseInstanceId,
        fsxFileSystem: fileSystemId,
        mappedVolumesUuids = [],
        mappedVolumeNames = []
    } = instanceRecord;

    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;

    await initiateAwsBackupAssessment(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fileSystemId,
        resourceWithInstanceName,
        databaseInstanceName,
        parentJobId,
        mappedVolumesUuids,
        mappedVolumeNames
    );
}

function getOracleAwsBackupDriftData(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    awsBackupAssessmentData: AWSBackupAssessment
): AssessmentItemType | AssessmentErrorItemType {
    const [goldenConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'backup-configuration');
    return getAwsBackupDriftData(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        awsBackupAssessmentData,
        goldenConfig
    );
}

function getOracleUnregisteredBackupFinding(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    awsBackupAssessment?: AWSBackupAssessment,
    collectionError?: string
): AssessmentItemType | AssessmentErrorItemType | undefined {
    if (awsBackupAssessment) {
        return getOracleAwsBackupDriftData(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            awsBackupAssessment
        );
    }
    if (collectionError) {
        logger.warn('Surfacing Oracle unregistered backup collection error', {
            accountId,
            databaseHostId,
            databaseInstanceId,
            errorMessage: collectionError
        });
        const backupGoldenConfig = ORACLE_GOLDEN_CONFIG.find(e => e.id === 'backup-configuration');
        return backupGoldenConfig ? { ...backupGoldenConfig, errorMessage: collectionError } : undefined;
    }
}

export { initiateOracleAWSBackupAssessment, getOracleAwsBackupDriftData, getOracleUnregisteredBackupFinding };
