import { compact, isEmpty } from 'lodash-es';
import createError from 'http-errors';

import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../utils/logger';
import { getAllClusterNodeDetails } from '../database-hosts-operations';
import { AssessmentStatus, AwsWellArchitecturedPillars, SEVERITY } from '../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { getAvailablePatches, getMissingPatchDetails } from '../aws/ospatch-ssm-operations';
import { listResources, updateResourceMetaData } from '../../lib/database/db';
import { Metadata, MSSQLPatchAssessmentObject } from '../../utils/common-types';

const logger = getLogger();

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
        let patchAssessment;

        const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
        const metadataObject = metadata as unknown as Metadata;
        const { assessment: { mssqlPatch } = {} } = metadataObject;
        if (!isEmpty(mssqlPatch)) {
            patchAssessment = mssqlPatch as MSSQLPatchAssessmentObject[];
        } else {
            const { node1InstanceId, node2InstanceId } = metadataObject;
            patchAssessment = await runMSSQLPatchAssessment(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                node1InstanceId,
                !!node2InstanceId // assumption: if both node1 and node2 instance ids are present, then it is a cluster
            );
            logger.debug('Patch assessment result while calculating', patchAssessment);
            const existingAssessmentData = (metadata as unknown as Metadata).assessment;
            (metadata as unknown as Metadata).assessment = {
                ...existingAssessmentData,
                mssqlPatch: patchAssessment
            };
            updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
        }

        const criticalPatchesCount =
            patchAssessment?.reduce((count, instance) => count + (instance.criticalMissingPatchesCount || 0), 0) || 0;
        const importantPatchesCount =
            patchAssessment?.reduce((count, instance) => count + (instance.importantMissingPatchesCount || 0), 0) || 0;

        const status = patchAssessment?.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;
        const recommendationMessage =
            status === AssessmentStatus.NOT_OPTIMIZED
                ? `Critical (${criticalPatchesCount}) and important (${importantPatchesCount}) patches are missing. We recommend applying the latest patches to ensure your MSSQL instance is secure and up-to-date.`
                : 'Your MSSQL instance is up-to-date with all critical and important patches applied.';

        return {
            name: 'mssql-patch',
            status: status as AssessmentStatus,
            missingPatchesInEc2Instances: patchAssessment,
            severity: SEVERITY.CRITICAL,
            recommendation: recommendationMessage,
            tags: [AwsWellArchitecturedPillars.SECURITY]
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
            isPartOfCluster
        );
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
    isPartOfCluster: boolean = false
) {
    logger.info('Running MsSql Patch assessment', {
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
        const availableCriticalSQLPatches = (await getAvailablePatches(region)) || [];
        const instanceMissingPatchDetails =
            (await getMissingPatchDetails(credentialsId, region, clusterNodeInstanceIds)) || [];

        // Check if any of the missing patches are part of the available critical patches
        const missingCriticalSqlPatches = instanceMissingPatchDetails?.map(({ instanceId, missingPatches }) => {
            const missingPatchDetails = missingPatches
                ?.filter(missingPatch =>
                    availableCriticalSQLPatches?.some(availablePatch => availablePatch.KbNumber === missingPatch.KBId)
                )
                .map(
                    ({
                        Classification: classification,
                        Severity: severity,
                        State: state,
                        Title: title,
                        KBId: kbId
                    }) => ({
                        classification,
                        severity,
                        state,
                        title,
                        kbId
                    })
                );

            return {
                instanceId,
                missingPatchDetails
            };
        });

        // Create the MSSQLPatchAssessmentObject structure
        const patchAssessmentObjects = missingCriticalSqlPatches?.map(({ instanceId, missingPatchDetails }) => {
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
        });

        return patchAssessmentObjects;
    }
    throw createError('No instances found to run the mssql patch assessment');
}

export { managedHostMSSQLPatchAssessment, calculateMSSQLPatchDrift, runMSSQLPatchAssessment };
