import { isEmpty } from 'lodash-es';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { Metadata, ResourceAssessmentData, RssConfigAssesment } from '../../utils/common-types';
import {
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    NUMASTATIC,
    SEVERITY,
    ASSESSMENT_RESOURCE_TYPE,
    AssessmentCategories
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import { isDemo, sqlResponseParsing } from '../../utils/utils';
import { callSsmExecution } from '../aws/ssm-operations';
import { GET_RSS_CONFIG_DETAILS } from '../workloads/mssql/continuous-optimization-scripts';

import { registerJob, updateJobDetails } from '../database/job-operations';
import { GENERIC_ASSESSMENT_ERROR_MESSAGE } from '../../utils/consts';
import { updateDatabaseHostAssessmentData } from '../database/database-operations';

const logger = getLogger();

async function calculateRssConfigDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    metadata: Metadata,
    assessmentData: ResourceAssessmentData
) {
    logger.info('Calculating RSS drift', { accountId, credentialsId, region, databaseHostId });
    let errorMessage = '';
    let rssConfigAssessment;

    try {
        const { rssConfig, errors } = assessmentData;

        if (isEmpty(rssConfig)) {
            errorMessage = errors?.rssConfig
                ? errors?.rssConfig
                : GENERIC_ASSESSMENT_ERROR_MESSAGE(AssessmentCategories.RSS_CONFIG);
            logger.error({ errorMessage });
            return { errorMessage };
        }

        rssConfigAssessment = rssConfig as RssConfigAssesment;
        if (isDemo()) {
            rssConfigAssessment.rssAdapters = rssConfigAssessment?.rssAdapters?.filter(
                adapter => !(metadata as Metadata)?.isRssConfigOptimized?.includes(adapter.adapterName)
            );
            if (rssConfigAssessment?.rssAdapters?.length === 0) {
                rssConfigAssessment.rssConfigFinding = AssessmentStatus.OPTIMIZED;
            }
            rssConfigAssessment.totalObjectsInViolation = rssConfigAssessment.rssAdapters?.length;
        }
        const {
            rssConfigFinding,
            rssAdapters,
            recommendedAdapterSettings,
            tcpOffloadState,
            totalObjectsInViolation,
            totalObjectsAssessed
        } = rssConfigAssessment;
        const recommendationMessage =
            rssConfigFinding === AssessmentStatus.NOT_OPTIMIZED
                ? 'To enhance network performance and system efficiency for your SQL Server EC2 instance, we recommend optimizing your Receive Side Scaling (RSS) configuration. Proper RSS settings distribute network processing across multiple processors, reducing latency and improving application responsiveness. Adhering to best practices ensures efficient handling of network traffic, leading to better stability and reliability.'
                : 'When the Receive Side Scaling (RSS) configuration values meets the best practices, the instance is considered optimized';

        return {
            name: 'rss-config',
            status: rssConfigFinding,
            recommended: AssessmentStatus.OPTIMIZED,
            severity: SEVERITY.WARNING,
            recommendation: recommendationMessage,
            tags: [AwsWellArchitecturedPillars.COST_OPTIMIZATION],
            rssAdapters,
            recommendedAdapterSettings,
            tcpOffloadState,
            resourceType: ASSESSMENT_RESOURCE_TYPE.NETWORK_ADAPTER,
            totalObjectsInViolation,
            totalObjectsAssessed
        };
    } catch (error: any) {
        errorMessage = `Error while calculating rss config drift. ${error.message}`;
        logger.error({ errorMessage, error });
        const newAssessmentData = {
            ...assessmentData,
            errors: { ...assessmentData?.errors, rssConfig: errorMessage },
            lastAssessedDate: Date.now().toString()
        };
        await updateDatabaseHostAssessmentData(accountId, credentialsId, databaseHostId, newAssessmentData);
    }
    return { errorMessage };
}

async function managedHostsRssConfigAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    resourceName: string,
    parentJobId?: string,
    metadata?: Metadata
) {
    logger.info('Managed hosts rss config assessment', {
        accountId,
        credentialsId,
        region,
        activeNodeInstanceId,
        resourceName,
        parentJobId
    });

    const { id: rssConfigAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: `Microsoft SQL Server network adapters configuration assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL Server network adapters configuration assessment for ${resourceName}`,
        resourceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId
    });

    let rssConfigAssessment;
    let jobStatus;
    let errorMessage;
    try {
        rssConfigAssessment = await runRssConfigAssessment(
            accountId,
            credentialsId,
            region,
            activeNodeInstanceId,
            metadata
        );
    } catch (error) {
        errorMessage = `Error while performing rss config assessment. ${error}`;
        logger.error(errorMessage);

        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, rssConfigAssessmentJobId, {
            endTime: Date.now(),
            status: jobStatus || JOBSTATUS.COMPLETED,
            error: errorMessage
        });
    }

    return { rssConfigAssessment, errorMessage };
}

async function runRssConfigAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    metadata?: Metadata
) {
    logger.info('Running RSS Config assessment', { accountId, credentialsId, region, activeNodeInstanceId });
    try {
        const ssmCommand = GET_RSS_CONFIG_DETAILS();
        const response = await callSsmExecution(
            credentialsId,
            region,
            [ssmCommand],
            activeNodeInstanceId,
            'Get network adapters configuration details',
            accountId
        );
        const parsedResponse = sqlResponseParsing(response);
        const { adapters: rssConfigAdapters, vcpuCount, tcpOffloadState } = parsedResponse;

        const recommendedReceiveQueues = vcpuCount > 8 ? 8 : vcpuCount;
        let isAtleastOneAdapterWithBaseProcessorNumber2 = false;
        let rssAdapters = []; // Will contain adapters that are not optimized
        let rssConfigOptimizedStatus = AssessmentStatus.OPTIMIZED;
        for (const rssConfigAdapter of rssConfigAdapters) {
            const { adapterName, rssEnabled, rssProfile, baseProcessorNumber, numberOfReceiveQueues } =
                rssConfigAdapter;
            const recommendedBaseProcessorNumber = vcpuCount >= 4 ? 2 : baseProcessorNumber;
            if (baseProcessorNumber === 2) {
                isAtleastOneAdapterWithBaseProcessorNumber2 = true;
            }
            // Best Practices details here : https://jira.ngage.netapp.com/browse/DBS-3872
            if (
                !rssEnabled ||
                rssProfile !== NUMASTATIC ||
                baseProcessorNumber !== recommendedBaseProcessorNumber ||
                numberOfReceiveQueues !== recommendedReceiveQueues
            ) {
                rssAdapters.push({
                    adapterName,
                    rssEnabled,
                    rssProfile,
                    baseProcessorNumber,
                    numberOfReceiveQueues
                });
            }
        }

        const adaptersToRemove: string[] = [];
        if (
            vcpuCount >= 4 &&
            rssAdapters.length > 0 &&
            rssConfigAdapters.length > 1 &&
            isAtleastOneAdapterWithBaseProcessorNumber2
        ) {
            // In case of multiple adapters, if atleast one adapter has baseProcessorNumber as 2, then remove all other adapters from the unoptimized list if properties other than baseProcessorNumber are set to best practices as not all the adapters need not be having baseProcessorNumber as 2
            for (const adapter of rssAdapters) {
                const { rssEnabled, rssProfile, numberOfReceiveQueues, baseProcessorNumber, adapterName } = adapter;
                if (
                    rssEnabled &&
                    rssProfile === NUMASTATIC &&
                    numberOfReceiveQueues === recommendedReceiveQueues &&
                    baseProcessorNumber !== 2
                ) {
                    adaptersToRemove.push(adapterName);
                }
            }
        }

        rssAdapters = rssAdapters.filter(adapter => !adaptersToRemove.includes(adapter.adapterName));
        if (isDemo()) {
            rssAdapters = rssAdapters.filter(adapter => !metadata?.isRssConfigOptimized?.includes(adapter.adapterName));
        }

        if (rssAdapters.length > 0 || tcpOffloadState !== 'Disabled') {
            rssConfigOptimizedStatus = AssessmentStatus.NOT_OPTIMIZED;
        }
        let recommendedAdapterSettings;
        if (rssConfigOptimizedStatus === AssessmentStatus.NOT_OPTIMIZED) {
            recommendedAdapterSettings = {
                recommendedRssProfile: NUMASTATIC,
                recommendedBaseProcessorNumber: vcpuCount >= 4 ? 2 : 0,
                recommendedReceiveQueues
            };
        }

        return {
            rssConfigFinding: rssConfigOptimizedStatus,
            rssAdapters,
            recommendedAdapterSettings,
            tcpOffloadState,
            totalObjectsInViolation: rssAdapters?.length,
            totalObjectsAssessed: rssConfigAdapters?.length
        };
    } catch (error) {
        logger.error('Error while running RSS Config assessment', { error });
        throw error instanceof Error ? error : new Error(`${error}`);
    }
}

export { calculateRssConfigDrift, runRssConfigAssessment, managedHostsRssConfigAssessment };
