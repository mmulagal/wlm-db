import { compact, isEmpty } from 'lodash-es';
import createError from 'http-errors';

import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../utils/logger';
import { getAllClusterNodeDetails } from '../database-hosts-operations';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { getAvailablePatches, getInstalledSQLPatchDetails } from '../aws/mssqlPatch-ssm-operations';
import { listResources, updateResourceMetaData } from '../../lib/database/db';
import { Metadata, MSSQLPatchAssessmentObject, PatchDetail } from '../../utils/common-types';
import { extractKbNumber, extractVersionDetails, sqlResponseParsing } from '../../utils/utils';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../utils/consts';
import { updateAsssementErrorInResourceMetadata } from '../../utils/cont-opt-utils';
import { GET_INSTALLED_MSSQL_VERSION } from '../workloads/mssql/continuous-optimization-scripts';
import { callSsmExecution } from '../aws/ssm-operations';

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
    let patchAssessment: MSSQLPatchAssessmentObject[] = [];
    let metadata;
    try {
        [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
    } catch (error) {
        errorMessage = `Error while calculating mssql patch drift. ${error}`;
        logger.error({ errorMessage });
        return { errorMessage };
    }
    try {
        const metadataObject = metadata as unknown as Metadata;
        const { assessment: { mssqlPatch, errors } = {} } = metadataObject;
        logger.info('MSSQL patch assessment from metadata', mssqlPatch);

        if (isEmpty(mssqlPatch)) {
            errorMessage = errors?.mssqlPatch
                ? errors?.mssqlPatch
                : GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.MSSQL_PATCH);
            logger.error({ errorMessage });
            return { errorMessage };
        }

        patchAssessment = mssqlPatch as MSSQLPatchAssessmentObject[];

        // Find unique missing patches by KbNumber with Critical and Important patch counts
        const { uniqueMissingPatches, criticalPatchesCount, importantPatchesCount } =
            getUniqueMissingPatchesAndCountSeverities(patchAssessment);
        const status: AssessmentStatus =
            uniqueMissingPatches.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;

        const recommendationMessage: string =
            status === AssessmentStatus.NOT_OPTIMIZED
                ? `Critical (${criticalPatchesCount}) and important (${importantPatchesCount}) patches are missing. We recommend applying the latest patches to ensure your MSSQL instance is secure and up-to-date.`
                : 'Your MSSQL instance is up-to-date with all critical and important patches applied.';

        const objectsInViolation: string[] =
            status === AssessmentStatus.NOT_OPTIMIZED ? patchAssessment?.map(({ ec2InstanceId }) => ec2InstanceId) : [];

        // Determine severity based on patch counts
        let severity = SEVERITY.CRITICAL; // Default to CRITICAL
        if (criticalPatchesCount === 0 && importantPatchesCount > 0) {
            severity = SEVERITY.WARNING;
        }

        return {
            name: 'mssql-patch',
            status: status as AssessmentStatus,
            recommended: AssessmentStatus.OPTIMIZED,
            missingPatchesInEc2Instances: patchAssessment,
            severity,
            recommendation: recommendationMessage,
            tags: [AwsWellArchitecturedPillars.SECURITY, AwsWellArchitecturedPillars.RELIABILITY],
            objectsInViolation,
            resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE
        };
    } catch (error: any) {
        errorMessage = `Error while calculating MSSQL patch drift. ${error.message}`;
        logger.error({ errorMessage, error });
        const existingAssessmentData = (metadata as unknown as Metadata).assessment;
        const assessmentErrors = { ...existingAssessmentData?.errors, mssqlPatch: errorMessage };
        (metadata as unknown as Metadata).assessment = {
            ...existingAssessmentData,
            errors: assessmentErrors,
            lastAssessedDate: new Date().getTime().toString()
        };
        updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
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
        name: `Microsoft SQL Server patch assessment for ${resourceName}`,
        description: `Microsoft SQL Server patch assessment for ${resourceName}`,
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
        if (errorMessage) {
            await updateAsssementErrorInResourceMetadata(
                accountId,
                databaseHostId,
                credentialsId,
                region,
                errorMessage,
                'mssqlPatch'
            );
        }
    }

    return patchAssessment;
}

async function getTheMSSqlversion(credentialsId: string, region: string, instanceId: string) {
    const ssmCommand = GET_INSTALLED_MSSQL_VERSION();

    const response = await callSsmExecution(
        credentialsId,
        region,
        [ssmCommand],
        instanceId,
        'Get Installed SQL version'
    );
    const [parsedResponse] = sqlResponseParsing(response);
    const { version } = parsedResponse;
    const { version: versionYear, releaseDate } = extractVersionDetails(version);

    return { version, versionYear, releaseDate };
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
        const { releaseDate: currentVersionReleaseDate, versionYear: sqlServerYear } = await getTheMSSqlversion(
            credentialsId,
            region,
            activeNodeInstanceId
        );

        const [availableCriticalSQLPatches, instanceInstalledPatchDetails] = await Promise.all([
            getAvailablePatches(credentialsId, region, activeNodeInstanceId, sqlServerYear),
            getInstalledSQLPatchDetails(credentialsId, region, clusterNodeInstanceIds)
        ]);

        const instanceInstalledPatchDetailsList = instanceInstalledPatchDetails || [];

        // Create the MSSQLPatchAssessmentObject structure
        const patchAssessmentObjects: MSSQLPatchAssessmentObject[] = instanceInstalledPatchDetailsList.map(
            ({ instanceId, installedPatches }) => {
                const installedPatchKbNumbers = new Set(
                    installedPatches
                        .map((patch: InstalledPatches) => extractKbNumber(patch.DisplayName))
                        .filter((kbNumber: string | null) => kbNumber !== null)
                );

                const missingPatchDetails: PatchDetail[] = [];
                let criticalMissingPatchesCount = 0;
                let importantMissingPatchesCount = 0;

                for (const availablePatch of availableCriticalSQLPatches) {
                    if (
                        !installedPatchKbNumbers.has(availablePatch.KbNumber) &&
                        availablePatch.ReleaseDate &&
                        new Date(availablePatch.ReleaseDate) >= new Date(currentVersionReleaseDate)
                    ) {
                        const {
                            Classification: classification = '',
                            MsrcSeverity: severity = '',
                            ReleaseDate: releaseDate,
                            Title: title = '',
                            KbNumber: kbId = ''
                        } = availablePatch;

                        const patchDetail: PatchDetail = {
                            classification,
                            severity,
                            releaseDate: typeof releaseDate === 'string' ? releaseDate : releaseDate?.toISOString(),
                            title,
                            kbId
                        };

                        missingPatchDetails.push(patchDetail);

                        if (patchDetail.severity === 'Critical') {
                            criticalMissingPatchesCount += 1;
                        } else if (patchDetail.severity === 'Important') {
                            importantMissingPatchesCount += 1;
                        }
                    }
                }

                return {
                    ec2InstanceId: instanceId,
                    criticalMissingPatchesCount,
                    importantMissingPatchesCount,
                    missingPatchesCount: missingPatchDetails.length,
                    missingPatchDetails
                };
            }
        );

        return patchAssessmentObjects;
    }
    throw createError('No instances found to run the mssql patch assessment');
}

function getUniqueMissingPatchesAndCountSeverities(patchAssessment: MSSQLPatchAssessmentObject[]): {
    uniqueMissingPatches: PatchDetail[];
    criticalPatchesCount: number;
    importantPatchesCount: number;
} {
    const seenKbIds = new Set<string>();
    const uniqueMissingPatches: PatchDetail[] = [];
    let criticalPatchesCount = 0;
    let importantPatchesCount = 0;

    for (const instance of patchAssessment) {
        if (instance.missingPatchDetails) {
            for (const patch of instance.missingPatchDetails) {
                if (patch.kbId && !seenKbIds.has(patch.kbId)) {
                    seenKbIds.add(patch.kbId);
                    uniqueMissingPatches.push(patch);

                    // Count severities
                    if (patch.severity === 'Critical') {
                        criticalPatchesCount += 1;
                    } else if (patch.severity === 'Important') {
                        importantPatchesCount += 1;
                    }
                }
            }
        }
    }

    return { uniqueMissingPatches, criticalPatchesCount, importantPatchesCount };
}

export { managedHostMSSQLPatchAssessment, calculateMSSQLPatchDrift, runMSSQLPatchAssessment, getTheMSSqlversion };
