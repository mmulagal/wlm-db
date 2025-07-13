import { CpuVendorArchitecture } from '@aws-sdk/client-compute-optimizer';
import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { getEC2InstanceRecommendations } from '../../lib/aws/compute-optimizer';
import { checkComputeOptimizerEnrollmentStatus } from '../recommendation-operations';

import getLogger from '../../utils/logger';
import { translateFindingReasonCode } from '../aws/compute-optimizer-operations';
import { getEc2Arn } from '../../utils/utils';
import {
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories,
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    SEVERITY
} from '../../utils/continous-optimization-consts';
import { ComputeAssessment, ResourceAssessmentData } from '../../utils/common-types';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { getMatchingAssessmentStatus } from './assessment-utils';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../utils/consts';
import { updateDatabaseHostAssessmentData } from '../database/database-operations';

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

function calculateComputeDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    assessmentData: ResourceAssessmentData
) {
    logger.info('Calculating compute drift', { accountId, credentialsId, region, databaseHostId, databaseInstanceId });

    let errorMessage = '';

    try {
        const { compute, errors } = assessmentData;

        if (isEmpty(compute)) {
            errorMessage = errors?.compute
                ? errors?.compute
                : GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.COMPUTE);

            logger.error({ errorMessage });
            return { errorMessage };
        }

        const { finding, findingReasonCodes, currentInstanceType, recommendationOptions } =
            compute as ComputeAssessment;

        let recommendationMessage = 'Analyzing instance for rightsizing. Check later for recommendations.';
        let findingValue = AssessmentStatus.ANALYZING;
        let objectsInViolation: string[] = [];

        if (finding) {
            findingValue = getMatchingAssessmentStatus(finding);
            const underProvisionedRecommendationMessage = `Your current instance ${currentInstanceType} is under-provisioned. We recommend upgrading it to meet your workload demands. This will provide additional CPU, memory, and I/O capacity, ensuring better performance for your SQL Server DB.`;
            const overProvisionedRecommendationMessage = `Your current instance ${currentInstanceType} is over-provisioned. We recommend downgrading it to reduce costs. This instance type will still meet the performance needs of your SQL Server DB while saving on unnecessary expenses.`;

            if (findingValue.includes('provisioned')) {
                // under_provisioned or over_provisioned
                const genericRecommendationMessage =
                    'Click Fix to view cost comparison between current and recommended instance types to understand potential savings.';
                recommendationMessage =
                    findingValue === AssessmentStatus.UNDER_PROVISIONED
                        ? underProvisionedRecommendationMessage
                        : overProvisionedRecommendationMessage;
                recommendationMessage += ` ${genericRecommendationMessage}`;
            } else {
                recommendationMessage = 'Optimized instance for your workload.';
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
        const newAssessmentData = {
            ...assessmentData,
            errors: { ...assessmentData?.errors, compute: errorMessage },
            lastAssessedDate: Date.now().toString()
        };
        updateDatabaseHostAssessmentData(accountId, credentialsId, databaseHostId, newAssessmentData);
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
        name: `Microsoft SQL Server compute assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL Server compute assessment for ${resourceName}`,
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
    return { computeAssessment, errorMessage };
}

export { calculateComputeDrift, managedHostsComputeAssessment };
