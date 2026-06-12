import { compact, isEmpty, omit } from 'lodash-es';
import createError from 'http-errors';

import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import getLogger from '../../../utils/logger';
import { getAllClusterNodeDetails } from '../../database-hosts-operations';
import { AssessmentCategories, AssessmentStatus, SEVERITY } from '../../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { getAvailablePatches, getInstalledSQLPatchDetails } from '../../aws/mssqlPatch-ssm-operations';
import { MSSQLPatchAssessmentObject, PatchDetail, ResourceAssessmentData } from '../../../utils/common-types';
import {
    extractKbNumber,
    extractSqlInstanceName,
    extractVersionDetails,
    getResourceNameFromTags,
    sqlResponseParsing
} from '../../../utils/utils';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../../utils/consts';
import { GET_INSTALLED_MSSQL_VERSION } from '../../workloads/mssql/assessment-scripts';
import { callSsmExecution } from '../../aws/ssm-operations';
import { describeInstance } from '../../../lib/aws/ec2';
import { getActiveSqlNode } from '../../workloads/mssql/mssql-operations';
import { updateDatabaseHostAssessmentData } from '../../database/database-operations';
import type { AssessmentErrorItemType, ErrorResponseType } from '../../../routes/types/continuous-optimization.types';
import type {
    MssqlAssessmentItemType,
    MSSQLPatchScanResponseType
} from '../../../routes/types/mssql-continuous-optimisation.types';
import { MSSQL_GOLDEN_CONFIG } from './golden-config';

const logger = getLogger();

interface InstalledPatches {
    DisplayName: string;
    DisplayVersion: string;
    InstallDate: string;
}

function calculateMSSQLPatchDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    assessmentData: ResourceAssessmentData
): MssqlAssessmentItemType | AssessmentErrorItemType {
    logger.info('Calculating MSSQL Patch drift', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        assessmentData
    });
    const [goldenConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'mssql-patch');

    try {
        const { mssqlPatch, errors } = assessmentData;

        if (isEmpty(mssqlPatch)) {
            const errorMessage = errors?.mssqlPatch
                ? errors?.mssqlPatch
                : GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.MSSQL_PATCH);
            logger.error({ errorMessage });
            return { ...goldenConfig, errorMessage };
        }

        const patchAssessment = mssqlPatch as MSSQLPatchAssessmentObject[];

        const criticalPatchesCount = patchAssessment.reduce(
            (sum, { criticalMissingPatchesCount = 0 }) => sum + criticalMissingPatchesCount,
            0
        );
        const importantPatchesCount = patchAssessment.reduce(
            (sum, { importantMissingPatchesCount = 0 }) => sum + importantMissingPatchesCount,
            0
        );
        const status: AssessmentStatus =
            criticalPatchesCount > 0 || importantPatchesCount > 0
                ? AssessmentStatus.NOT_OPTIMIZED
                : AssessmentStatus.OPTIMIZED;

        const recommendation =
            status === AssessmentStatus.NOT_OPTIMIZED
                ? `Critical (${criticalPatchesCount}) and important (${importantPatchesCount}) patches are missing. We recommend applying the latest patches to ensure your MSSQL instance is secure and up-to-date.`
                : 'Your MSSQL instance is up-to-date with all critical and important patches applied.';

        const objectsInViolation: string[] =
            status === AssessmentStatus.NOT_OPTIMIZED ? patchAssessment?.map(({ ec2InstanceId }) => ec2InstanceId) : [];

        // Severity is downgraded to warning when only important (non-critical) patches are missing
        const severity =
            criticalPatchesCount === 0 && importantPatchesCount > 0 ? SEVERITY.WARNING : goldenConfig.severity;

        return {
            ...goldenConfig,
            status,
            recommended: AssessmentStatus.OPTIMIZED,
            missingPatchesInEc2Instances: patchAssessment,
            severity,
            recommendation,
            objectsInViolation
        };
    } catch (error: any) {
        const errorMessage = `Error while calculating MSSQL patch drift. ${error.message}`;
        logger.error({ errorMessage, error });
        return { ...goldenConfig, errorMessage };
    }
}

async function managedHostMSSQLPatchAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    activeNodeInstanceId: string,
    isPartOfCluster: boolean = false,
    resourceName: string,
    sqlAuthEnabled: boolean,
    instanceName: string,
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
        sqlAuthEnabled,
        instanceName,
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
            activeNodeInstanceId,
            sqlAuthEnabled,
            instanceName
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

    return { patchAssessment, errorMessage };
}

async function getTheMSSqlversion(
    credentialsId: string,
    region: string,
    instanceId: string,
    sqlAuthEnabled: boolean,
    instanceName: string,
    accountId: string
) {
    logger.info('Getting the MSSQL version', {
        credentialsId,
        region,
        instanceId,
        sqlAuthEnabled,
        instanceName
    });

    const ssmCommand = GET_INSTALLED_MSSQL_VERSION(instanceName, sqlAuthEnabled);

    const response = await callSsmExecution({
        credentialsId,
        region,
        commands: [ssmCommand],
        ec2InstanceId: instanceId,
        comment: 'Get Installed SQL version',
        accountId
    });
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
    activeNodeInstanceId: string,
    sqlAuthEnabled: boolean,
    instanceName: string
): Promise<MSSQLPatchAssessmentObject[]> {
    logger.info('Running MsSql Patch assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        nodeInstanceId,
        isPartOfCluster,
        activeNodeInstanceId,
        sqlAuthEnabled,
        instanceName
    });
    try {
        let clusterNodeDetails;
        if (isPartOfCluster) {
            clusterNodeDetails = await getAllClusterNodeDetails(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                nodeInstanceId
            );
        } else {
            // Get the EC2 instance name for standalone
            const { Reservations = [] } = await describeInstance(credentialsId, region, {
                InstanceIds: [nodeInstanceId]
            });
            const ec2Name = getResourceNameFromTags(Reservations?.[0]?.Instances?.[0]?.Tags);
            clusterNodeDetails = [{ ec2InstanceId: nodeInstanceId, ec2InstanceName: ec2Name || 'Unknown' }];
        }

        const clusterNodeInstanceIds = compact(clusterNodeDetails?.map(({ ec2InstanceId }) => ec2InstanceId));

        if (!isEmpty(clusterNodeInstanceIds)) {
            const { releaseDate: currentVersionReleaseDate, versionYear: sqlServerYear } = await getTheMSSqlversion(
                credentialsId,
                region,
                activeNodeInstanceId,
                sqlAuthEnabled,
                instanceName,
                accountId
            );

            const [availableCriticalSQLPatches, instanceInstalledPatchDetails] = await Promise.all([
                getAvailablePatches(credentialsId, region, activeNodeInstanceId, sqlServerYear),
                getInstalledSQLPatchDetails(credentialsId, region, clusterNodeInstanceIds, accountId)
            ]);

            const instanceInstalledPatchDetailsList = instanceInstalledPatchDetails || [];

            // Map ec2InstanceId to ec2InstanceName for quick lookup
            const ec2InstanceNameMap = new Map(
                clusterNodeDetails.map(({ ec2InstanceId, ec2InstanceName }) => [ec2InstanceId, ec2InstanceName])
            );

            // Create the MSSQLPatchAssessmentObject structure
            const patchAssessmentObjects: MSSQLPatchAssessmentObject[] = instanceInstalledPatchDetailsList.map(
                ({ instanceId, installedPatches }) => {
                    const installedPatchKbNumbers = new Set(
                        (Array.isArray(installedPatches) ? installedPatches : [])
                            .map((patch: InstalledPatches) => extractKbNumber(patch.DisplayName))
                            .filter((kbNumber: string | null) => kbNumber !== null)
                    );

                    const missingPatchDetails: PatchDetail[] = [];
                    let criticalMissingPatchesCount = 0;
                    let importantMissingPatchesCount = 0;

                    for (const availablePatch of availableCriticalSQLPatches) {
                        if (
                            !installedPatchKbNumbers.has(availablePatch?.KbNumber ?? '') &&
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
                        ec2InstanceName: ec2InstanceNameMap.get(instanceId) || 'Unknown',
                        criticalMissingPatchesCount,
                        importantMissingPatchesCount,
                        missingPatchesCount: missingPatchDetails.length,
                        missingPatchDetails
                    };
                }
            );

            return patchAssessmentObjects;
        }
    } catch (error) {
        logger.error('Error while running MSSQL patch assessment', { error });
        throw error instanceof Error ? error : new Error(`${error}`);
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

async function fetchMssqlPatchWithMissingPatches(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    dbInstanceName: string,
    sqlAuthEnabled: boolean,
    node1InstanceId: string,
    node2InstanceId: string | undefined,
    hostLevelAssessmentData: ResourceAssessmentData | undefined = {}
): Promise<MSSQLPatchScanResponseType | ErrorResponseType> {
    logger.info('Running live MSSQL patch scan', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    });

    try {
        const { activeNodeInstanceId = '', instanceName } = await getActiveSqlNode(credentialsId, region, {
            node1InstanceId,
            node2InstanceId,
            resourceId: databaseHostId,
            accountId
        });

        if (!activeNodeInstanceId) {
            return {
                errorMessage: `Active node instance ID not found for database host ${databaseHostId}`
            };
        }

        const isPartOfCluster = Boolean(node2InstanceId && node2InstanceId.trim() !== '');
        const sqlInstanceName = extractSqlInstanceName(instanceName || dbInstanceName);

        const assessmentData = await runMSSQLPatchAssessment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            activeNodeInstanceId,
            isPartOfCluster,
            activeNodeInstanceId,
            sqlAuthEnabled,
            sqlInstanceName
        );

        const { uniqueMissingPatches } = getUniqueMissingPatchesAndCountSeverities(assessmentData);
        const storedAssessment = assessmentData.map(instance => omit(instance, 'missingPatchDetails'));

        updateDatabaseHostAssessmentData(accountId, credentialsId, databaseHostId, {
            ...hostLevelAssessmentData,
            mssqlPatch: storedAssessment
        }).catch(storeError => {
            logger.error('Failed to persist live MSSQL patch assessment', {
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                error: storeError
            });
        });

        return {
            status: uniqueMissingPatches.length > 0 ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED,
            ec2InstancesToPatch: assessmentData.map(instance => ({
                ec2InstanceId: instance.ec2InstanceId,
                missingPatchDetails: instance.missingPatchDetails ?? []
            }))
        };
    } catch (error) {
        const errorMessage = 'Failed to run MSSQL patch scan';
        logger.error(errorMessage, { accountId, credentialsId, region, databaseHostId, databaseInstanceId, error });
        return { errorMessage };
    }
}

export {
    managedHostMSSQLPatchAssessment,
    calculateMSSQLPatchDrift,
    runMSSQLPatchAssessment,
    getTheMSSqlversion,
    fetchMssqlPatchWithMissingPatches
};
