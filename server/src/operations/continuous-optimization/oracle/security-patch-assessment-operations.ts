import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty } from 'lodash-es';
import getLogger from '../../../utils/logger';
import { WorkloadInstance } from '../../../utils/common-types';
import { ASSESSMENT_SSM_EXECUTION_TIMEOUT, GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../../utils/consts';
import { sqlResponseParsing } from '../../../utils/utils';
import { AssessmentCategoriesOracle, AssessmentStatus } from '../../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { createDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import { callSsmExecution } from '../../aws/ssm-operations';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../../workloads/oracle/consts';
import ORACLE_SECURITY_PATCH_ASSESSMENT from './ssm-scripts/security-patch-assessment-scripts';
import { loadCpuCatalog, type CPUCatalogEntry } from './oracle-cpu-catalog-operations';
import GOLDEN_CONFIG from './golden-config';
import { AppliedPatch, OracleSecurityPatchSsmResponse } from './common-types';
import { OracleSecurityPatchDriftResponseType } from '../../../routes/types/oracle-continuous-optimization.types';

const logger = getLogger();

function isVersionAffected(majorVersion: number, minorVersion: number, entry: string): boolean {
    // affected versions are in the format e.g. 23.4-23.7 (range) or 19.0 (single version)
    if (!entry.includes('-')) {
        const parts = entry.split('.');
        const entryMajor = parseInt(parts[0], 10);
        const entryMinor = parseInt(parts[1], 10);
        return majorVersion === entryMajor && minorVersion === entryMinor;
    }

    const [startStr, endStr] = entry.split('-');
    const startParts = startStr.split('.');
    const endParts = endStr.split('.');
    const startMajor = parseInt(startParts[0], 10);
    const startMinor = parseInt(startParts[1], 10);
    const endMajor = parseInt(endParts[0], 10);
    const endMinor = parseInt(endParts[1], 10);

    if (majorVersion < startMajor || majorVersion > endMajor) {
        return false;
    }

    // An unpatched base install (no RU applied, minorVersion === 0) is inherently
    // affected by all CVEs in this major version family regardless of range start.
    if (majorVersion === startMajor && minorVersion === 0) {
        return true;
    }

    if (majorVersion === startMajor && majorVersion === endMajor) {
        return minorVersion >= startMinor && minorVersion <= endMinor;
    }
    if (majorVersion === startMajor) {
        return minorVersion >= startMinor;
    }
    if (majorVersion === endMajor) {
        return minorVersion <= endMinor;
    }

    return true;
}

/**
 * Parse the latest "Database Release Update" from applied patches to extract:
 * - patchLevel: the effective minor version (e.g. 23 from "19.23.0.0.240416")
 * - releaseDate: the RU release date decoded from yymmdd (e.g. "2024-04-16")
 *
 * Oracle reports the base version (e.g. "19.0.0.0.0") regardless of patch level,
 * so both values must be derived from the opatch output.
 */
function parseLatestReleaseUpdate(appliedPatches: AppliedPatch[]): { patchLevel: number; releaseDate?: string } {
    return appliedPatches.reduce<{ patchLevel: number; releaseDate?: string }>(
        (result, patch) => {
            if (!patch.description?.toLowerCase().includes('database release update')) {
                return result;
            }
            const match = patch.description.match(/\b\d+\.(\d+)\.\d+\.\d+\.(\d{2})(\d{2})(\d{2})\s*\(/);
            if (!match) {
                return result;
            }
            const minor = parseInt(match[1], 10);
            const dateStr = `20${match[2]}-${match[3]}-${match[4]}`;

            if (minor > result.patchLevel) {
                return { patchLevel: minor, releaseDate: dateStr };
            }
            return result;
        },
        { patchLevel: 0 }
    );
}

function findMissingPatches(
    oracleVersion: string,
    appliedPatches: AppliedPatch[],
    catalog: CPUCatalogEntry[]
): Array<Omit<CPUCatalogEntry, 'affectedVersions' | 'additionalCvesAddressed'>> {
    const majorVersion = parseInt(oracleVersion.split('.')?.[0], 10);

    if (Number.isNaN(majorVersion)) {
        logger.error('Could not parse Oracle version for security patch assessment', { oracleVersion });
        return [];
    }

    const { patchLevel: ruPatchLevel, releaseDate: lastRUDate } = parseLatestReleaseUpdate(appliedPatches);
    // Prefer the minor version from applied patches (patchLevel > 0 means a real RU was found).
    // Fall back to the minor from the version string when no RU patch is present
    const versionStringMinor = parseInt(oracleVersion.split('.')?.[1] ?? '0', 10);
    const patchLevel = ruPatchLevel > 0 ? ruPatchLevel : Number.isNaN(versionStringMinor) ? 0 : versionStringMinor;

    const applicableCves = catalog.filter(entry =>
        entry.affectedVersions.some(av => isVersionAffected(majorVersion, patchLevel, av))
    );

    if (isEmpty(applicableCves)) {
        return [];
    }

    const additionalCveExclusions = new Set(applicableCves.flatMap(cve => cve.additionalCvesAddressed || []));

    return applicableCves
        .filter(cve => !additionalCveExclusions.has(cve.cveId))
        .filter(cve => !lastRUDate || cve.releaseDate > lastRUDate)
        .map(({ cveId, component, description, releaseDate, releaseName }) => ({
            cveId,
            component,
            description,
            releaseDate,
            releaseName
        }));
}

async function collectSecurityPatchData(
    credentialsId: string,
    region: string,
    accountId: string,
    ec2InstanceId: string,
    databaseInstanceName: string
): Promise<OracleSecurityPatchSsmResponse> {
    const ssmResponse = await callSsmExecution({
        credentialsId,
        region,
        commands: [ORACLE_SECURITY_PATCH_ASSESSMENT(databaseInstanceName, ec2InstanceId)],
        ec2InstanceId,
        comment: `Oracle security patch assessment for ${databaseInstanceName}`,
        accountId,
        executionTimeout: ASSESSMENT_SSM_EXECUTION_TIMEOUT,
        shouldReadFromCloudWatchLogs: true,
        documentName: SSM_RUN_SHELL_SCRIPT_DOC,
        documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
    });

    const patchInfo = sqlResponseParsing(ssmResponse) as OracleSecurityPatchSsmResponse;

    if (patchInfo.error) {
        throw new Error(patchInfo.error);
    }

    if (!patchInfo.version) {
        throw new Error('Could not determine Oracle version from the database instance');
    }

    return patchInfo;
}

async function calculateOracleSecurityPatchDrift(
    databaseInstanceName: string,
    assessmentData: OracleSecurityPatchSsmResponse | undefined
): Promise<OracleSecurityPatchDriftResponseType | { errorMessage: string }> {
    if (isEmpty(assessmentData) || !assessmentData.version || !assessmentData.appliedPatches) {
        return { errorMessage: GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH) };
    }

    try {
        const { version, appliedPatches } = assessmentData;

        const catalog = await loadCpuCatalog();
        if (isEmpty(catalog)) {
            return {
                errorMessage: 'Oracle CPU security patch catalog is unavailable. Unable to determine missing patches.'
            };
        }

        const missingPatches = findMissingPatches(version, appliedPatches, catalog);

        const status = !isEmpty(missingPatches) ? AssessmentStatus.NOT_OPTIMIZED : AssessmentStatus.OPTIMIZED;

        const objectsInViolation = status === AssessmentStatus.NOT_OPTIMIZED ? [databaseInstanceName] : [];

        return {
            ...GOLDEN_CONFIG.oracleSecurityPatch,
            status,
            recommended: AssessmentStatus.OPTIMIZED,
            objectsInViolation,
            totalObjectsAssessed: 1,
            totalObjectsInViolation: objectsInViolation.length,
            missingPatchesCount: missingPatches.length,
            ...(status === AssessmentStatus.NOT_OPTIMIZED &&
                !isEmpty(missingPatches) && {
                    missingPatchDetails: missingPatches
                })
        };
    } catch (error) {
        const errorMessage = `Error calculating Oracle security patch drift: ${error}`;
        logger.error(errorMessage, { databaseInstanceName });
        return { errorMessage };
    }
}

async function initiateOracleSecurityPatchAssessmentCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceRecord: WorkloadInstance,
    parentJobId: string
) {
    const {
        resourceName,
        id: databaseInstanceId,
        name: databaseInstanceName,
        activeNodeInstanceid
    } = databaseInstanceRecord;

    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;

    logger.info('Initiate oracle security patch assessment collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        databaseInstanceName,
        parentJobId
    });

    const { id: assessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Oracle security patch assessment for ${resourceWithInstanceName}`,
        description: `Oracle security patch assessment for database ${resourceWithInstanceName}`,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    try {
        const { version, appliedPatches } = await collectSecurityPatchData(
            credentialsId,
            region,
            accountId,
            activeNodeInstanceid,
            databaseInstanceName
        );

        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH,
                config_data: { version, appliedPatches }
            }
        ]);
    } catch (error) {
        errorMessage = `Error during Oracle security patch assessment: ${error}`;
        logger.error(errorMessage, {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            error
        });
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, assessmentJobId, {
            endTime: Date.now(),
            status: jobStatus,
            error: errorMessage
        });
    }
}

export { calculateOracleSecurityPatchDrift, initiateOracleSecurityPatchAssessmentCollection, findMissingPatches };
