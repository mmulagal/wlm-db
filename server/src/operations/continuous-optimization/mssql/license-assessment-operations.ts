import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { getSqlServerVersionAndEdition } from '../../workloads/mssql/mssql-operations';
import {
    fetchSqlServerInstanceConfiguration,
    getLicenseRecommendations,
    isNonFreeEnterpriseEdition
} from '../../recommendation-operations';

import getLogger from '../../../utils/logger';
import { LicenseAssessment, ResourceAssessmentData } from '../../../utils/common-types';
import { ENT_ENGINE_EDITION, FINDING, GENERIC_ASSESSMENT_ERROR_MESSAGE, SQL_STD } from '../../../utils/consts';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../../database/job-operations';
import { getMatchingAssessmentStatus } from '../assessment-utils';

const logger = getLogger();

function calculateLicenseDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    assessmentData: ResourceAssessmentData
) {
    logger.info('Calculating license drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });

    let errorMessage = '';
    let licenseAssessment;

    try {
        const { license, errors } = assessmentData;

        if (isEmpty(license)) {
            errorMessage = errors?.license
                ? errors?.license
                : GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.LICENSE);
            logger.error({ errorMessage });
            return { errorMessage };
        }

        licenseAssessment = license as LicenseAssessment;

        const { licenseFinding, sqlServerInstances } = licenseAssessment;
        const matchingLicenseAssessmentStatus = getMatchingAssessmentStatus(licenseFinding);
        const recommendationMessage =
            licenseFinding === FINDING.NOT_OPTIMIZED
                ? 'When Workload Factory detects that your database infrastructure is not using any of the commercial software license features you are paying for, a license is considered not optimized. A license that is not optimized might result in unnecessary additional costs.'
                : 'When the license for your commercial software database meets your performance requirements, the license is considered optimized';

        return {
            name: 'sql-license',
            status: matchingLicenseAssessmentStatus,
            recommended: AssessmentStatus.OPTIMIZED,
            severity: SEVERITY.WARNING,
            recommendation: recommendationMessage,
            tags: [AwsWellArchitecturedPillars.COST_OPTIMIZATION],
            sqlServerInstances,
            resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE
        };
    } catch (error: any) {
        errorMessage = `Error while calculating license drift. ${error.message}`;
        logger.error({ errorMessage, error });
    }
    return { errorMessage };
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
