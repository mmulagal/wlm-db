import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { isEmpty, omit } from 'lodash-es';
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
import ORACLE_GOLDEN_CONFIG from './golden-config';
import { OracleSecurityPatchSsmResponse } from './common-types';
import {
    OracleSecurityPatchDriftResponseType,
    OracleSecurityPatchMissingPatchType,
    OracleSecurityPatchScanResponseType
} from '../../../routes/types/oracle-continuous-optimization.types';
import type {
    AssessmentItemType,
    AssessmentErrorItemType,
    ErrorResponseType
} from '../../../routes/types/continuous-optimization.types';

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

type OracleSecurityPatchAssessmentResult = OracleSecurityPatchDriftResponseType & {
    missingPatches: OracleSecurityPatchMissingPatchType[];
};

async function runOracleSecurityPatchAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    databaseInstanceName: string
): Promise<OracleSecurityPatchAssessmentResult> {
    const [instancePatchData, catalog] = await Promise.all([
        collectSecurityPatchData(credentialsId, region, accountId, ec2InstanceId, databaseInstanceName),
        loadCpuCatalog()
    ]);

    if (isEmpty(catalog)) {
        throw new Error('Oracle Critical Patch Updates catalog is unavailable. Unable to determine missing patches.');
    }

    const { version, appliedPatches } = instancePatchData;
    const missingPatches = findMissingPatches(version, appliedPatches, catalog);

    const status = missingPatches.length === 0 ? AssessmentStatus.OPTIMIZED : AssessmentStatus.NOT_OPTIMIZED;

    const objectsInViolation = status === AssessmentStatus.NOT_OPTIMIZED ? [databaseInstanceName] : [];
    const [securityPatchConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'oracle-security-patch');
    return {
        ...securityPatchConfig,
        status,
        recommended: AssessmentStatus.OPTIMIZED,
        objectsInViolation,
        totalObjectsAssessed: 1,
        totalObjectsInViolation: objectsInViolation.length,
        missingPatchesCount: missingPatches.length,
        missingPatches
    };
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

function calculateOracleSecurityPatchDrift(
    assessmentData: OracleSecurityPatchDriftResponseType | undefined
): AssessmentItemType | AssessmentErrorItemType {
    const [goldenConfig] = ORACLE_GOLDEN_CONFIG.filter(e => e.id === 'oracle-security-patch');
    if (!assessmentData || !assessmentData.status || assessmentData.totalObjectsAssessed === 0) {
        const errorMessage = GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH);
        return { ...goldenConfig, errorMessage };
    }

    return { ...goldenConfig, ...assessmentData };
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
        const patchAssessmentData = await runOracleSecurityPatchAssessment(
            accountId,
            credentialsId,
            region,
            activeNodeInstanceid,
            databaseInstanceName
        );

        const storedAssessment = omit(patchAssessmentData, 'missingPatches');
        await createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH,
                config_data: storedAssessment
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

async function fetchOracleSecurityPatchWithMissingPatches(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    databaseInstanceName: string,
    ec2InstanceId: string
): Promise<OracleSecurityPatchScanResponseType | ErrorResponseType> {
    logger.info('Running Oracle Critical Patch Updates scan', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        databaseInstanceName,
        ec2InstanceId
    });

    try {
        const patchAssessmentData = await runOracleSecurityPatchAssessment(
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            databaseInstanceName
        );

        const storedAssessment = omit(patchAssessmentData, 'missingPatches');
        createDatabaseInstanceConfigData([
            {
                account_id: accountId,
                credentials_id: credentialsId,
                region,
                resource_id: databaseHostId,
                database_instance_id: databaseInstanceId,
                creation_time: new Date(Date.now()),
                config_data_type: AssessmentCategoriesOracle.ORACLE_SECURITY_PATCH,
                config_data: storedAssessment
            }
        ]).catch(error => {
            logger.error('Failed to persist Oracle Critical Patch Updates assessment data', {
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId,
                error
            });
        });

        return {
            status: patchAssessmentData.status,
            ec2InstancesToPatch: [
                {
                    ec2InstanceId,
                    database: databaseInstanceName,
                    missingPatchDetails: patchAssessmentData.missingPatches
                }
            ]
        };
    } catch (error) {
        logger.error('Failed to run Oracle Critical Patch Updates scan', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            ec2InstanceId,
            error
        });
        return {
            errorMessage: `Unable to run Oracle Critical Patch Updates scan for database instance ${databaseInstanceName}: ${
                error instanceof Error ? error.message : String(error)
            }`
        };
    }
}

export {
    calculateOracleSecurityPatchDrift,
    initiateOracleSecurityPatchAssessmentCollection,
    findMissingPatches,
    fetchOracleSecurityPatchWithMissingPatches
};
