import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import getLogger from '../../../utils/logger';
import { WorkloadInstance } from '../../../utils/common-types';
import { ASSESSMENT_SSM_EXECUTION_TIMEOUT } from '../../../utils/consts';
import {
    AssessmentCategoriesOracle,
    AssessmentStatus,
    AwsWellArchitecturedPillars
} from '../../../utils/continous-optimization-consts';
import { OracleGenericParameterDriftResponseType } from '../../../routes/types/oracle-continuous-optimization.types';
import { callSsmExecution } from '../../aws/ssm-operations';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { registerJob } from '../../database/job-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import { SNAPCENTER_ASSESSMENT_SCRIPT } from './ssm-scripts/snapcenter-assessment-scripts';
import GOLDEN_CONFIG from './golden-config';

const logger = getLogger();

interface SnapcenterVolumeResult {
    svmId: string;
    svmName: string;
    volumeId: string;
    volumeName: string;
    hasSnapcenterSnapshot: boolean;
    foundInSnapcenterLogs: boolean;
}

interface SnapcenterStandaloneCheck {
    pluginServiceRunning: boolean;
    sidFoundInLogs: boolean;
}

interface SnapcenterAssessmentData {
    isDataguardPrimary: boolean;
    volumes: SnapcenterVolumeResult[];
    standaloneCheck: SnapcenterStandaloneCheck;
    errorMessage: string;
}

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
        mappedVolumeError,
        fsxFileSystem
    } = instanceRecord;

    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;

    logger.info('Initiating SnapCenter snapshot assessment collection', {
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

    if (isEmpty(mappedVolumesUuids)) {
        errorMessage = mappedVolumeError
            ? `Found no FSx for ONTAP volumes for the database ${databaseInstanceName}. Oracle mount discovery failed: ${mappedVolumeError}. Cannot assess SnapCenter snapshots.`
            : `Found no FSx for ONTAP volumes for the database ${databaseInstanceName}. Cannot assess SnapCenter snapshots.`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        await registerJob(accountId, credentialsId, region, {
            name: 'SnapCenter snapshot assessment',
            description: `SnapCenter snapshot assessment for ${resourceWithInstanceName}`,
            resourceName: resourceWithInstanceName,
            startTime: Date.now(),
            endTime: Date.now(),
            status: jobStatus,
            type: JOBTYPE.ASSESSMENT,
            parentJobId,
            error: errorMessage
        });
        return;
    }

    try {
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [SNAPCENTER_ASSESSMENT_SCRIPT(instanceRecord)],
            ec2InstanceId: activeNodeInstanceid,
            comment: 'SnapCenter snapshot assessment for Oracle instance',
            accountId,
            executionTimeout: ASSESSMENT_SSM_EXECUTION_TIMEOUT,
            shouldReadFromCloudWatchLogs: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });

        let assessmentData: SnapcenterAssessmentData;
        try {
            assessmentData = JSON.parse(response);
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
                config_data_type: AssessmentCategoriesOracle.SNAPCENTER_SNAPSHOT,
                config_data: assessmentData
            }
        ]);

        logger.info('SnapCenter snapshot assessment data stored', {
            accountId,
            databaseHostId,
            databaseInstanceId,
            volumeCount: assessmentData.volumes?.length,
            pluginRunning: assessmentData.standaloneCheck?.pluginServiceRunning
        });
    } catch (error) {
        logger.error('Error during SnapCenter snapshot assessment collection', {
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
    assessmentData: SnapcenterAssessmentData,
    dataFileVolumeIds: string[]
): OracleGenericParameterDriftResponseType | { errorMessage: string } | undefined {
    if (!assessmentData || isEmpty(assessmentData)) {
        return undefined;
    }

    if (assessmentData.isDataguardPrimary) {
        return undefined;
    }

    const goldenConfig = GOLDEN_CONFIG.resiliency.snapcenterSnapshot;
    const { volumes = [], standaloneCheck, errorMessage } = assessmentData;

    if (errorMessage) {
        return { errorMessage };
    }

    const dataFileSet = new Set(dataFileVolumeIds);
    const dataFileVolumes = dataFileSet.size > 0 ? volumes.filter(v => dataFileSet.has(v.volumeId)) : volumes;

    const { pluginServiceRunning = false, sidFoundInLogs = false } = standaloneCheck || {};

    const isVolumeProtected = (v: SnapcenterVolumeResult) =>
        v.hasSnapcenterSnapshot || (pluginServiceRunning && sidFoundInLogs && v.foundInSnapcenterLogs);

    const allProtected = dataFileVolumes.length > 0 && dataFileVolumes.every(isVolumeProtected);
    const unprotectedVolumes = dataFileVolumes.filter(v => !isVolumeProtected(v));

    return {
        name: goldenConfig.name,
        status: allProtected ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
        recommended: goldenConfig.recommended,
        severity: goldenConfig.severity,
        recommendation: goldenConfig.recommendation,
        tags: goldenConfig.tags as AwsWellArchitecturedPillars[],
        resourceType: goldenConfig.resourceType,
        totalObjectsAssessed: dataFileVolumes.length,
        totalObjectsInViolation: unprotectedVolumes.length,
        objectsInViolation: unprotectedVolumes.map(v => ({
            ontapVolumeName: v.volumeName,
            ontapVolumeUuid: v.volumeId
        }))
    };
}

export { initiateSnapCenterAssessmentCollection, calculateSnapCenterDrift, SnapcenterAssessmentData };
