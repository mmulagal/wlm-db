import { isEmpty, omit } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../../utils/logger';
import { AssessmentCategoriesOracle, AssessmentStatus } from '../../../utils/continous-optimization-consts';
import { HostOsPatchAssessmentObject, ResourceAssessmentData } from '../../../utils/common-types';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { DatabaseTypes, GENERIC_ASSESSMENT_ERROR_MESSAGE, SUCCESS } from '../../../utils/consts';
import { getInstancesPatchStatus, runAwsPatchBaseline } from '../../aws/ospatch-ssm-operations';
import { callSsmExecution } from '../../aws/ssm-operations';
import { describeInstance } from '../../../lib/aws/ec2';
import { getResourceNameFromTags, sqlResponseParsing } from '../../../utils/utils';
import {
    HostOsPatchScanResponseType,
    OracleAssessmentItemType
} from '../../../routes/types/oracle-continuous-optimization.types';
import type { AssessmentErrorItemType, ErrorResponseType } from '../../../routes/types/continuous-optimization.types';
import { checkLinuxRepoConnectivityScript } from './ssm-scripts/host-assessment-scripts';
import ORACLE_GOLDEN_CONFIG from './golden-config';
import { checkIfPatchBaselineInProgress, updatePatchBaselineStatusForHost } from '../assessment-utils';

const logger = getLogger();
const PATCH_ASSESSMENT_IN_PROGRESS = 'Another patch assessment is already in progress';

async function buildEc2InstanceNameMap(
    credentialsId: string,
    region: string,
    ec2InstanceIds: string[]
): Promise<Map<string, string>> {
    const { Reservations = [] } = await describeInstance(credentialsId, region, {
        InstanceIds: ec2InstanceIds
    });
    const describedInstances = Reservations.flatMap(({ Instances = [] }) => Instances);

    return new Map(
        ec2InstanceIds.map(id => {
            const tags = describedInstances.find(({ InstanceId }) => InstanceId === id)?.Tags;
            return [id, getResourceNameFromTags(tags) || 'Unknown'];
        })
    );
}

async function checkIfLinuxRepoReachable(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    ec2InstanceId: string
) {
    logger.info('Checking if Linux package repositories are reachable', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        ec2InstanceId
    });
    try {
        const response = await callSsmExecution({
            credentialsId,
            region,
            commands: [checkLinuxRepoConnectivityScript],
            ec2InstanceId,
            comment: 'Check if Linux package repositories are reachable',
            accountId,
            documentName: 'AWS-RunShellScript'
        });

        const { status, error } = sqlResponseParsing(response);
        if (status !== 'success') {
            throw new Error(error || 'Linux package repositories are not reachable');
        }
    } catch (error) {
        logger.error('Error while checking if Linux package repositories are reachable', { error });
        throw new Error(`Linux package repositories are not reachable from the Oracle database host: ${error}`);
    }
}

function calculateHostOsPatchDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    assessmentData: ResourceAssessmentData
): OracleAssessmentItemType | AssessmentErrorItemType {
    logger.info('Calculating Host OS patch drift for Oracle', { accountId, credentialsId, region, databaseHostId });
    const [goldenConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'host-os-patch');

    try {
        const { hostOsPatch, errors } = assessmentData;
        if (isEmpty(hostOsPatch)) {
            const errorMessage = errors?.hostOsPatch
                ? errors?.hostOsPatch
                : GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategoriesOracle.HOST_OS_PATCH);
            logger.error({ errorMessage });
            return { ...goldenConfig, errorMessage };
        }

        const hostOsPatchAssessment = hostOsPatch as HostOsPatchAssessmentObject[];

        const ec2InstancesToPatch = hostOsPatchAssessment?.filter(
            ({ criticalNonCompliantCount, securityNonCompliantCount }) =>
                criticalNonCompliantCount > 0 || securityNonCompliantCount > 0
        );
        const findingValue =
            ec2InstancesToPatch && ec2InstancesToPatch.length > 0
                ? AssessmentStatus.NOT_OPTIMIZED
                : AssessmentStatus.OPTIMIZED;

        // Map to the expected type structure
        const mappedEc2InstancesToPatch = ec2InstancesToPatch?.map(
            ({
                baselineId,
                criticalNonCompliantCount,
                otherNonCompliantCount,
                ec2InstanceId,
                ec2InstanceName,
                operationStartTime,
                operationEndTime,
                securityNonCompliantCount
            }) => ({
                baselineId,
                criticalNonCompliantCount,
                otherNonCompliantCount,
                ec2InstanceId,
                ec2InstanceName: ec2InstanceName ?? '',
                operationStartTime,
                operationEndTime,
                securityNonCompliantCount
            })
        );

        return {
            ...goldenConfig,
            status: findingValue,
            recommended: AssessmentStatus.OPTIMIZED,
            objectsInViolation: ec2InstancesToPatch?.map(({ ec2InstanceId }) => ec2InstanceId),
            ec2InstancesToPatch: mappedEc2InstancesToPatch
        };
    } catch (error) {
        const errorMessage = `Error while calculating host os patch drift for Oracle. ${error}`;
        logger.error({ errorMessage });
        return { ...goldenConfig, errorMessage };
    }
}

async function runLinuxOsPatchAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    ec2InstanceId: string
) {
    logger.info('Running Linux OS patch assessment for Oracle', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        ec2InstanceId
    });

    try {
        const instanceIds = [ec2InstanceId];
        const ec2InstanceNameMap = await buildEc2InstanceNameMap(credentialsId, region, instanceIds);

        await checkIfLinuxRepoReachable(accountId, credentialsId, region, databaseHostId, ec2InstanceId);

        const isPatchBaselineInProgress = await checkIfPatchBaselineInProgress(credentialsId, region, instanceIds);
        if (isPatchBaselineInProgress) {
            throw new Error(`${PATCH_ASSESSMENT_IN_PROGRESS} on ${instanceIds?.join(',')} in ${region}`);
        }

        // Run AWS Patch Baseline scan (not install)
        const patchBaselineResponse = await runAwsPatchBaseline(credentialsId, region, instanceIds);

        patchBaselineResponse?.some(({ response: { Status: runPatchBaselineStatus } = {}, error }) => {
            if (runPatchBaselineStatus?.toLowerCase() !== SUCCESS || error !== undefined) {
                throw new Error('Failed to run operating system patch baseline on the Oracle database host.');
            }
            return false;
        });

        const assessments = await getInstancesPatchStatus(
            credentialsId,
            region,
            instanceIds,
            DatabaseTypes.ORACLE,
            ec2InstanceNameMap
        );

        if (isEmpty(assessments)) {
            throw new Error(
                `Host OS patch assessment failed for instance ${ec2InstanceId}: ` +
                    'Unable to retrieve patch status after the baseline scan completed.'
            );
        }

        return assessments.map(assessment => omit(assessment, 'missingPatchDetails'));
    } catch (error) {
        logger.error('Error while running Linux OS patch assessment', { error });
        throw error instanceof Error ? error : new Error(`${error}`);
    }
}

async function managedHostOsPatchAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    activeNodeInstanceId: string,
    resourceName: string,
    parentJobId: string
): Promise<{ hostOsPatchAssessment: HostOsPatchAssessmentObject[] | undefined; errorMessage: string }> {
    logger.info('Managing host OS patch assessment for Oracle', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        activeNodeInstanceId,
        resourceName,
        parentJobId
    });

    const { id: hostOsAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Linux host OS patch assessment for ${resourceName}`,
        description: `Linux host OS patch assessment for Oracle database host ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let hostOsPatchAssessment: HostOsPatchAssessmentObject[] | undefined;
    let jobStatus: JOBSTATUS | undefined;
    let errorMessage = '';

    try {
        hostOsPatchAssessment = await runLinuxOsPatchAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            activeNodeInstanceId
        );
    } catch (error) {
        errorMessage = `Error while performing host OS patch assessment. ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        if ((error as Error).message.includes(PATCH_ASSESSMENT_IN_PROGRESS)) {
            jobStatus = JOBSTATUS.WARNING;
        }
    } finally {
        await updateJobDetails(accountId, hostOsAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus || JOBSTATUS.COMPLETED,
            error: errorMessage
        });
    }
    return { hostOsPatchAssessment, errorMessage };
}

async function fetchOracleHostOsPatchWithMissingPatches(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    ec2InstanceId: string
): Promise<HostOsPatchScanResponseType | ErrorResponseType> {
    logger.info('Getting full host OS patch assessment for Oracle', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        ec2InstanceId
    });

    try {
        const ec2InstanceNameMap = await buildEc2InstanceNameMap(credentialsId, region, [ec2InstanceId]);

        const assessments = await getInstancesPatchStatus(
            credentialsId,
            region,
            [ec2InstanceId],
            DatabaseTypes.ORACLE,
            ec2InstanceNameMap
        );

        if (isEmpty(assessments)) {
            throw new Error('Unable to retrieve patch status for the Oracle database host');
        }

        try {
            await updatePatchBaselineStatusForHost(
                accountId,
                databaseHostId,
                assessments.map(assessment => omit(assessment, 'missingPatchDetails'))
            );
        } catch (error) {
            logger.error('Failed to persist host OS patch baseline status after Oracle patch scan', {
                accountId,
                databaseHostId,
                error
            });
        }

        const isNotOptimized = assessments.some(
            ({ criticalNonCompliantCount, securityNonCompliantCount }) =>
                criticalNonCompliantCount > 0 || securityNonCompliantCount > 0
        );

        return {
            status: isNotOptimized ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
            ec2InstancesToPatch: assessments.map(assessment => ({
                ec2InstanceId: assessment.ec2InstanceId,
                missingPatchDetails: (assessment.missingPatchDetails ?? []).map(
                    ({ classification = '', state = '', title = '', kbId = '', cveIds = '', severity = '' }) => ({
                        classification,
                        cveIds: kbId || cveIds,
                        state,
                        title,
                        severity
                    })
                )
            }))
        };
    } catch (error) {
        logger.error('Error while running patch scan for Oracle database host', {
            accountId,
            databaseHostId,
            ec2InstanceId,
            error
        });
        return {
            errorMessage: `Unable to retrieve patch status for the Oracle database host: ${
                error instanceof Error ? error.message : String(error)
            }`
        };
    }
}

export { calculateHostOsPatchDrift, fetchOracleHostOsPatchWithMissingPatches, managedHostOsPatchAssessment };
