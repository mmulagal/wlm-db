import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { listResources, updateResourceMetaData } from '../../lib/database/db';
import { Metadata, RssConfigAssesment } from '../../utils/common-types';
import {
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    NUMASTATIC,
    SEVERITY,
    ASSESSMENT_RESOURCE_TYPE
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import { sqlResponseParsing } from '../../utils/utils';
import { updateAsssementErrorInResourceMetadata } from '../../utils/cont-opt-utils';
import { callSsmExecution } from '../aws/ssm-operations';
import { GET_RSS_CONFIG_DETAILS } from '../workloads/mssql/continuous-optimization-scripts';
import { getActiveSqlNode } from '../workloads/mssql/mssql-operations';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { HttpErrorCodes } from '../../utils/consts';

const logger = getLogger();

async function calculateRssConfigDrift(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string
) {
    logger.info('Calculating RSS drift', { accountId, credentialsId, region, databaseHostId });
    let errorMessage = '';
    let metadata;
    let rssConfigAssessment;
    try {
        [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
    } catch (error) {
        errorMessage = `Error while calculating rss drift. ${error}`;
        logger.error({ errorMessage });
        return { errorMessage };
    }
    try {
        const { assessment: { rssConfig } = {} } = metadata as unknown as Metadata;
        if (!isEmpty(rssConfig)) {
            rssConfigAssessment = rssConfig as RssConfigAssesment;
        } else {
            const { node1InstanceId, node2InstanceId } = metadata as unknown as Metadata;
            const { activeNodeInstanceId } = await getActiveSqlNode(
                credentialsId,
                region,
                node1InstanceId,
                node2InstanceId
            );

            if (!activeNodeInstanceId) {
                logger.error('Active node instance id not found');
                throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Active node instance id not found');
            }

            rssConfigAssessment = await runRssConfigAssessment(accountId, credentialsId, region, activeNodeInstanceId);

            const existingAssessmentData = (metadata as unknown as Metadata).assessment;
            (metadata as unknown as Metadata).assessment = {
                ...existingAssessmentData,
                rssConfig: rssConfigAssessment,
                lastAssessedDate: new Date().getTime().toString()
            };
            updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
        }

        const { rssConfigFinding, rssAdapters, recommendedAdapterSettings, tcpOffloadState } = rssConfigAssessment;
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
            resourceType: ASSESSMENT_RESOURCE_TYPE.NETWORK_ADAPTER
        };
    } catch (error: any) {
        errorMessage = `Error while calculating rss config drift. ${error.message}`;
        logger.error({ errorMessage, error });
        const existingAssessmentData = (metadata as unknown as Metadata).assessment;
        const assessmentErrors = { ...existingAssessmentData?.errors, rssConfig: errorMessage };
        (metadata as unknown as Metadata).assessment = {
            ...existingAssessmentData,
            errors: assessmentErrors,
            lastAssessedDate: new Date().getTime().toString()
        };
        updateResourceMetaData(accountId, credentialsId, databaseHostId, metadata);
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
    databaseHostId?: string
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
        name: `Microsoft SQL server RSS Config assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL server RSS Config assessment for ${resourceName}`,
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
        rssConfigAssessment = await runRssConfigAssessment(accountId, credentialsId, region, activeNodeInstanceId);
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
        if (errorMessage) {
            await updateAsssementErrorInResourceMetadata(
                accountId,
                databaseHostId!,
                credentialsId,
                region,
                errorMessage,
                'rssConfig'
            );
        }
    }

    return rssConfigAssessment;
}

async function runRssConfigAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string
) {
    logger.info('Running RSS Config assessment', { accountId, credentialsId, region, activeNodeInstanceId });
    const ssmCommand = GET_RSS_CONFIG_DETAILS();
    const response = await callSsmExecution(
        credentialsId,
        region,
        [ssmCommand],
        activeNodeInstanceId,
        'Get RSS configuration details'
    );
    const parsedResponse = sqlResponseParsing(response);
    const { adapters: rssConfigAdapters, vcpuCount, tcpOffloadState } = parsedResponse;

    const recommendedReceiveQueues = vcpuCount > 8 ? 8 : vcpuCount;
    let isAtleastOneAdapterWithBaseProcessorNumber2 = false;
    let rssAdapters = []; // Will contain adapters that are not optimized
    let rssConfigOptimizedStatus = AssessmentStatus.OPTIMIZED;
    for (const rssConfigAdapter of rssConfigAdapters) {
        const { adapterName, rssEnabled, rssProfile, baseProcessorNumber, numberOfReceiveQueues } = rssConfigAdapter;
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
        tcpOffloadState
    };
}

export { calculateRssConfigDrift, runRssConfigAssessment, managedHostsRssConfigAssessment };
