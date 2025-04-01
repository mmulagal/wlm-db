import { compact, isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { CommandFilterKey } from '@aws-sdk/client-ssm';
import { listResources, updateResourceMetaData } from '../../lib/database/db';

import getLogger from '../../utils/logger';
import {
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    SEVERITY,
    TEST_CONNECTION_COMMAND,
    ASSESSMENT_RESOURCE_TYPE
} from '../../utils/continous-optimization-consts';
import { HostOsPatchAssessmentObject, Metadata } from '../../utils/common-types';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { getAllClusterNodeDetails } from '../database-hosts-operations';
import { HttpErrorCodes, SUCCESS } from '../../utils/consts';
import { getInstancesPatchStatus, runAwsPatchBaseline } from '../aws/ospatch-ssm-operations';
import { listSsmCommands } from '../../lib/aws/ssm';
import { callSsmExecution } from '../aws/ssm-operations';
import { updateAsssementErrorInResourceMetadata } from '../../utils/cont-opt-utils';

const logger = getLogger();
const PATCH_ASSESSMENT_IN_PROGRESS = 'Another patch assessment is already in progress';

async function checkIfWindowsUpdateCatalogReachable(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    metadata: Metadata
) {
    logger.info('Checking if Windows Update Catalog is reachable', {
        accountId,
        credentialsId,
        region,
        databaseHostId
    });
    try {
        const { node1InstanceId, node2InstanceId } = metadata;
        await callSsmExecution(
            credentialsId,
            region,
            [TEST_CONNECTION_COMMAND],
            node1InstanceId,
            'Check if Windows Update Catalog is reachable'
        );

        if (node2InstanceId) {
            await callSsmExecution(
                credentialsId,
                region,
                [TEST_CONNECTION_COMMAND],
                node2InstanceId,
                'Check if Windows Update Catalog is reachable'
            );
        }
    } catch (error) {
        const errorMessage = `Error while checking if Windows Update Catalog is reachable. ${error}`;
        logger.error(errorMessage);
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Windows Update Catalog is not reachable from SQL node/s'
        );
    }
}

async function triggerHostOsPatchCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    metadata: Metadata
) {
    try {
        const { node1InstanceId, node2InstanceId } = metadata;
        const hostOsPatchAssessment = await runOsPatchAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            node1InstanceId,
            !!node2InstanceId // assumption: if both node1 and node2 instance ids are present, then it is a cluster
        );
        const existingAssessmentData = metadata.assessment;
        metadata.assessment = {
            ...existingAssessmentData,
            hostOsPatch: hostOsPatchAssessment,
            lastAssessedDate: new Date().getTime().toString()
        };
        updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
    } catch (error) {
        logger.error(`Error while triggering host os patch collection. ${error}`);
    }
}

async function calculateHostOsPatchDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string
) {
    logger.info('Calculating Host OS patch drift', { accountId, credentialsId, region, databaseHostId });
    let errorMessage = '';
    let metadata;
    try {
        [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
    } catch (error) {
        errorMessage = `Error while calculating host os patch drift. ${error}`;
        logger.error({ errorMessage });
        return { errorMessage };
    }
    const metadataObject = metadata as unknown as Metadata;
    try {
        let hostOsPatchAssessment;

        const { assessment: { hostOsPatch } = {} } = metadataObject;
        if (!isEmpty(hostOsPatch)) {
            hostOsPatchAssessment = hostOsPatch as HostOsPatchAssessmentObject[];
        } else {
            await checkIfWindowsUpdateCatalogReachable(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                metadataObject
            ); // Check if Windows Update Catalog is reachable
            triggerHostOsPatchCollection(accountId, credentialsId, region, databaseHostId, metadataObject); // Trigger the collection of host os patch data in the background
            errorMessage = `No ${AssessmentCategories.HOST_OS_PATCH} assessment data found. Assessment is scheduled to run every 24hours and may not have run on the instance. Please try again later.`;
            logger.error(errorMessage);
            throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
        }

        const ec2InstancesToPatch = hostOsPatchAssessment?.filter(
            ({ criticalNonCompliantCount, securityNonCompliantCount }) =>
                criticalNonCompliantCount > 0 || securityNonCompliantCount > 0
        );
        const findingValue =
            ec2InstancesToPatch && ec2InstancesToPatch.length > 0
                ? AssessmentStatus.NOT_OPTIMIZED
                : AssessmentStatus.OPTIMIZED;
        const recommendationMessage =
            findingValue === AssessmentStatus.NOT_OPTIMIZED
                ? 'Critical security patches are missing. We recommend applying the latest patches to ensure your database infrastructure is secure and up-to-date.'
                : 'Your database infrastructure OS is up-to-date.';

        return {
            name: 'host-os-patch',
            status: findingValue,
            recommended: AssessmentStatus.OPTIMIZED,
            severity: SEVERITY.CRITICAL,
            recommendation: recommendationMessage,
            objectsInViolation: ec2InstancesToPatch?.map(({ ec2InstanceId }) => ec2InstanceId),
            tags: [AwsWellArchitecturedPillars.SECURITY, AwsWellArchitecturedPillars.RELIABILITY],
            ec2InstancesToPatch,
            resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE
        };
    } catch (error) {
        errorMessage = `Error while calculating host os patch drift. ${error}`;
        logger.error({ errorMessage });
        const existingAssessmentData = (metadata as unknown as Metadata).assessment;
        const assessmentErrors = { ...existingAssessmentData?.errors, hostOsPatch: errorMessage };
        (metadata as unknown as Metadata).assessment = {
            ...existingAssessmentData,
            errors: assessmentErrors,
            lastAssessedDate: new Date().getTime().toString()
        };
        updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
    }
    return { errorMessage };
}

async function managedHostOsPatchAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    activeNodeInstanceId: string,
    isPartOfCluster: boolean = false,
    resourceName: string,
    parentJobId: string
) {
    logger.info('Managing host OS patch assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        activeNodeInstanceId,
        isPartOfCluster,
        resourceName,
        parentJobId
    });

    const { id: hostOsAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Windows host OS patch assessment for ${resourceName}`,
        description: `Windows host OS patch assessment for ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });
    let hostOsPatchAssessment;
    let jobStatus;
    let errorMessage = '';
    try {
        hostOsPatchAssessment = await runOsPatchAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            activeNodeInstanceId,
            isPartOfCluster
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
        if (errorMessage) {
            await updateAsssementErrorInResourceMetadata(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                errorMessage,
                'hostOsPatch'
            );
        }
    }
    return hostOsPatchAssessment;
}

async function checkIfPatchBaselineInProgress(credentialsId: string, region: string, instanceIds: string[]) {
    logger.info('Checking if patch baseline is in progress', { credentialsId, region, instanceIds });

    for (const instanceId of instanceIds) {
        const listPatchBaselineCommandParams = {
            InstanceId: instanceId,
            MaxResults: 50,
            Filters: [
                {
                    key: CommandFilterKey.DOCUMENT_NAME,
                    value: 'AWS-RunPatchBaseline'
                },
                {
                    key: CommandFilterKey.STATUS,
                    value: 'InProgress'
                }
            ]
        };

        const { Commands = [] } = await listSsmCommands(credentialsId, region, listPatchBaselineCommandParams);
        if (Commands.length > 0) {
            logger.warn('Patch baseline is already running on the instance', { instanceId, region, credentialsId });
            return true;
        }
    }
    return false;
}

async function runOsPatchAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    nodeInstanceId: string,
    isPartOfCluster: boolean = false
) {
    logger.info('Running OS patch assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        nodeInstanceId,
        isPartOfCluster
    });

    const clusterNodeDetails = isPartOfCluster
        ? await getAllClusterNodeDetails(accountId, credentialsId, region, databaseHostId, nodeInstanceId)
        : [{ ec2InstanceId: nodeInstanceId }];
    const clusterNodeInstanceIds = compact(clusterNodeDetails.map(({ ec2InstanceId }) => ec2InstanceId));
    if (!isEmpty(clusterNodeInstanceIds)) {
        const isPatchBaselineInProgress = await checkIfPatchBaselineInProgress(
            credentialsId,
            region,
            clusterNodeInstanceIds
        );
        if (!isPatchBaselineInProgress) {
            const patchBaselinResponse = await runAwsPatchBaseline(credentialsId, region, clusterNodeInstanceIds);

            patchBaselinResponse?.some(({ response: { Status: runPatchBaselineStatus } = {}, error }) => {
                if (runPatchBaselineStatus?.toLowerCase() !== SUCCESS || error !== undefined) {
                    throw createError(
                        'Failed to run host OS patch baseline on the host/s database hosts in the cluster'
                    );
                }
                return false;
            }); // If any of the instances failed to run the patch baseline, throw an error

            const response = await getInstancesPatchStatus(credentialsId, region, clusterNodeInstanceIds);

            const hostOsPatchAssessment = response?.map(
                ({
                    BaselineId: baselineId,
                    CriticalNonCompliantCount: criticalNonCompliantCount,
                    OtherNonCompliantCount: otherNonCompliantCount,
                    InstanceId: ec2InstanceId,
                    OperationStartTime: operationStartTime,
                    OperationEndTime: operationEndTime,
                    SecurityNonCompliantCount: securityNonCompliantCount,
                    missingPatchDetails
                }) => ({
                    baselineId: baselineId ?? '',
                    criticalNonCompliantCount: criticalNonCompliantCount ?? 0,
                    otherNonCompliantCount: otherNonCompliantCount ?? 0,
                    ec2InstanceId: ec2InstanceId ?? '',
                    operationStartTime: operationStartTime ? new Date(operationStartTime).getMilliseconds() : 0,
                    operationEndTime: operationEndTime ? new Date(operationEndTime).getMilliseconds() : 0,
                    securityNonCompliantCount: securityNonCompliantCount ?? 0,
                    missingPatchDetails
                })
            );

            return hostOsPatchAssessment;
        }
        throw createError(`${PATCH_ASSESSMENT_IN_PROGRESS} on ${clusterNodeInstanceIds?.join(',')} in ${region}`);
    }
    throw createError('No instances found to run the host OS patch baseline');
}

async function updatePatchBaselineStatusForHost(
    accountId: string,
    databaseHostId: string,
    hostOsPatchAssessment?: HostOsPatchAssessmentObject[]
) {
    const resources = (await listResources(accountId, databaseHostId)) || [];

    if (!isEmpty(resources) && !isEmpty(hostOsPatchAssessment)) {
        resources.forEach(async ({ metadata }) => {
            const metaObj = metadata as unknown as Metadata;
            const existingAssessmentData = metaObj.assessment;
            metaObj.assessment = {
                ...existingAssessmentData,
                hostOsPatch: hostOsPatchAssessment,
                lastAssessedDate: new Date().getTime().toString()
            };
            updateResourceMetaData(accountId, undefined, databaseHostId, metaObj);
        });
    }
}

export { calculateHostOsPatchDrift, managedHostOsPatchAssessment, updatePatchBaselineStatusForHost };
