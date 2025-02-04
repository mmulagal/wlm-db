import { compact, isEmpty } from 'lodash-es';
import createError from 'http-errors';

import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../utils/logger';
import { getAllClusterNodeDetails } from '../database-hosts-operations';
import { AssessmentStatus, AwsWellArchitecturedPillars, SEVERITY } from '../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { getAvailablePatches, getInstalledSQLPatchDetails } from '../aws/mssqlPatch-ssm-operations';
import { listResources, updateResourceMetaData } from '../../lib/database/db';
import { Metadata, MSSQLPatchAssessmentObject, PatchDetail } from '../../utils/common-types';
import { extractKbNumber } from '../../utils/utils';
import { HttpErrorCodes } from '../../utils/consts';
import { getActiveSqlNode } from '../workloads/mssql/mssql-operations';

const logger = getLogger();

interface InstalledPatches {
    DisplayName: string;
    DisplayVersion: string;
    InstallDate: string;
}

async function calculateMSSQLPatchDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string
) {
    logger.info('Calculating MSSQL Patch drift', {
        accountId,
        credentialsId,
        region,
        databaseHostId
    });
    let errorMessage = '';
    try {
        let patchAssessment: MSSQLPatchAssessmentObject[] = [];

        const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
        const metadataObject = metadata as unknown as Metadata;
        const { assessment: { mssqlPatch } = {} } = metadataObject;
        logger.info('MSSQL patch assessment from metadata', mssqlPatch);

        if (!isEmpty(mssqlPatch)) {
            patchAssessment = mssqlPatch as MSSQLPatchAssessmentObject[];
        } else {
            const { node1InstanceId, node2InstanceId } = metadataObject;
            const { activeNodeInstanceId } = await getActiveSqlNode(
                credentialsId,
                region,
                node1InstanceId,
                node2InstanceId
            );

            if (!activeNodeInstanceId) {
                logger.error('Active node instance id not found');
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Active node instance id not found');
            }

            patchAssessment = await runMSSQLPatchAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                node1InstanceId,
                !!node2InstanceId, // assumption: if both node1 and node2 instance ids are present, then it is a cluster
                activeNodeInstanceId
            );
            logger.info('Patch assessment result while calculating', patchAssessment);
            const existingAssessmentData = (metadata as unknown as Metadata).assessment;
            (metadata as unknown as Metadata).assessment = {
                ...existingAssessmentData,
                mssqlPatch: patchAssessment
            };
            updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
        }

        const allMissingPatchDetails: PatchDetail[] =
            patchAssessment
                ?.flatMap(instance => instance.missingPatchDetails)
                .filter((patch): patch is PatchDetail => patch !== undefined) || [];

        // Find unique missing patches by KbNumber
        const uniqueMissingPatches: PatchDetail[] = allMissingPatchDetails.filter(
            (patch, index, self) => index === self.findIndex(p => p.kbId === patch.kbId)
        );

        // Calculate critical and important patches count based on unique missing patches
        const criticalPatchesCount: number = uniqueMissingPatches.filter(patch => patch.severity === 'Critical').length;
        const importantPatchesCount: number = uniqueMissingPatches.filter(
            patch => patch.severity === 'Important'
        ).length;

        const status: AssessmentStatus =
            uniqueMissingPatches.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;

        const recommendationMessage: string =
            status === AssessmentStatus.NOT_OPTIMIZED
                ? `Critical (${criticalPatchesCount}) and important (${importantPatchesCount}) patches are missing. We recommend applying the latest patches to ensure your MSSQL instance is secure and up-to-date.`
                : 'Your MSSQL instance is up-to-date with all critical and important patches applied.';

        const objectsInViolation: string[] =
            status === AssessmentStatus.NOT_OPTIMIZED ? patchAssessment?.map(({ ec2InstanceId }) => ec2InstanceId) : [];

        return {
            name: 'mssql-patch',
            status: status as AssessmentStatus,
            recommended: AssessmentStatus.OPTIMIZED,
            missingPatchesInEc2Instances: patchAssessment,
            severity: SEVERITY.CRITICAL,
            recommendation: recommendationMessage,
            tags: [AwsWellArchitecturedPillars.SECURITY, AwsWellArchitecturedPillars.RELIABILITY],
            objectsInViolation
        };
    } catch (error: any) {
        errorMessage = `Error while calculating MSSQL patch drift. ${error.message}`;
        logger.error({ errorMessage, error });
    }
    return { errorMessage };
}

async function managedHostMSSQLPatchAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    activeNodeInstanceId: string,
    isPartOfCluster: boolean = false,
    resourceName: string,
    parentJobId?: string
) {
    logger.info('Managed host mssql patch assessment', {
        accountId,
        credentialsId,
        region,
        activeNodeInstanceId,
        resourceName,
        databaseHostId,
        isPartOfCluster,
        parentJobId
    });

    const { id: patchAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Microsoft SQL server patch assessment for ${resourceName}`,
        description: `Microsoft SQL server patch assessment for ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let patchAssessment;
    let jobStatus;
    let errorMessage;
    try {
        patchAssessment = await runMSSQLPatchAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            activeNodeInstanceId,
            isPartOfCluster,
            activeNodeInstanceId
        );
        logger.info('managed host mssql patch response', patchAssessment);
    } catch (error) {
        errorMessage = `Error while performing mssql patch assessment. ${error}`;
        logger.error(errorMessage);

        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, patchAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus || JOBSTATUS.COMPLETED,
            error: errorMessage
        });
    }

    return patchAssessment;
}

async function runMSSQLPatchAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    nodeInstanceId: string,
    isPartOfCluster: boolean = false,
    activeNodeInstanceId: string
): Promise<MSSQLPatchAssessmentObject[]> {
    logger.info('Running MsSql Patch assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        nodeInstanceId,
        isPartOfCluster,
        activeNodeInstanceId
    });

    const clusterNodeDetails = isPartOfCluster
        ? await getAllClusterNodeDetails(accountId, credentialsId, region, databaseHostId, nodeInstanceId)
        : [{ ec2InstanceId: nodeInstanceId }];
    const clusterNodeInstanceIds = compact(clusterNodeDetails.map(({ ec2InstanceId }) => ec2InstanceId));

    if (!isEmpty(clusterNodeInstanceIds)) {
        const [availableCriticalSQLPatches, instanceInstalledPatchDetails] = await Promise.all([
            getAvailablePatches(credentialsId, region, activeNodeInstanceId),
            getInstalledSQLPatchDetails(credentialsId, region, clusterNodeInstanceIds)
        ]);

        const availableCriticalSQLPatchesList = availableCriticalSQLPatches || [];
        const instanceInstalledPatchDetailsList = instanceInstalledPatchDetails || [];

        // Check if any of the missing patches are part of the available critical patches
        const missingCriticalSqlPatches = instanceInstalledPatchDetailsList?.map(({ instanceId, installedPatches }) => {
            const installedPatchKbNumbers = installedPatches
                .map((patch: InstalledPatches) => extractKbNumber(patch.DisplayName))
                .filter((kbNumber: string | null) => kbNumber !== null);

            const missingPatches = availableCriticalSQLPatchesList.filter(
                availablePatch => !installedPatchKbNumbers.includes(availablePatch.KbNumber)
            );

            const missingPatchDetails: PatchDetail[] = missingPatches?.map(
                ({
                    Classification: classification,
                    MsrcSeverity: severity,
                    ReleaseDate: releaseDate,
                    Title: title,
                    KbNumber: kbId
                }) => ({
                    classification: classification || '',
                    severity: severity || '',
                    releaseDate: typeof releaseDate === 'string' ? releaseDate : releaseDate?.toISOString(),
                    title: title || '',
                    kbId: kbId || ''
                })
            );

            return {
                instanceId,
                missingPatchDetails
            };
        });

        // Create the MSSQLPatchAssessmentObject structure
        const patchAssessmentObjects: MSSQLPatchAssessmentObject[] = missingCriticalSqlPatches?.map(
            ({ instanceId, missingPatchDetails }) => {
                const criticalMissingPatchesCount =
                    missingPatchDetails?.filter(patch => patch.severity === 'Critical').length || 0;
                const importantMissingPatchesCount =
                    missingPatchDetails?.filter(patch => patch.severity === 'Important').length || 0;
                const missingPatchesCount = missingPatchDetails?.length || 0;

                return {
                    ec2InstanceId: instanceId,
                    criticalMissingPatchesCount,
                    importantMissingPatchesCount,
                    missingPatchesCount,
                    missingPatchDetails
                };
            }
        );

        return patchAssessmentObjects;
    }
    throw createError('No instances found to run the mssql patch assessment');
}

export { managedHostMSSQLPatchAssessment, calculateMSSQLPatchDrift, runMSSQLPatchAssessment };
