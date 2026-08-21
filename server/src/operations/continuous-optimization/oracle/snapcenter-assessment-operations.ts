import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import throat from 'throat';
import getLogger from '../../../utils/logger';
import { WorkloadInstance } from '../../../utils/common-types';
import { ASSESSMENT_SSM_EXECUTION_TIMEOUT } from '../../../utils/consts';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategoriesOracle,
    AssessmentStatus
} from '../../../utils/continous-optimization-consts';
import type { AssessmentItemType, AssessmentErrorItemType } from '../../../routes/types/continuous-optimization.types';
import type { DriftAssessmentDetail } from '../../../utils/wad-consts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { registerJob } from '../../database/job-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import { collectAllOntapRecords, buildOntapProxyBase, extractErrorMessage } from '../../../lib/ontap/ontap-gateway';
import { SNAPCENTER_ASSESSMENT_SCRIPT, type SnapCenterOntapData } from './ssm-scripts/snapcenter-assessment-scripts';
import ORACLE_GOLDEN_CONFIG from './golden-config';

const logger = getLogger();

const SVM_INFO_QUERY = { fields: 'svm' };
const SNAPCENTER_SNAPSHOT_QUERY = { comment: 'creator=snapcenter', max_records: 1, fields: 'comment' };

interface OntapVolumeSvmRecord {
    svm?: { uuid?: string; name?: string };
}

async function fetchSnapCenterVolumeOntapData(
    accountId: string,
    fsxFileSystem: string,
    region: string,
    volumeUuids: string[]
): Promise<SnapCenterOntapData> {
    const base = buildOntapProxyBase(accountId, fsxFileSystem, region);

    logger.info('Fetching SnapCenter volume ONTAP data via proxy-forwarder', {
        accountId,
        targetId: base.targetId,
        volumeCount: volumeUuids.length
    });

    const results = await Promise.all(
        volumeUuids.map(
            throat(5, async volumeUuid => {
                try {
                    const [svmRecords, snapshotRecords] = await Promise.all([
                        collectAllOntapRecords<OntapVolumeSvmRecord>(
                            base,
                            `api/storage/volumes/${volumeUuid}`,
                            SVM_INFO_QUERY
                        ),
                        collectAllOntapRecords<Record<string, unknown>>(
                            base,
                            `api/storage/volumes/${volumeUuid}/snapshots`,
                            SNAPCENTER_SNAPSHOT_QUERY
                        )
                    ]);
                    const [svmRecord] = svmRecords;
                    return {
                        volumeUuid,
                        info: {
                            svmId: svmRecord?.svm?.uuid ?? '',
                            svmName: svmRecord?.svm?.name ?? '',
                            hasSnapcenterSnapshot: snapshotRecords.length > 0
                        }
                    };
                } catch (error) {
                    logger.warn('Failed to fetch SnapCenter ONTAP data for volume', {
                        targetId: base.targetId,
                        volumeUuid,
                        err: error
                    });
                    return { volumeUuid, error: extractErrorMessage(error) };
                }
            })
        )
    );

    const response: SnapCenterOntapData['response'] = {};
    const errors: SnapCenterOntapData['errors'] = {};
    results.forEach(({ volumeUuid, info, error }) => {
        if (error) {
            errors[volumeUuid] = error;
        } else if (info) {
            response[volumeUuid] = info;
        }
    });

    return { response, errors };
}

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

interface SnapcenterRelevantVolumeIds {
    dataFileVolumeIds: string[];
    controlFileVolumeIds: string[];
    archiveLogVolumeIds: string[];
}

type OracleSnapcenterWadResult = AssessmentItemType & { assessmentDetails: DriftAssessmentDetail[] };

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
        const snapCenterOntapData = await fetchSnapCenterVolumeOntapData(
            accountId,
            fsxFileSystem,
            region,
            mappedVolumesUuids ?? []
        );

        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [SNAPCENTER_ASSESSMENT_SCRIPT(instanceRecord, snapCenterOntapData)],
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
    volumeIds: SnapcenterRelevantVolumeIds
): OracleSnapcenterWadResult | AssessmentErrorItemType | undefined {
    const [goldenConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'snapcenter-snapshot');

    if (!assessmentData || isEmpty(assessmentData)) {
        return undefined;
    }

    if (assessmentData.isDataguardPrimary) {
        return undefined;
    }

    const { volumes = [], standaloneCheck, errorMessage } = assessmentData;

    if (errorMessage) {
        return { ...goldenConfig, errorMessage };
    }

    const { dataFileVolumeIds = [], controlFileVolumeIds = [], archiveLogVolumeIds = [] } = volumeIds || {};

    const dataFileSet = new Set(dataFileVolumeIds);
    const dataFileVolumes = dataFileSet.size > 0 ? volumes.filter(v => dataFileSet.has(v.volumeId)) : volumes;

    const { pluginServiceRunning = false, sidFoundInLogs = false } = standaloneCheck || {};

    const isVolumeProtected = (v: SnapcenterVolumeResult) =>
        v.hasSnapcenterSnapshot || (pluginServiceRunning && sidFoundInLogs && v.foundInSnapcenterLogs);

    const areDataFileVolumesProtected = dataFileVolumes.length > 0 && dataFileVolumes.every(isVolumeProtected);
    const shouldEvaluateFallbackFileTypes = dataFileSet.size > 0 && !areDataFileVolumesProtected;
    const fallbackVolumeSet = new Set([...dataFileVolumeIds, ...controlFileVolumeIds, ...archiveLogVolumeIds]);
    const volumesToAssess = shouldEvaluateFallbackFileTypes
        ? volumes.filter(v => fallbackVolumeSet.has(v.volumeId))
        : dataFileVolumes;
    const unprotectedVolumes = volumesToAssess.filter(v => !isVolumeProtected(v));
    const isOptimized = volumesToAssess.length > 0 && unprotectedVolumes.length === 0;

    const assessmentDetails: DriftAssessmentDetail[] = volumesToAssess.map(v => {
        const protected_ = isVolumeProtected(v);
        const status = protected_ ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;
        return {
            id: v.volumeId,
            name: v.volumeName,
            svmName: v.svmName,
            status,
            metadata: {
                components: [
                    {
                        parameter: 'snapcenter-protection',
                        current: protected_ ? 'configured' : 'not-configured',
                        recommended: 'configured',
                        status
                    }
                ]
            }
        };
    });

    const snapEntryRecommended = goldenConfig.recommended ?? '';
    return {
        ...goldenConfig,
        recommended: snapEntryRecommended,
        status: isOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
        totalObjectsAssessed: volumesToAssess.length,
        totalObjectsInViolation: unprotectedVolumes.length,
        objectsInViolation: unprotectedVolumes.map(v => ({
            ontapVolumeName: v.volumeName,
            ontapVolumeUuid: v.volumeId
        })),
        violationDetails: unprotectedVolumes.map(v => ({
            objectName: v.volumeName ?? '',
            objectType: ASSESSMENT_RESOURCE_TYPE.VOLUME,
            value: 'SnapCenter protection not configured',
            recommended: 'SnapCenter protection enabled'
        })),
        assessmentDetails
    };
}

export {
    initiateSnapCenterAssessmentCollection,
    calculateSnapCenterDrift,
    fetchSnapCenterVolumeOntapData,
    type SnapcenterAssessmentData,
    type OracleSnapcenterWadResult
};
