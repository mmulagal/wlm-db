import { CpuVendorArchitecture } from '@aws-sdk/client-compute-optimizer';
import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { getEC2InstanceRecommendations } from '../../lib/aws/compute-optimizer';
import { listResources, updateResourceMetaData } from '../../lib/database/db';
import { checkComputeOptimizerEnrollmentStatus } from '../recommendation-operations';

import getLogger from '../../utils/logger';
import { translateFindingReasonCode } from '../aws/compute-optimizer-operations';
import { getEc2Arn } from '../../utils/utils';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../../utils/continous-optimization-consts';
import { ComputeAssessment, Metadata } from '../../utils/common-types';
import { getInstanceDetails } from '../database-hosts-operations';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { getMatchingAssessmentStatus } from './assessment-utils';

const logger = getLogger();

async function runComputeAssessment(
    awsAccountId: string,
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    resourceName: string
) {
    logger.info('Running compute assessment', {
        awsAccountId,
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        resourceName
    });
    let errorMessage = '';
    try {
        await checkComputeOptimizerEnrollmentStatus(accountId, credentialsId, region);

        const resourceArn = getEc2Arn(awsAccountId, region, ec2InstanceId);
        const computeOptimizerInstanceRecommendations = await getEC2InstanceRecommendations(
            region,
            credentialsId,
            accountId,
            {
                instanceArns: [resourceArn],
                recommendationPreferences: {
                    cpuVendorArchitectures: [CpuVendorArchitecture.CURRENT] // CURRENT to view recommendations that are based on the same CPU vendor and architecture as the current instance.
                }
            }
        );
        const {
            instanceRecommendations: [
                {
                    currentInstanceType = '',
                    finding = '',
                    findingReasonCodes = [],
                    recommendationOptions: coRecOptions = []
                } = {}
            ] = []
        } = computeOptimizerInstanceRecommendations || {};

        const filteredRecommendationOptions = coRecOptions
            ?.filter(
                ({ instanceType, platformDifferences }) =>
                    platformDifferences?.length === 0 &&
                    /^[mcr]/.test(instanceType!) &&
                    instanceType !== currentInstanceType
            )
            ?.map(
                ({ instanceType, rank, savingsOpportunity, platformDifferences }) => ({
                    instanceType,
                    rank,
                    savingsOpportunity,
                    platformDifferences
                }) // return only such recommandation options that has no platform difference. Migration to different platform cannot be supported programatically from our application.
            );

        return {
            currentInstanceType,
            finding,
            findingReasonCodes,
            recommendationOptions: filteredRecommendationOptions
        } as ComputeAssessment;
    } catch (error: any) {
        errorMessage = `Failed to get compute optimizer recommendation options for the selected database host during Continuous Optimization. ${error.message}`;
        logger.error({ errorMessage, error });
        throw Error(errorMessage);
    }
}

async function calculateComputeDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Calculating compute drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });

    let errorMessage = '';
    let metadata;

    try {
        [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
    } catch (error) {
        errorMessage = `Error while calculating host os patch drift. ${error}`;
        logger.error({ errorMessage });
        return { errorMessage };
    }

    try {
        let finding;
        let findingReasonCodes;
        let currentInstanceType;
        let recommendationOptions;
        const { assessment: { compute } = {} } = metadata as unknown as Metadata;

        if (!isEmpty(compute)) {
            ({ finding, findingReasonCodes, currentInstanceType, recommendationOptions } =
                compute as ComputeAssessment);
        } else {
            const { activeNodeInstanceId, cloudProviderAccountId, resourceName } = await getInstanceDetails(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                databaseInstanceId
            );
            ({ finding, findingReasonCodes, currentInstanceType, recommendationOptions } =
                (await runComputeAssessment(
                    cloudProviderAccountId!,
                    accountId,
                    credentialsId,
                    region,
                    activeNodeInstanceId,
                    resourceName!
                )) || {});
            const existingAssessmentData = (metadata as unknown as Metadata).assessment;
            (metadata as unknown as Metadata).assessment = {
                ...existingAssessmentData,
                compute: { finding, findingReasonCodes, currentInstanceType, recommendationOptions },
                lastAssessedDate: new Date().getTime().toString()
            };
            updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
        }

        let recommendationMessage =
            'Your current instance is being analyzed for rightsizing. Please check back later for recommendations.';
        let findingValue = AssessmentStatus.ANALYZING;
        let objectsInViolation: string[] = [];

        if (finding) {
            findingValue = getMatchingAssessmentStatus(finding);
            const underProvisionedRecommendationMessage = `Your current instance ${currentInstanceType} is under-provisioned. We recommend upgrading it to meet your workload demands. This will provide additional CPU, memory, and I/O capacity, ensuring better performance for your SQL Server DB.`;
            const overProvisionedRecommendationMessage = `Your current instance ${currentInstanceType} is over-provisioned. We recommend downgrading it to reduce costs. This instance type will still meet the performance needs of your SQL Server DB while saving on unnecessary expenses.`;

            if (findingValue.includes('provisioned')) {
                // under_provisioned or over_provisioned
                const genericRecommendationMessage =
                    'Click Optimize to view cost comparison between current and recommended instance types to understand potential savings.';
                recommendationMessage =
                    findingValue === AssessmentStatus.UNDER_PROVISIONED
                        ? underProvisionedRecommendationMessage
                        : overProvisionedRecommendationMessage;
                recommendationMessage += ` ${genericRecommendationMessage}`;
            } else {
                recommendationMessage = 'Your current instance is optimized for your workload.';
            }

            objectsInViolation = findingReasonCodes?.map(code => translateFindingReasonCode(code));
        }

        return {
            name: 'compute-rightsizing',
            status: findingValue,
            recommended: AssessmentStatus.OPTIMIZED,
            severity: SEVERITY.WARNING,
            recommendation: recommendationMessage,
            objectsInViolation,
            tags: [AwsWellArchitecturedPillars.COST_OPTIMIZATION, AwsWellArchitecturedPillars.PERFORMANCE_EFFICIENCY],
            recommendationOptions,
            resourceType: ASSESSMENT_RESOURCE_TYPE.INSTANCE
        };
    } catch (error: any) {
        errorMessage = `Error while calculating compute drift. ${error.message}`;
        logger.error({ errorMessage, error });
        const existingAssessmentData = (metadata as unknown as Metadata).assessment;
        const assessmentErrors = { ...existingAssessmentData?.errors, compute: errorMessage };
        (metadata as unknown as Metadata).assessment = {
            ...existingAssessmentData,
            errors: assessmentErrors,
            lastAssessedDate: new Date().getTime().toString()
        };
        updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
    }
    return { errorMessage };
}

async function managedHostsComputeAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    awsAccountId: string,
    activeNodeInstanceId: string,
    resourceName: string,
    parentJobId: string
) {
    const { id: computeAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Microsoft SQL server compute assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL server compute assessment for ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let computeAssessment;
    let jobStatus;
    let errorMessage;
    try {
        computeAssessment =
            (await runComputeAssessment(
                awsAccountId!,
                accountId,
                credentialsId,
                region,
                activeNodeInstanceId,
                resourceName!
            )) || {};
    } catch (error) {
        errorMessage = `Error while performing compute assessment. ${error}`;
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, computeAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus || JOBSTATUS.COMPLETED,
            error: errorMessage
        });
    }
    return computeAssessment;
}

export { calculateComputeDrift, managedHostsComputeAssessment };
