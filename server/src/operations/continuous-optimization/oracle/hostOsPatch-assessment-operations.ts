import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';

import getLogger from '../../../utils/logger';
import { AssessmentCategoriesOracle, AssessmentStatus } from '../../../utils/continous-optimization-consts';
import { HostOsPatchAssessmentObject, ResourceAssessmentData } from '../../../utils/common-types';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE, HttpErrorCodes, SUCCESS } from '../../../utils/consts';
import { getInstancesPatchStatus, runAwsPatchBaseline } from '../../aws/ospatch-ssm-operations';
import { callSsmExecution } from '../../aws/ssm-operations';
import { describeInstance } from '../../../lib/aws/ec2';
import { getResourceNameFromTags, sleep, sqlResponseParsing } from '../../../utils/utils';
import { HostOsPatchDriftResponseType } from '../../../routes/types/oracle-continuous-optimization.types';
import { checkLinuxRepoConnectivityScript } from './ssm-scripts/host-assessment-scripts';
import GOLDEN_CONFIG from './golden-config';
import { checkIfPatchBaselineInProgress, updatePatchBaselineStatusForHost } from '../assessment-utils';

const logger = getLogger();
const PATCH_ASSESSMENT_IN_PROGRESS = 'Another patch assessment is already in progress';

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
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Linux package repositories are not reachable from the Oracle database host'
        );
    }
}

function calculateHostOsPatchDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    assessmentData: ResourceAssessmentData
): HostOsPatchDriftResponseType | { errorMessage: string } {
    logger.info('Calculating Host OS patch drift for Oracle', { accountId, credentialsId, region, databaseHostId });

    let errorMessage = '';

    try {
        const { hostOsPatch, errors } = assessmentData;
        if (isEmpty(hostOsPatch)) {
            errorMessage = errors?.hostOsPatch
                ? errors?.hostOsPatch
                : GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategoriesOracle.HOST_OS_PATCH);
            logger.error({ errorMessage });
            return { errorMessage };
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
                securityNonCompliantCount,
                missingPatchDetails
            }) => ({
                baselineId,
                criticalNonCompliantCount,
                otherNonCompliantCount,
                ec2InstanceId,
                ec2InstanceName: ec2InstanceName ?? '',
                operationStartTime,
                operationEndTime,
                securityNonCompliantCount,
                missingPatchDetails: missingPatchDetails?.map(({ classification, cveIds, severity, state, title }) => ({
                    classification: classification ?? '',
                    cveIds: cveIds ?? '',
                    severity: severity ?? '',
                    state: state ?? '',
                    title: title ?? ''
                }))
            })
        );

        return {
            ...GOLDEN_CONFIG.hostOsPatch,
            status: findingValue,
            recommended: AssessmentStatus.OPTIMIZED,
            objectsInViolation: ec2InstancesToPatch?.map(({ ec2InstanceId }) => ec2InstanceId),
            ec2InstancesToPatch: mappedEc2InstancesToPatch
        };
    } catch (error) {
        errorMessage = `Error while calculating host os patch drift for Oracle. ${error}`;
        logger.error({ errorMessage });
    }
    return { errorMessage };
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
        const { Reservations = [] } = await describeInstance(credentialsId, region, {
            InstanceIds: [ec2InstanceId]
        });
        const ec2Name = getResourceNameFromTags(Reservations?.[0]?.Instances?.[0]?.Tags);
        const instanceDetails = [{ ec2InstanceId, ec2InstanceName: ec2Name || 'Unknown' }];

        const instanceIds = [ec2InstanceId];

        const ec2InstanceNameMap = new Map(
            instanceDetails.map(({ ec2InstanceId: id, ec2InstanceName }) => [id, ec2InstanceName])
        );

        await checkIfLinuxRepoReachable(accountId, credentialsId, region, databaseHostId, ec2InstanceId);

        const isPatchBaselineInProgress = await checkIfPatchBaselineInProgress(credentialsId, region, instanceIds);
        if (isPatchBaselineInProgress) {
            throw createError(`${PATCH_ASSESSMENT_IN_PROGRESS} on ${instanceIds?.join(',')} in ${region}`);
        }

        // Run AWS Patch Baseline scan (not install)
        const patchBaselineResponse = await runAwsPatchBaseline(credentialsId, region, instanceIds);

        patchBaselineResponse?.some(({ response: { Status: runPatchBaselineStatus } = {}, error }) => {
            if (runPatchBaselineStatus?.toLowerCase() !== SUCCESS || error !== undefined) {
                throw createError('Failed to run operating system patch baseline on the Oracle database host.');
            }
            return false;
        });

        // Wait for AWS Patch Manager to prepare scan results before querying patch status
        await sleep(5000);

        // Get patch status results
        const response = await getInstancesPatchStatus(credentialsId, region, instanceIds);

        const hostOsPatchAssessment = response?.map(
            ({
                BaselineId: baselineId,
                CriticalNonCompliantCount: criticalNonCompliantCount,
                OtherNonCompliantCount: otherNonCompliantCount,
                InstanceId: instanceId,
                OperationStartTime: operationStartTime,
                OperationEndTime: operationEndTime,
                SecurityNonCompliantCount: securityNonCompliantCount,
                missingPatchDetails
            }) => ({
                baselineId: baselineId ?? '',
                criticalNonCompliantCount: criticalNonCompliantCount ?? 0,
                otherNonCompliantCount: otherNonCompliantCount ?? 0,
                ec2InstanceId: instanceId ?? '',
                ec2InstanceName: ec2InstanceNameMap.get(instanceId ?? '') || 'Unknown',
                operationStartTime: operationStartTime ? new Date(operationStartTime).getTime() : 0,
                operationEndTime: operationEndTime ? new Date(operationEndTime).getTime() : 0,
                securityNonCompliantCount: securityNonCompliantCount ?? 0,
                missingPatchDetails: missingPatchDetails?.map(patch => ({
                    classification: patch.classification,
                    cveIds: patch.cveIds ?? '',
                    severity: patch.severity,
                    state: patch.state,
                    title: patch.title
                }))
            })
        );

        return hostOsPatchAssessment;
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

    if (!isEmpty(hostOsPatchAssessment)) {
        updatePatchBaselineStatusForHost(accountId, databaseHostId, hostOsPatchAssessment);
    }

    return { hostOsPatchAssessment, errorMessage };
}

export { calculateHostOsPatchDrift, managedHostOsPatchAssessment };
