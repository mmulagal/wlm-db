import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import throat from 'throat';

import getLogger from '../../../utils/logger';
import { WorkloadInstance } from '../../../utils/common-types';
import { ASSESSMENT_SSM_EXECUTION_TIMEOUT, GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../../utils/consts';
import {
    AssessmentCategories,
    AssessmentStatus,
    ASSESSMENT_RESOURCE_TYPE
} from '../../../utils/continous-optimization-consts';
import type { AssessmentItemType, AssessmentErrorItemType } from '../../../routes/types/continuous-optimization.types';
import type { DriftAssessmentDetail } from '../../../utils/wad-consts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { registerJob } from '../../database/job-operations';
import { extractErrorMessage, sqlResponseParsing } from '../../../utils/utils';
import { collectAllOntapRecords, buildOntapProxyBase } from '../../../lib/ontap/ontap-gateway';

import { SNAPCENTER_ASSESSMENT_SCRIPT, type SnapCenterOntapData } from './ssm-scripts/snapcenter-assessment-scripts';
import { MSSQL_GOLDEN_CONFIG } from './golden-config';

const SVM_INFO_QUERY = { fields: 'svm' };
const SNAPCENTER_SNAPSHOT_QUERY = { comment: 'creator=snapcenter', max_records: 1, fields: 'comment' };

interface OntapVolumeSvmRecord {
    svm?: { uuid?: string; name?: string };
}

async function fetchSnapCenterVolumeOntapData(
    accountId: string,
    credentialsId: string,
    fsxFileSystem: string,
    region: string,
    volumeUuids: string[]
): Promise<SnapCenterOntapData> {
    const base = await buildOntapProxyBase(accountId, credentialsId, fsxFileSystem, region);

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
                            SNAPCENTER_SNAPSHOT_QUERY,
                            1
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

interface MssqlSnapCenterRelevantVolumeIds {
    dataVolumeIds: string[];
    tempdbVolumeIds: string[];
}

type MssqlSnapcenterWadResult = AssessmentItemType & { assessmentDetails: DriftAssessmentDetail[] };

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

        const snapCenterOntapData = await fetchSnapCenterVolumeOntapData(
            accountId,
            credentialsId,
            fsxFileSystem,
            region,
            mappedVolumesUuids ?? []
        );

        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [SNAPCENTER_ASSESSMENT_SCRIPT(instanceRecord, snapCenterOntapData)],
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
    assessmentData: MssqlSnapcenterAssessmentData | undefined,
    relevantVolumeIds: MssqlSnapCenterRelevantVolumeIds
): MssqlSnapcenterWadResult | AssessmentErrorItemType | undefined {
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

    const { dataVolumeIds, tempdbVolumeIds } = relevantVolumeIds;
    const tempdbVolumeIdSet = new Set(tempdbVolumeIds);
    // tempdb is transient and doesn't need application-consistent protection.
    const assessableVolumes = volumes.filter(v => !tempdbVolumeIdSet.has(v.volumeId));

    const { pluginServiceRunning = false } = standaloneCheck || {};

    const isVolumeProtected = (v: MssqlSnapcenterVolumeResult) =>
        v.hasSnapcenterSnapshot || (pluginServiceRunning && v.foundInSnapcenterLogs);

    const unprotectedVolumes = assessableVolumes.filter(v => !isVolumeProtected(v));

    const dataVolumeIdSet = new Set(dataVolumeIds);
    // Only report a violation when a data volume is unprotected; a log-only violation is not actionable on its own.
    const hasDataVolumeInViolation = unprotectedVolumes.some(v => dataVolumeIdSet.has(v.volumeId));
    const violatingVolumes = hasDataVolumeInViolation ? unprotectedVolumes : [];

    const isOptimized = assessableVolumes.length > 0 && violatingVolumes.length === 0;

    const assessmentDetails: DriftAssessmentDetail[] = assessableVolumes.map(v => {
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

    return {
        ...goldenConfig,
        recommended: goldenConfig.recommended ?? '',
        status: isOptimized ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED,
        totalObjectsAssessed: assessableVolumes.length,
        totalObjectsInViolation: violatingVolumes.length,
        objectsInViolation: violatingVolumes.map(v => ({
            ontapVolumeName: v.volumeName,
            ontapVolumeUuid: v.volumeId
        })),
        violationDetails: violatingVolumes.map(v => ({
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
    type MssqlSnapcenterAssessmentData,
    type MssqlSnapCenterRelevantVolumeIds,
    type MssqlSnapcenterWadResult
};
