import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';

import { ASSESSMENT_SSM_EXECUTION_TIMEOUT } from '../../../utils/consts';
import {
    AssessmentCategoriesOracle,
    ORACLE_COMPUTE_HOST_OS_ASSESSMENT_CONFIGS
} from '../../../utils/continous-optimization-consts';
import { parseMultipleCommandResponse } from '../../../utils/utils';
import { ComputeHostOsAssessment, WorkloadInstance } from '../../../utils/common-types';
import getLogger from '../../../utils/logger';

import {
    AssessmentErrorItemType,
    AssessmentItemType,
    GenericViolationResponseType
} from '../../../routes/types/continuous-optimization.types';

import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';

import { callSsmExecution } from '../../aws/ssm-operations';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';

import { ISCIOSAssessment, StorageIscsiAssessment } from './common-types';
import ORACLE_GOLDEN_CONFIG from './golden-config';
import {
    HOST_OS_COMPUTE_ASSESSMENT,
    ORACLE_PARAMS_COMPUTE_ASSESSMENT
} from './ssm-scripts/compute-host-os-assessment-scripts';
import { createAssessment, createViolationDetail, GoldenConfigEntry } from './storage-assessment-operations';

const logger = getLogger();

const osIsciConfigData = ORACLE_GOLDEN_CONFIG.filter(e => e.applicableTo === 'iscsi');
const COMPUTE_HOST_OS_CONFIG_NAMES = new Set<string>(ORACLE_COMPUTE_HOST_OS_ASSESSMENT_CONFIGS);

const MISSING_DATA_ERROR_MESSAGE =
    'No compute assessment data found. Assessment is scheduled to run every 24 hours and may not have run on the instance. Please try again later.';

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Evaluate drift for the supplied compute configs and return a flat array.
 * When the source data is missing each requested config gets an error item so the
 * API response always surfaces all 4 assessment fields.
 */
function calculateComputeOsDrift(
    ec2InstanceId: string,
    databaseInstanceName: string,
    os: ISCIOSAssessment | undefined,
    configNames: Set<string>
): (AssessmentItemType | AssessmentErrorItemType)[] {
    logger.info('Fetching compute OS configuration drift', { ec2InstanceId, databaseInstanceName });
    const items: (AssessmentItemType | AssessmentErrorItemType)[] = [];
    const configsToEvaluate = osIsciConfigData.filter(
        c => COMPUTE_HOST_OS_CONFIG_NAMES.has(c.id) && configNames.has(c.id)
    );

    if (!os || isEmpty(os)) {
        configsToEvaluate.forEach(config => {
            items.push({ ...config, errorMessage: MISSING_DATA_ERROR_MESSAGE });
        });
        return items;
    }

    configsToEvaluate.forEach(config => {
        let violationDetails: GenericViolationResponseType[] = [];

        switch (config.parameter) {
            case 'transparent-hugepages': {
                const thpData = os['transparent-hugepages'];
                if (thpData?.['thp-disabled'] === false) {
                    violationDetails.push(
                        createViolationDetail(
                            'transparent-hugepages',
                            'configuration',
                            `${thpData['thp-value'] || 'enabled'}`,
                            'always madvise [never]'
                        )
                    );
                }
                items.push(createAssessment(config as GoldenConfigEntry, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'tcp-advanced-options': {
                const tcpFeatures = os['tcp-advanced-options']?.['tcp-features'] ?? {};
                const requiredFeatures = ['tcp-sack-enabled', 'tcp-window-scaling-enabled', 'tcp-timestamps-enabled'];
                violationDetails = requiredFeatures
                    .filter(feature => !tcpFeatures[feature as keyof typeof tcpFeatures])
                    .map(feature => createViolationDetail(feature.replace('-enabled', ''), 'configuration', '0', '1'));
                items.push(createAssessment(config as GoldenConfigEntry, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'filesystems-io-options': {
                const oracleParamsData = os['oracle-parameters']?.['filesystemio-options'];
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
                items.push(createAssessment(config as GoldenConfigEntry, 1, [ec2InstanceId], violationDetails));
                break;
            }

            case 'multiblock-readcount': {
                const initOracleParams = os['oracle-parameters-from-init'];
                if (initOracleParams?.error) {
                    items.push({ ...config, errorMessage: initOracleParams.error });
                    break;
                }
                const oracleParamsData = initOracleParams?.['db-file-multiblock-read-count-in-init'] ?? [];
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
                items.push(createAssessment(config as GoldenConfigEntry, 1, [ec2InstanceId], violationDetails));
                break;
            }

            default:
                break;
        }
    });

    return items;
}

const HOST_LEVEL_COMPUTE_CONFIG_NAMES = new Set(['transparent-hugepages', 'tcp-advanced-options']);
const ORACLE_PARAMS_COMPUTE_CONFIG_NAMES = new Set(['filesystems-io-options', 'multiblock-readcount']);

/**
 * Drift for the four compute host/OS checks.
 * THP/TCP drift from `resource.assessment_data.computeHostOs` (host level).
 * Oracle params (filesystemio, multiblock) from `database_instance_config_data` compute row (instance level).
 */
function calculateComputeHostOsDrift(
    ec2InstanceId: string,
    databaseInstanceName: string,
    computeHostOs: ComputeHostOsAssessment | undefined,
    oracleParamsConfigData: unknown
): (AssessmentItemType | AssessmentErrorItemType)[] {
    const hostOs: ISCIOSAssessment | undefined = computeHostOs
        ? {
              'transparent-hugepages': computeHostOs.transparentHugepages,
              'tcp-advanced-options': computeHostOs.tcpAdvancedOptions
          }
        : undefined;

    return [
        ...calculateComputeOsDrift(ec2InstanceId, databaseInstanceName, hostOs, HOST_LEVEL_COMPUTE_CONFIG_NAMES),
        ...calculateComputeOsDrift(
            ec2InstanceId,
            databaseInstanceName,
            (oracleParamsConfigData as unknown as { os?: ISCIOSAssessment })?.os,
            ORACLE_PARAMS_COMPUTE_CONFIG_NAMES
        )
    ];
}

/**
 * Host-level compute assessment: THP + TCP advanced options. Runs once per host.
 * Returns the raw host OS data; persistence onto resource.assessment_data.computeHostOs
 * is handled by the caller so it can be merged with other host-level updates in a
 * single write.
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
        name: `Compute host OS assessment for ${resourceName}`,
        description: `Compute host OS assessment (THP, TCP) for Oracle database host ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    let hostOsData;

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
        hostOsData = (hostOs?.os ?? hostOs) as Record<string, unknown> | undefined;
        // Note: persistence of hostOsData onto resource.assessment_data.computeHostOs
        // is handled by the caller (initiateHostLevelAssessmentDataCollection) so
        // it can be merged into the same update as hostOsPatch and avoid races.
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
    return { hostOsData };
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
