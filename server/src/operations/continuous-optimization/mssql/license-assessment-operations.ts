import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { getSqlServerVersionAndEdition } from '../../workloads/mssql/mssql-operations';
import {
    fetchSqlServerInstanceConfiguration,
    getLicenseRecommendations,
    isNonFreeEnterpriseEdition
} from '../../recommendation-operations';

import getLogger from '../../../utils/logger';
import { ResourceAssessmentData } from '../../../utils/common-types';
import { ENT_ENGINE_EDITION, FINDING, GENERIC_ASSESSMENT_ERROR_MESSAGE, SQL_STD } from '../../../utils/consts';
import { AssessmentCategories, AssessmentStatus } from '../../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { getMatchingAssessmentStatus } from '../assessment-utils';
import type { AssessmentErrorItemType } from '../../../routes/types/continuous-optimization.types';
import type { MssqlAssessmentItemType } from '../../../routes/types/mssql-continuous-optimisation.types';
import { MSSQL_GOLDEN_CONFIG } from './golden-config';

const logger = getLogger();

function calculateLicenseDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    assessmentData: ResourceAssessmentData
): MssqlAssessmentItemType | AssessmentErrorItemType {
    logger.info('Calculating license drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });

    const [goldenConfig] = MSSQL_GOLDEN_CONFIG.filter(e => e.id === 'sql-license');

    try {
        const { license, errors } = assessmentData;

        if (isEmpty(license)) {
            const errorMessage = errors?.license
                ? errors?.license
                : GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.LICENSE);
            logger.error({ errorMessage });
            return { ...goldenConfig, errorMessage };
        }

        const { licenseFinding, sqlServerInstances } = license;
        const matchingLicenseAssessmentStatus = getMatchingAssessmentStatus(licenseFinding);

        const isViolation = matchingLicenseAssessmentStatus !== AssessmentStatus.OPTIMIZED;
        return {
            ...goldenConfig,
            status: matchingLicenseAssessmentStatus,
            recommended: AssessmentStatus.OPTIMIZED,
            sqlServerInstances,
            totalObjectsAssessed: sqlServerInstances?.length ?? 1,
            totalObjectsInViolation: isViolation ? sqlServerInstances?.length ?? 0 : 0,
            objectsInViolation: isViolation ? sqlServerInstances?.map(i => i.sqlServerInstance ?? '') ?? [] : []
        };
    } catch (error: any) {
        const errorMessage = `Error while calculating license drift. ${error.message}`;
        logger.error({ errorMessage, error });
        return { ...goldenConfig, errorMessage };
    }
}

async function managedHostsLicenseAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    resourceName: string,
    parentJobId?: string
) {
    logger.info('Managed hosts license assessment', {
        accountId,
        credentialsId,
        region,
        activeNodeInstanceId,
        resourceName,
        parentJobId
    });

    const { id: licenseAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Microsoft SQL Server license assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL Server license assessment for ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let licenseAssessment;
    let jobStatus;
    let errorMessage;
    try {
        licenseAssessment = await runLicenseAssessment(accountId, credentialsId, region, activeNodeInstanceId);
    } catch (error) {
        errorMessage = `Error while performing license assessment. ${error}`;
        logger.error(errorMessage);

        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, licenseAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus || JOBSTATUS.COMPLETED,
            error: errorMessage
        });
    }

    return { licenseAssessment, errorMessage };
}

async function runLicenseAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string
) {
    logger.info('Run license assessment', { accountId, credentialsId, region, activeNodeInstanceId });
    try {
        const sqlServerInstances = await getSqlServerVersionAndEdition(
            accountId,
            credentialsId,
            region,
            activeNodeInstanceId
        );
        const { sqlServerDeploymentType = '' } = fetchSqlServerInstanceConfiguration(sqlServerInstances) || {};
        if (
            sqlServerInstances.some(
                ({ sqlServerEngineEdition, sqlServerEdition }) =>
                    sqlServerEngineEdition === ENT_ENGINE_EDITION && isNonFreeEnterpriseEdition(sqlServerEdition!)
            )
        ) {
            return getLicenseRecommendations(
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                sqlServerInstances,
                sqlServerDeploymentType
            );
        }
        return {
            licenseFinding: FINDING.OPTIMIZED,
            recommendedLicenseType: SQL_STD,
            sqlServerInstances
        };
    } catch (error) {
        logger.error('Error while running license assessment', { error });
        throw error instanceof Error ? error : new Error(`${error}`);
    }
}

export { calculateLicenseDrift, managedHostsLicenseAssessment };
