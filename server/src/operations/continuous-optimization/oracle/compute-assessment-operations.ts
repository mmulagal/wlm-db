import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';

import { ASSESSMENT_SSM_EXECUTION_TIMEOUT } from '../../../utils/consts';
import {
    AssessmentCategoriesOracle,
    ORACLE_COMPUTE_HOST_OS_ASSESSMENT_CONFIGS
} from '../../../utils/continous-optimization-consts';
import { parseMultipleCommandResponse } from '../../../utils/utils';
import { ComputeHostOsAssessment, ResourceAssessmentData, WorkloadInstance } from '../../../utils/common-types';
import { RESOURCE_DEFAULT_SELECT_FIELDS } from '../../../utils/database-consts';
import getLogger from '../../../utils/logger';

import { GenericViolationResponseType } from '../../../routes/types/continuous-optimization.types';

import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { listResources } from '../../../lib/database/db';

import { callSsmExecution } from '../../aws/ssm-operations';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { updateDatabaseHostAssessmentData } from '../../database/database-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';

import { ComputeDriftEntry, ComputeHostOsDriftTopLevel, StorageIscsiAssessment } from './common-types';
import storageGoldenConfigData from './golden-config';
import {
    HOST_OS_COMPUTE_ASSESSMENT,
    ORACLE_PARAMS_COMPUTE_ASSESSMENT
} from './ssm-scripts/compute-host-os-assessment-scripts';
import { createAssessment, createViolationDetail } from './storage-assessment-operations';

const logger = getLogger();

const osIsciConfigData = storageGoldenConfigData.configuration.os_iscsi;
const COMPUTE_HOST_OS_CONFIG_NAMES = new Set<string>(ORACLE_COMPUTE_HOST_OS_ASSESSMENT_CONFIGS);

const MISSING_DATA_ERROR_MESSAGE =
    'No compute assessment data found. Assessment is scheduled to run every 24 hours and may not have run on the instance. Please try again later.';

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Evaluate drift for the supplied compute configs and populate `drift` by response key.
 * When the source data is missing, each requested config gets an `errorMessage` entry so the
 * API response always surfaces all 4 top-level fields.
 */
function calculateComputeOsDrift(
    ec2InstanceId: string,
    databaseInstanceName: string,
    assessmentData: StorageIscsiAssessment | undefined,
    configNames: Set<string>
): ComputeHostOsDriftTopLevel {
    logger.info('Fetching compute OS configuration drift', { ec2InstanceId, databaseInstanceName });
    const drift: ComputeHostOsDriftTopLevel = {};
    const os = assessmentData?.os;
    const configsToEvaluate = osIsciConfigData.filter(
        c => COMPUTE_HOST_OS_CONFIG_NAMES.has(c.name) && configNames.has(c.name)
    );

    if (!os || isEmpty(os)) {
        configsToEvaluate.forEach(config => {
            switch (config.parameter) {
                case 'transparent-hugepages':
                    drift.transparentHugepages = { errorMessage: MISSING_DATA_ERROR_MESSAGE };
                    break;
                case 'tcp-advanced-options':
                    drift.tcpAdvancedOptions = { errorMessage: MISSING_DATA_ERROR_MESSAGE };
                    break;
                case 'filesystems-io-options':
                    drift.filesystemsIoOptions = { errorMessage: MISSING_DATA_ERROR_MESSAGE };
                    break;
                case 'multiblock-readcount':
                    drift.multiblockReadcount = { errorMessage: MISSING_DATA_ERROR_MESSAGE };
                    break;
                default:
                    break;
            }
        });
        return drift;
    }

    configsToEvaluate.forEach(config => {
        let violationDetails: GenericViolationResponseType[] = [];

        switch (config.parameter) {
            case 'transparent-hugepages': {
                const thpData = os?.['transparent-hugepages'];
                if (thpData?.['thp-disabled'] === false) {
                    violationDetails.push(
                        createViolationDetail(
                            'transparent-hugepages',
                            'configuration',
                            `${thpData?.['thp-value'] || 'enabled'}`,
                            'always madvise [never]'
                        )
                    );
                }
                drift.transparentHugepages = createAssessment(
                    config,
                    1,
                    [ec2InstanceId],
                    violationDetails
                ) as ComputeDriftEntry;
                break;
            }

            case 'tcp-advanced-options': {
                const tcpData = os?.['tcp-advanced-options'];
                const tcpFeatures = tcpData?.['tcp-features'] || {};
                const requiredFeatures = ['tcp-sack-enabled', 'tcp-window-scaling-enabled', 'tcp-timestamps-enabled'];
                const disabledFeatures = requiredFeatures.filter(
                    feature => !tcpFeatures[feature as keyof typeof tcpFeatures]
                );
                violationDetails = disabledFeatures.map(feature =>
                    createViolationDetail(feature.replace('-enabled', ''), 'configuration', '0', '1')
                );
                drift.tcpAdvancedOptions = createAssessment(
                    config,
                    1,
                    [ec2InstanceId],
                    violationDetails
                ) as ComputeDriftEntry;
                break;
            }

            case 'filesystems-io-options': {
                const oracleParamsData = os?.['oracle-parameters']?.['filesystemio-options'];
                if (oracleParamsData?.found === false || oracleParamsData?.value?.toLowerCase() !== 'setall') {
                    violationDetails = [
                        createViolationDetail(
                            'filesystemio_options',
                            'oracle parameter',
                            `${oracleParamsData?.value || 'unknown'}`,
                            'SETALL'
                        )
                    ];
                }
                drift.filesystemsIoOptions = createAssessment(
                    config,
                    1,
                    [ec2InstanceId],
                    violationDetails
                ) as ComputeDriftEntry;
                break;
            }

            case 'multiblock-readcount': {
                const oracleParamsData =
                    os?.['oracle-parameters-from-init']?.['db-file-multiblock-read-count-in-init'] || [];
                violationDetails = oracleParamsData
                    .filter(paramRecord => paramRecord['parameter-found'])
                    .map(paramRecord =>
                        createViolationDetail(
                            'db_file_multiblock_read_count',
                            'oracle parameter',
                            `${paramRecord['parameter-value']}`,
                            'db_file_multiblock_read_count should not be set'
                        )
                    );
                drift.multiblockReadcount = createAssessment(
                    config,
                    1,
                    [ec2InstanceId],
                    violationDetails
                ) as ComputeDriftEntry;
                break;
            }

            default:
                break;
        }
    });

    return drift;
}

const HOST_LEVEL_COMPUTE_CONFIG_NAMES = new Set(['transparent-hugepages', 'tcp-advanced-options']);
const ORACLE_PARAMS_COMPUTE_CONFIG_NAMES = new Set(['filesystems-io-options', 'multiblock-readcount']);

/**
 * Drift for the four compute host/OS checks (GH-8882-1).
 * THP/TCP drift from `resource.assessment_data.computeHostOs` (host level).
 * Oracle params (filesystemio, multiblock) from `database_instance_config_data` compute row (instance level).
 */
function calculateComputeHostOsDrift(
    ec2InstanceId: string,
    databaseInstanceName: string,
    computeHostOs: ComputeHostOsAssessment | undefined,
    oracleParamsConfigData: unknown
): ComputeHostOsDriftTopLevel {
    const hostPayload = computeHostOs
        ? ({
              os: {
                  'transparent-hugepages': computeHostOs.transparentHugepages,
                  'tcp-advanced-options': computeHostOs.tcpAdvancedOptions
              }
          } as StorageIscsiAssessment)
        : undefined;

    const hostDrift = calculateComputeOsDrift(
        ec2InstanceId,
        databaseInstanceName,
        hostPayload,
        HOST_LEVEL_COMPUTE_CONFIG_NAMES
    );

    const oracleDrift = calculateComputeOsDrift(
        ec2InstanceId,
        databaseInstanceName,
        oracleParamsConfigData as StorageIscsiAssessment | undefined,
        ORACLE_PARAMS_COMPUTE_CONFIG_NAMES
    );

    return { ...hostDrift, ...oracleDrift };
}

async function persistComputeHostOsToResource(
    accountId: string,
    databaseHostId: string,
    hostOsData: Record<string, unknown> | undefined
) {
    if (!hostOsData || isEmpty(hostOsData)) {
        return;
    }
    const thpData = hostOsData['transparent-hugepages'] as Record<string, unknown> | undefined;
    const tcpData = hostOsData['tcp-advanced-options'] as Record<string, unknown> | undefined;
    if (!thpData && !tcpData) {
        return;
    }

    const resources =
        (await listResources({
            accountId,
            resourceId: databaseHostId,
            selectKeys: [...new Set([...RESOURCE_DEFAULT_SELECT_FIELDS, 'assessment_data'])]
        })) || [];

    if (isEmpty(resources)) {
        return;
    }

    await Promise.all(
        resources.map(async ({ credentials_id: resCreds, assessment_data: assessmentData }) => {
            const existing = (assessmentData ?? {}) as ResourceAssessmentData;
            const existingComputeHostOs = existing.computeHostOs ?? {};
            const updated: ResourceAssessmentData = {
                ...existing,
                computeHostOs: {
                    ...existingComputeHostOs,
                    ...(thpData && { transparentHugepages: thpData }),
                    ...(tcpData && { tcpAdvancedOptions: tcpData })
                },
                lastAssessedDate: new Date().getTime().toString()
            };
            await updateDatabaseHostAssessmentData(accountId, resCreds, databaseHostId, updated);
        })
    );
}

/**
 * Host-level compute assessment: THP + TCP advanced options. Runs once per host.
 * Persists to `resource.assessment_data.computeHostOs`.
 */
async function initiateComputeHostLevelAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    activeNodeInstanceId: string,
    resourceName: string
) {
    logger.info('Initiating compute host-level assessment collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId,
        resourceName
    });

    const { id: computeJobId } = await registerJob(accountId, credentialsId, region, {
        name: 'Compute host OS assessment',
        description: 'Compute host OS assessment (THP, TCP)',
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    try {
        const hostOsResponse = await callSsmExecution({
            credentialsId,
            region,
            commands: [HOST_OS_COMPUTE_ASSESSMENT(activeNodeInstanceId)],
            ec2InstanceId: activeNodeInstanceId,
            comment: 'Compute host OS assessment (THP, TCP)',
            accountId,
            executionTimeout: ASSESSMENT_SSM_EXECUTION_TIMEOUT,
            shouldReadFromCloudWatchLogs: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });

        const [hostOsResult] = parseMultipleCommandResponse(hostOsResponse);
        const hostOs = hostOsResult as Record<string, unknown> | undefined;
        const hostOsData = (hostOs?.os ?? hostOs) as Record<string, unknown> | undefined;

        await persistComputeHostOsToResource(accountId, databaseHostId, hostOsData);
    } catch (error) {
        logger.error('Error during compute host-level assessment collection', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            error
        });
        errorMessage = toErrorMessage(error);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, computeJobId, {
            endTime: Date.now(),
            status: jobStatus,
            ...(errorMessage && { error: errorMessage })
        });
    }
}

/**
 * Instance-level compute assessment: filesystemio_options + db_file_multiblock_read_count.
 * Persists to `database_instance_config_data` with config_data_type = COMPUTE.
 */
async function initiateComputeInstanceLevelAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    parentJobId: string,
    instanceRecord: WorkloadInstance
) {
    const { resourceName, id: databaseInstanceId, name: databaseInstanceName, activeNodeInstanceid } = instanceRecord;
    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;

    logger.info('Initiating compute instance-level assessment collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        parentJobId,
        databaseInstanceName
    });

    const { id: computeJobId } = await registerJob(accountId, credentialsId, region, {
        name: 'Compute Oracle params assessment',
        description: 'Compute Oracle params assessment (filesystemio, multiblock)',
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    try {
        const oracleParamsResponse = await callSsmExecution({
            credentialsId,
            region,
            commands: [ORACLE_PARAMS_COMPUTE_ASSESSMENT(activeNodeInstanceid, databaseInstanceName)],
            ec2InstanceId: activeNodeInstanceid,
            comment: 'Compute Oracle params assessment (filesystemio, multiblock)',
            accountId,
            executionTimeout: ASSESSMENT_SSM_EXECUTION_TIMEOUT,
            shouldReadFromCloudWatchLogs: true,
            documentName: SSM_RUN_SHELL_SCRIPT_DOC,
            documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        });

        const [oracleParamsResult] = parseMultipleCommandResponse(oracleParamsResponse);
        const oracleParamsPayload = oracleParamsResult as StorageIscsiAssessment | undefined;

        if (oracleParamsPayload && !isEmpty(oracleParamsPayload)) {
            await createDatabaseInstanceConfigData([
                {
                    account_id: accountId,
                    credentials_id: credentialsId,
                    region,
                    resource_id: databaseHostId,
                    database_instance_id: databaseInstanceId,
                    creation_time: new Date(Date.now()),
                    config_data_type: AssessmentCategoriesOracle.COMPUTE,
                    config_data: oracleParamsPayload
                }
            ]);
        }
    } catch (error) {
        logger.error('Error during compute instance-level assessment collection', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceName,
            error
        });
        errorMessage = toErrorMessage(error);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, computeJobId, {
            endTime: Date.now(),
            status: jobStatus,
            ...(errorMessage && { error: errorMessage })
        });
    }
}

export {
    calculateComputeHostOsDrift,
    initiateComputeHostLevelAssessmentCollection,
    initiateComputeInstanceLevelAssessmentCollection
};
