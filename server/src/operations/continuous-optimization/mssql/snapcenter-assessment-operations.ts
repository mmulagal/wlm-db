import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';

import getLogger from '../../../utils/logger';
import { WorkloadInstance } from '../../../utils/common-types';
import { ASSESSMENT_SSM_EXECUTION_TIMEOUT, GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../../utils/consts';
import { AssessmentCategories, AssessmentStatus } from '../../../utils/continous-optimization-consts';
import type { AssessmentItemType, AssessmentErrorItemType } from '../../../routes/types/continuous-optimization.types';
import { callSsmExecution } from '../../aws/ssm-operations';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { registerJob } from '../../database/job-operations';
import { sqlResponseParsing } from '../../../utils/utils';

import { SNAPCENTER_ASSESSMENT_SCRIPT } from './ssm-scripts/snapcenter-assessment-scripts';
import { MSSQL_GOLDEN_CONFIG } from './golden-config';

interface MssqlSnapcenterVolumeResult {
    svmId: string;
    svmName: string;
    volumeId: string;
    volumeName: string;
    hasSnapcenterSnapshot: boolean;
    foundInSnapcenterLogs: boolean;
}

interface MssqlSnapcenterStandaloneCheck {
    pluginServiceRunning: boolean;
}

interface MssqlSnapcenterAssessmentData {
    volumes: MssqlSnapcenterVolumeResult[];
    standaloneCheck: MssqlSnapcenterStandaloneCheck;
    errorMessage: string;
}

const logger = getLogger();

async function initiateSnapCenterAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance
) {
    const {
        resourceName,
        id: databaseInstanceId,
        name: databaseInstanceName,
        activeNodeInstanceid,
        mappedVolumesUuids,
        fsxFileSystem
    } = instanceRecord;

    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;

    logger.info('Initiating SnapCenter snapshot assessment collection for MSSQL', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId,
        databaseInstanceId,
        databaseInstanceName,
        fsxId: fsxFileSystem
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    try {
        if (isEmpty(mappedVolumesUuids)) {
            const noVolumesMessage = `Found no FSx for ONTAP volumes for the database ${databaseInstanceName}. Cannot assess SnapCenter snapshots.`;
            logger.error(noVolumesMessage);
            throw new Error(noVolumesMessage);
        }

        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [SNAPCENTER_ASSESSMENT_SCRIPT(instanceRecord)],
            ec2InstanceId: activeNodeInstanceid,
            comment: 'SnapCenter snapshot assessment for MSSQL instance',
            accountId,
            executionTimeout: ASSESSMENT_SSM_EXECUTION_TIMEOUT,
            shouldReadFromCloudWatchLogs: true
        });

        let assessmentData: MssqlSnapcenterAssessmentData;
        try {
            assessmentData = sqlResponseParsing(response) as MssqlSnapcenterAssessmentData;
        } catch {
            throw new Error(`Failed to parse SnapCenter assessment response: ${response?.substring(0, 500)}`);
        }

        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategories.SNAPCENTER_SNAPSHOT,
                config_data: assessmentData
            }
        ]);

        logger.info('SnapCenter snapshot assessment data stored for MSSQL', {
            accountId,
            databaseHostId,
            databaseInstanceId,
            volumeCount: assessmentData.volumes?.length,
            pluginRunning: assessmentData.standaloneCheck?.pluginServiceRunning
        });
    } catch (error) {
        logger.error('Error during SnapCenter snapshot assessment collection for MSSQL', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            fsxId: fsxFileSystem,
            error
        });
        errorMessage = `Error during SnapCenter snapshot assessment collection. ${
            error instanceof Error ? error.message : String(error)
        }`;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await registerJob(accountId, credentialsId, region, {
            name: 'SnapCenter snapshot assessment',
            description: `SnapCenter snapshot assessment for ${resourceWithInstanceName}`,
            resourceName: resourceWithInstanceName,
            startTime: Date.now(),
            endTime: Date.now(),
            status: jobStatus,
            type: JOBTYPE.ASSESSMENT,
            parentJobId,
            ...(errorMessage && { error: errorMessage })
        });
    }
}

function calculateSnapCenterDrift(
    assessmentData?: MssqlSnapcenterAssessmentData
): AssessmentItemType | AssessmentErrorItemType | undefined {
    const [goldenConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'snapcenter-snapshot');

    if (!assessmentData || isEmpty(assessmentData)) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.SNAPCENTER_SNAPSHOT);
        logger.error(errorMessage);
        return { ...goldenConfig, errorMessage };
    }

    const { volumes = [], standaloneCheck, errorMessage } = assessmentData;

    if (errorMessage) {
        return { ...goldenConfig, errorMessage };
    }

    const { pluginServiceRunning = false } = standaloneCheck || {};

    const isVolumeProtected = (v: MssqlSnapcenterVolumeResult) =>
        v.hasSnapcenterSnapshot || (pluginServiceRunning && v.foundInSnapcenterLogs);

    const unprotectedVolumes = volumes.filter(v => !isVolumeProtected(v));
    const isOptimized = volumes.length > 0 && unprotectedVolumes.length === 0;

    return {
        ...goldenConfig,
        recommended: goldenConfig.recommended ?? '',
        status: isOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
        totalObjectsAssessed: volumes.length,
        totalObjectsInViolation: unprotectedVolumes.length,
        objectsInViolation: unprotectedVolumes.map(v => ({
            ontapVolumeName: v.volumeName,
            ontapVolumeUuid: v.volumeId
        }))
    };
}

export { initiateSnapCenterAssessmentCollection, calculateSnapCenterDrift, type MssqlSnapcenterAssessmentData };
