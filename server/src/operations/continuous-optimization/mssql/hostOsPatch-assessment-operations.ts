import { compact, isEmpty, omit } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { listResources } from '../../../lib/database/db';

import getLogger from '../../../utils/logger';
import {
    AssessmentCategories,
    AssessmentStatus,
    TEST_CONNECTION_COMMAND
} from '../../../utils/continous-optimization-consts';
import { HostOsPatchAssessmentObject, Metadata, ResourceAssessmentData } from '../../../utils/common-types';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { getAllClusterNodeDetails } from '../../database-hosts-operations';
import { DatabaseTypes, GENERIC_ASSESSMENT_ERROR_MESSAGE, HttpErrorCodes, SUCCESS } from '../../../utils/consts';
import { getInstancesPatchStatus, runAwsPatchBaseline } from '../../aws/ospatch-ssm-operations';
import { callSsmExecution } from '../../aws/ssm-operations';
import { describeInstance } from '../../../lib/aws/ec2';
import { getResourceNameFromTags } from '../../../utils/utils';
import {
    HostOsPatchScanResponseType,
    MssqlAssessmentItemType
} from '../../../routes/types/mssql-continuous-optimisation.types';
import type { AssessmentErrorItemType, ErrorResponseType } from '../../../routes/types/continuous-optimization.types';
import { checkIfPatchBaselineInProgress, updatePatchBaselineStatusForHost } from '../assessment-utils';
import { MSSQL_GOLDEN_CONFIG } from './golden-config';

const logger = getLogger();
const PATCH_ASSESSMENT_IN_PROGRESS = 'Another patch assessment is already in progress';

async function discoverMssqlPatchTargetNodes(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    nodeInstanceId: string,
    isPartOfCluster: boolean
): Promise<{ nodeInstanceIds: string[]; ec2InstanceNameMap: Map<string, string> }> {
    let nodeDetails: Array<{ ec2InstanceId: string; ec2InstanceName?: string }>;
    if (isPartOfCluster) {
        nodeDetails = await getAllClusterNodeDetails(accountId, credentialsId, region, databaseHostId, nodeInstanceId);
    } else {
        const { Reservations = [] } = await describeInstance(credentialsId, region, {
            InstanceIds: [nodeInstanceId]
        });
        const ec2Name = getResourceNameFromTags(Reservations?.[0]?.Instances?.[0]?.Tags);
        nodeDetails = [{ ec2InstanceId: nodeInstanceId, ec2InstanceName: ec2Name || 'Unknown' }];
    }

    const nodeInstanceIds = compact(nodeDetails.map(({ ec2InstanceId }) => ec2InstanceId));
    const ec2InstanceNameMap = new Map(
        nodeDetails.map(({ ec2InstanceId, ec2InstanceName }) => [ec2InstanceId, ec2InstanceName ?? 'Unknown'])
    );

    return { nodeInstanceIds, ec2InstanceNameMap };
}

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
        await callSsmExecution({
            credentialsId,
            region,
            commands: [TEST_CONNECTION_COMMAND],
            ec2InstanceId: node1InstanceId,
            comment: 'Check if Windows Update Catalog is reachable',
            accountId
        });

        if (node2InstanceId) {
            await callSsmExecution({
                credentialsId,
                region,
                commands: [TEST_CONNECTION_COMMAND],
                ec2InstanceId: node2InstanceId,
                comment: 'Check if Windows Update Catalog is reachable',
                accountId
            });
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

function calculateHostOsPatchDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    assessmentData: ResourceAssessmentData
): MssqlAssessmentItemType | AssessmentErrorItemType {
    logger.info('Calculating Host OS patch drift', { accountId, credentialsId, region, databaseHostId });
    const [goldenConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'host-os-patch');

    try {
        const { hostOsPatch, errors } = assessmentData;
        if (isEmpty(hostOsPatch)) {
            const errorMessage = errors?.hostOsPatch
                ? errors?.hostOsPatch
                : GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.HOST_OS_PATCH);
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

        return {
            ...goldenConfig,
            status: findingValue,
            recommended: AssessmentStatus.OPTIMIZED,
            objectsInViolation: ec2InstancesToPatch?.map(({ ec2InstanceId }) => ec2InstanceId) ?? [],
            totalObjectsAssessed: hostOsPatchAssessment?.length ?? 0,
            totalObjectsInViolation: ec2InstancesToPatch?.length ?? 0,
            ec2InstancesToPatch
        };
    } catch (error) {
        const errorMessage = `Error while calculating host os patch drift. ${error}`;
        logger.error({ errorMessage });
        return { ...goldenConfig, errorMessage };
    }
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
    }
    if (!isEmpty(hostOsPatchAssessment)) {
        updatePatchBaselineStatusForHost(accountId, databaseHostId, hostOsPatchAssessment);
    }
    return { hostOsPatchAssessment, errorMessage };
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

    try {
        const { nodeInstanceIds: clusterNodeInstanceIds, ec2InstanceNameMap } = await discoverMssqlPatchTargetNodes(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            nodeInstanceId,
            isPartOfCluster
        );

        if (isEmpty(clusterNodeInstanceIds)) {
            throw createError('No instances found to run the host OS patch baseline');
        }

        const [{ metadata = {} } = {}] =
            (await listResources({
                accountId,
                resourceId: databaseHostId,
                credentialIds: credentialsId,
                region
            })) || [];
        const metadataObject = metadata as unknown as Metadata;
        await checkIfWindowsUpdateCatalogReachable(accountId, credentialsId, region, databaseHostId, metadataObject);

        const isPatchBaselineInProgress = await checkIfPatchBaselineInProgress(
            credentialsId,
            region,
            clusterNodeInstanceIds
        );
        if (isPatchBaselineInProgress) {
            throw createError(`${PATCH_ASSESSMENT_IN_PROGRESS} on ${clusterNodeInstanceIds.join(',')} in ${region}`);
        }

        const patchBaselinResponse = await runAwsPatchBaseline(credentialsId, region, clusterNodeInstanceIds);

        patchBaselinResponse?.some(({ response: { Status: runPatchBaselineStatus } = {}, error }) => {
            if (runPatchBaselineStatus?.toLowerCase() !== SUCCESS || error !== undefined) {
                throw createError('Failed to run operating system patch baseline on the database host in the cluster.');
            }
            return false;
        });

        const assessments = await getInstancesPatchStatus(
            credentialsId,
            region,
            clusterNodeInstanceIds,
            DatabaseTypes.MS_SQL_SERVER,
            ec2InstanceNameMap
        );

        return assessments.map(assessment => omit(assessment, 'missingPatchDetails'));
    } catch (error) {
        logger.error('Error while running OS patch assessment', { error });
        throw error instanceof Error ? error : new Error(`${error}`);
    }
}

async function fetchMssqlHostOsPatchWithMissingPatches(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    node1InstanceId: string,
    isPartOfCluster: boolean
): Promise<HostOsPatchScanResponseType | ErrorResponseType> {
    logger.info('Getting full host OS patch assessment for MSSQL', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        node1InstanceId,
        isPartOfCluster
    });

    try {
        const { nodeInstanceIds, ec2InstanceNameMap } = await discoverMssqlPatchTargetNodes(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            node1InstanceId,
            isPartOfCluster
        );

        if (isEmpty(nodeInstanceIds)) {
            throw new Error('No instances found for the MSSQL database host');
        }

        const assessments = await getInstancesPatchStatus(
            credentialsId,
            region,
            nodeInstanceIds,
            DatabaseTypes.MS_SQL_SERVER,
            ec2InstanceNameMap
        );

        if (isEmpty(assessments)) {
            throw new Error('Unable to retrieve patch status for the MSSQL database host');
        }

        updatePatchBaselineStatusForHost(
            accountId,
            databaseHostId,
            assessments.map(assessment => omit(assessment, 'missingPatchDetails'))
        );

        const isNotOptimized = assessments.some(
            ({ criticalNonCompliantCount, securityNonCompliantCount }) =>
                criticalNonCompliantCount > 0 || securityNonCompliantCount > 0
        );

        return {
            status: isNotOptimized ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
            ec2InstancesToPatch: assessments.map(({ ec2InstanceId, missingPatchDetails }) => ({
                ec2InstanceId,
                missingPatchDetails: (missingPatchDetails ?? []).map(
                    ({ classification = '', kbId = '', state = '', title = '', severity = '' }) => ({
                        classification,
                        kbId,
                        state,
                        title,
                        severity
                    })
                )
            }))
        };
    } catch (error) {
        logger.error('Error while getting full host OS patch assessment for MSSQL', {
            accountId,
            databaseHostId,
            node1InstanceId,
            isPartOfCluster,
            error
        });
        return {
            errorMessage: `Unable to retrieve patch status for the MSSQL database host: ${
                error instanceof Error ? error.message : String(error)
            }`
        };
    }
}

export { calculateHostOsPatchDrift, fetchMssqlHostOsPatchWithMissingPatches, managedHostOsPatchAssessment };
