import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { getHostAndSqlServerInfo } from '../discover-operations';
import { listResources, updateResourceMetaData } from '../../lib/database/db';
import {
    fetchSqlServerInstanceConfiguration,
    getLicenseRecommendations,
    isNonFreeEnterpriseEdition
} from '../recommendation-operations';

import getLogger from '../../utils/logger';
import { LicenseAssessment, Metadata } from '../../utils/common-types';
import { getInstanceDetails } from '../database-hosts-operations';
import { ENT_ENGINE_EDITION, FINDING, SQL_STD } from '../../utils/consts';
import { AssessmentStatus, AwsWellArchitecturedPillars, SEVERITY } from '../../utils/continous-optimization-consts';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { getMatchingAssessmentStatus } from './assessment-utils';

const logger = getLogger();

async function calculateLicenseDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Calculating license drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });

    let errorMessage = '';
    try {
        let licenseAssessment;

        const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
        const { assessment: { license } = {} } = metadata as unknown as Metadata;
        if (!isEmpty(license)) {
            licenseAssessment = license as LicenseAssessment;
        } else {
            const { activeNodeInstanceId } = await getInstanceDetails(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId
            );
            licenseAssessment = await runLicenseAssessment(accountId, credentialsId, region, activeNodeInstanceId);
            const existingAssessmentData = (metadata as unknown as Metadata).assessment;
            (metadata as unknown as Metadata).assessment = {
                ...existingAssessmentData,
                license: licenseAssessment
            };
            updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
        }

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
            sqlServerInstances
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
        name: `Microsoft SQL server license assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL server license assessment for ${resourceName}`,
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

    return licenseAssessment;
}

async function runLicenseAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string
) {
    logger.info('Run license assessment', { accountId, credentialsId, region, activeNodeInstanceId });
    const { items: [{ sqlServerInstances = [] } = {}] = [] } = await getHostAndSqlServerInfo(
        accountId,
        credentialsId,
        region,
        undefined,
        undefined,
        [activeNodeInstanceId]
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
}

export { calculateLicenseDrift, managedHostsLicenseAssessment };
