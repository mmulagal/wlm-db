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
    AwsWellArchitecturedPillars,
    OptimizeStorageConfigs,
    SEVERITY
} from '../../utils/continous-optimization-consts';
import { HttpErrorCodes } from '../../utils/consts';
import { StorageAssessment } from '../../utils/common-types';

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
        timestamp: moment(persistedConfigurationData.creation_time).unix() * 1000,
        tags: [AwsWellArchitecturedPillars.RELIABILITY],
        severity: SEVERITY.WARNING,
        status: AssessmentStatus.NOT_OPTIMIZED,
        violations: []
    };
    volumes.forEach(volume => {
        const volDetails = volume as Record<string, string>;
        if (isEmpty(volDetails[OptimizeStorageConfigs.SNAPSHOT_POLICY])) {
            snapshotPolicyAssesmentData.violations.push(volDetails?.name);
        }
    });

    if (isEmpty(snapshotPolicyAssesmentData.violations)) {
        snapshotPolicyAssesmentData.status = AssessmentStatus.OPTIMIZED;
    }

    return snapshotPolicyAssesmentData;
}

export { getResilienceDriftAssessment };
