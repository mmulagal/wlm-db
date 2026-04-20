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
import { OracleSecurityPatchSsmResponse } from './common-types';
import { OracleSecurityPatchDriftResponseType } from '../../../routes/types/oracle-continuous-optimization.types';

const logger = getLogger();

// Oracle "c"-release suffix (e.g. 19c, 21c) corresponds to minor version 3
const C_SUFFIX_MINOR = 3;

function readVersion(versionStr: string): { major: number; minor: number } {
    const cMatch = versionStr.match(/^(\d+)c$/);
    if (cMatch) {
        return { major: parseInt(cMatch[1], 10), minor: C_SUFFIX_MINOR };
    }
    const parts = versionStr.split('.');
    return { major: parseInt(parts[0], 10), minor: parseInt(parts[1] ?? '0', 10) };
}

function isVersionAffected(majorVersion: number, minorVersion: number, entry: string): boolean {
    if (!entry.includes('-')) {
        // exact version match
        const { major, minor } = readVersion(entry);
        return majorVersion === major && minorVersion === minor;
    }

    const [startStr, endStr] = entry.split('-');
    const start = readVersion(startStr);
    const end = readVersion(endStr);
    const inOrder = start.major < end.major || (start.major === end.major && start.minor <= end.minor);
    const [lo, hi] = inOrder ? [start, end] : [end, start];

    if (majorVersion < lo.major || majorVersion > hi.major) {
        return false;
    }

    // An unpatched base install (no RU applied, minorVersion === 0) is inherently
    // affected by all CVEs in this major version family regardless of range start.
    if (majorVersion === lo.major && minorVersion === 0) {
        return true;
    }

    if (majorVersion === lo.major && majorVersion === hi.major) {
        return minorVersion >= lo.minor && minorVersion <= hi.minor;
    }
    if (majorVersion === lo.major) {
        return minorVersion >= lo.minor;
    }
    if (majorVersion === hi.major) {
        return minorVersion <= hi.minor;
    }

    return true;
}

function findMissingPatches(
    oracleVersion: string,
    appliedPatches: Record<string, string>,
    catalog: CPUCatalogEntry[]
): Array<Omit<CPUCatalogEntry, 'affectedVersions' | 'additionalCvesAddressed'>> {
    const versionParts = oracleVersion.split('.');
    const majorVersion = parseInt(versionParts[0], 10);
    const minorVersion = parseInt(versionParts[1] ?? '0', 10);

    if (Number.isNaN(majorVersion)) {
        logger.error('Could not parse Oracle version for Critical Patch Updates assessment', { oracleVersion });
        return [];
    }

    const applicableCves = catalog.filter(entry =>
        entry.affectedVersions.some(av => isVersionAffected(majorVersion, minorVersion, av))
    );

    if (isEmpty(applicableCves)) {
        return [];
    }

    const additionalCveExclusions = new Set(applicableCves.flatMap(cve => cve.additionalCvesAddressed || []));

    // The "database" key in appliedPatches serves as the general Release Update date of oracle db server
    const fallbackDate = appliedPatches.database;

    return applicableCves
        .filter(cve => !additionalCveExclusions.has(cve.cveId))
        .filter(cve => {
            const cveComponentLower = cve.component.toLowerCase();
            const matchedEntry = Object.entries(appliedPatches).find(([comp]) => cveComponentLower.startsWith(comp));
            const effectiveDate = matchedEntry?.[1] ?? fallbackDate;
            // If effectiveDate is defined, the CVE must be released after that date to be considered missing
            return !effectiveDate || cve.releaseDate > effectiveDate;
        })
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
        comment: `Oracle Critical Patch Updates assessment for ${databaseInstanceName}`,
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
                errorMessage:
                    'Oracle Critical Patch Updates catalog is unavailable. Unable to determine missing patches.'
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
        const errorMessage = `Error calculating Oracle Critical Patch Updates assessment drift: ${error}`;
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

    logger.info('Initiating Oracle Critical Patch Updates assessment data collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        databaseInstanceName,
        parentJobId
    });

    const { id: assessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Oracle Critical Patch Updates assessment for ${resourceWithInstanceName}`,
        description: `Oracle Critical Patch Updates assessment for database ${resourceWithInstanceName}`,
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
        errorMessage = `Error during Oracle Critical Patch Updates assessment: ${error}`;
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
