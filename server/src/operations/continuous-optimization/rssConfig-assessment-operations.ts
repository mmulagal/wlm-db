import { isEmpty } from 'lodash-es';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import { listResources, updateResourceMetaData } from '../../lib/database/db';
import { Metadata, RssConfigAssesment } from '../../utils/common-types';
import {
    AssessmentStatus,
    AwsWellArchitecturedPillars,
    NUMASTATIC,
    SEVERITY
} from '../../utils/continous-optimization-consts';
import getLogger from '../../utils/logger';
import { sqlResponseParsing } from '../../utils/utils';
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
    try {
        const [{ metadata = {} } = {}] = (await listResources(accountId, databaseHostId, credentialsId, region)) || [];
        const { assessment: { rssConfig } = {} } = metadata as unknown as Metadata;

        let rssConfigAssessment;
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
                rssConfig: rssConfigAssessment
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
            tcpOffloadState
        };
    } catch (error: any) {
        errorMessage = `Error while calculating rss config drift. ${error.message}`;
        logger.error({ errorMessage, error });
    }
    return { errorMessage };
}

async function managedHostsRssConfigAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    resourceName: string,
    parentJobId?: string
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
        name: `Microsoft SQL server Rss Config assessment for ${resourceName} in EC2 instance ${activeNodeInstanceId}`,
        description: `Microsoft SQL server Rss Config assessment for ${resourceName}`,
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
    const { adapters: rssConfigAdapters, vpuCount, tcpOffloadState } = parsedResponse;

    const recommendedReceiveQueues = vpuCount > 8 ? 8 : vpuCount;

    const rssAdapters = []; // Will contain adapters that are not optimized
    let rssConfigOptimizedStatus = AssessmentStatus.OPTIMIZED;
    for (const rssConfigAdapter of rssConfigAdapters) {
        const { adapterName, rssEnabled, rssProfile, baseProcessorNumber, numberOfReceiveQueues } = rssConfigAdapter;
        // Best Practices details here : https://jira.ngage.netapp.com/browse/DBS-3872
        if (
            !rssEnabled ||
            rssProfile !== NUMASTATIC ||
            baseProcessorNumber !== 2 ||
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

    if (rssAdapters.length > 0 || tcpOffloadState !== 'Disabled') {
        rssConfigOptimizedStatus = AssessmentStatus.NOT_OPTIMIZED;
    }
    let recommendedAdapterSettings;
    if (rssConfigOptimizedStatus === AssessmentStatus.NOT_OPTIMIZED) {
        recommendedAdapterSettings = {
            recommendedRssProfile: NUMASTATIC,
            recommendedBaseProcessorNumber: 2,
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
