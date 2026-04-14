import { AWSBackupAssessment, WorkloadInstance } from '../../../utils/common-types';
import { initiateAwsBackupAssessment, getAwsBackupDriftData } from '../resilience-awsBackup-operations';
import { GenericParameterDriftResponseType } from '../../../routes/types/oracle-continuous-optimization.types';
import GOLDEN_CONFIG from './golden-config';

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
): GenericParameterDriftResponseType {
    return getAwsBackupDriftData(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        awsBackupAssessmentData,
        GOLDEN_CONFIG.resiliency.awsBackup
    ) as GenericParameterDriftResponseType;
}

export { initiateOracleAWSBackupAssessment, getOracleAwsBackupDriftData };
