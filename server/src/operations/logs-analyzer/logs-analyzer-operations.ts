import { Type, Static } from '@fastify/type-provider-typebox';
import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import {
    DATABASE_TYPE,
    JOBSTATUS,
    JOBTYPE,
    logs_analysis_reports as LogsAnalysisReports,
    STORAGE_TYPE
} from '@prisma/client';
import ms from 'ms';
import { callSsmExecution } from '../aws/ssm-operations';
import { preSignedUrl } from '../../lib/aws/s3';
import { AuditStatus, HttpErrorCodes } from '../../utils/consts';

import { generateHash, getArtifactsRegionBucketName, sqlResponseParsing } from '../../utils/utils';
import {
    AVG_TOKEN_COUNT_PER_ERROR,
    BEDROCK_PRICE,
    LOGS_ANALYZER_BUNDLE_PATH,
    LOGS_ANALYZER_MODEL_IDS,
    LOGS_ANALYZER_PACKAGE_NAME,
    LOGS_ANALYZER_PACKAGE_VERSION,
    LOGS_COUNT_TO_CONSIDER,
    MODEL_AVAILABILITY_STATUS,
    MSSQL_ERROR_PATTERN
} from '../../utils/logs-analyzer/logs-analyzer-consts';
import { listDatabaseInstances } from '../../lib/database/db';
import { DatabaseInstance, DatabaseInstancesIncludingResource } from '../../utils/common-types';
import getLogger from '../../utils/logger';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { getActiveNodeAndInstanceDetails } from '../workloads/mssql/mssql-operations';
import { sqlQueryExecutionWithAuth } from '../workloads/mssql/ssm-script-utils';
import { getModelAvailability } from '../../lib/aws/bedrock';
import { getCloudWatchLogs } from '../aws/cloud-watch-logs-operations';
import { parseConcatenatedJSON } from '../../utils/logs-analyzer/logs-analyzer-utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import {
    InferenceConfigType,
    RemediationRecommendationObject,
    RemediationRecommendationObjectType
} from '../../routes/types/logs-analyzer.types';
import getInferenceProfileFromModelId from '../aws/bedrock-operations';
import {
    getLinuxBedrockAvailabilityCheckScript,
    getLinuxPrepareScript,
    getWindowsBedrockAvailabilityCheckScript,
    getWindowsPrepareScript
} from './remote-script-functions';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../workloads/pgsql/const';
import { createLogsAnalysisReports, listLogsAnalysisReports } from '../../lib/database/logs-analysis-reports';

const { getPreSignedUrl } = preSignedUrl;

const logger = getLogger();

const DataObject = Type.Object({
    conversationFilePath: Type.String(),
    remediationFilePath: Type.String(),
    statusFilePath: Type.String(),
    remediationRecommendation: Type.Array(RemediationRecommendationObject)
});

const LogsAnalysisReportObject = Type.Object({
    status: Type.String(),
    message: Type.String(),
    data: DataObject
});
type LogsAnalysisReportObjectType = Static<typeof LogsAnalysisReportObject>;

async function findFirstAvailableModel(accountId: string, credentialsId: string, region: string, modelIds: string[]) {
    logger.debug('Finding first available model:', {
        accountId,
        credentialsId,
        region,
        modelIds
    });

    for await (const modelId of modelIds) {
        try {
            const response = await getModelAvailability(accountId, credentialsId, region, modelId);
            if (!isEmpty(response)) {
                return { modelId, response };
            }
        } catch (error) {
            logger.error(`Failed to retrieve AWS Bedrock model ${modelId} not available. Error: ${error}`);
        }
    }
}

async function checkLogAnalyzerPreRequisites(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    databaseType: string
) {
    logger.info(`Checking prerequisites for logs analysis with credentialsId: ${credentialsId}, region: ${region}`, {
        accountId,
        activeNodeInstanceId,
        databaseType
    });

    const {
        modelId,
        response,
        response: { agreementAvailability, entitlementAvailability } = {}
    } = (await findFirstAvailableModel(accountId, credentialsId, region, LOGS_ANALYZER_MODEL_IDS)) || {};

    if (!modelId || (response && isEmpty(response))) {
        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            'Unable to continue with logs analysis, the AWS Bedrock model cannot be used in this region.'
        );
    }

    const isSupported =
        agreementAvailability?.status === MODEL_AVAILABILITY_STATUS.AVAILABLE &&
        entitlementAvailability === MODEL_AVAILABILITY_STATUS.AVAILABLE;
    if (!isSupported) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `Unable to continue with logs analysis, the AWS Bedrock model ${JSON.stringify(
                LOGS_ANALYZER_MODEL_IDS
            )} is not enabled for your account in this region.`
        );
    }

    const inferenceProfileArn = await getInferenceProfileFromModelId(accountId, credentialsId, region, modelId);

    try {
        const bedrockCheckScript =
            databaseType === DATABASE_TYPE.mssql
                ? getWindowsBedrockAvailabilityCheckScript(region, inferenceProfileArn)
                : getLinuxBedrockAvailabilityCheckScript(region, inferenceProfileArn);
        const bedrockAvailabilityCheckResponse = await callSsmExecution(
            credentialsId,
            region,
            [bedrockCheckScript!],
            activeNodeInstanceId,
            'Check Bedrock Availability',
            accountId,
            false,
            '600',
            false, // Cloud watch logs disabled
            databaseType !== DATABASE_TYPE.mssql ? SSM_RUN_SHELL_SCRIPT_DOC : undefined,
            databaseType !== DATABASE_TYPE.mssql ? SSM_RUN_SHELL_SCRIPT_DOC_VERSION : undefined
        );

        const [jsonResponse] = parseConcatenatedJSON(bedrockAvailabilityCheckResponse);
        if ((jsonResponse as { success?: boolean })?.success === false) {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                `Unable to continue with logs analysis, the AWS Bedrock model cannot be used. ${
                    (jsonResponse as any)?.error ?? ''
                }`
            );
        }
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Unable to continue with logs analysis ${error}`);
    }

    return { inferenceProfileArn, modelId };
}

async function updateLogsAnalysisReportsInDB(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    databaseInstanceId: string,
    jobId: string,
    databaseType: string,
    jsonSsmLogsResponse: object,
    startTime?: Date,
    endTime?: Date
) {
    logger.info('Updating logs analysis reports in DB:', {
        accountId,
        credentialsId,
        resourceId,
        databaseInstanceId,
        jobId
    });

    await createLogsAnalysisReports([
        {
            credentials_id: credentialsId,
            resource_id: resourceId,
            database_instance_id: databaseInstanceId,
            job_id: jobId,
            account_id: accountId,
            database_type: databaseType as DATABASE_TYPE,
            logs_analysis_data: jsonSsmLogsResponse,
            start_time: startTime,
            end_time: endTime,
            version: LOGS_ANALYZER_PACKAGE_VERSION,
            creation_time: new Date()
        }
    ]);
}

async function getLastAnalysisData(accountId: string, databaseHostId: string, databaseInstanceId: string) {
    logger.info('Getting last logs analysis data:', {
        accountId,
        databaseHostId,
        databaseInstanceId
    });
    try {
        const [report] = await listLogsAnalysisReports(
            accountId,
            databaseHostId,
            databaseInstanceId,
            undefined,
            undefined,
            'creation_time',
            'desc',
            1
        );
        return report;
    } catch (error) {
        logger.error('Error fetching last logs analysis data:', error);
    }
}

async function handleLogsAnalysis(
    accountId: string,
    credentialsId: string,
    region: string,
    managedInstance: DatabaseInstancesIncludingResource,
    jobId: string,
    logsCountToConsider: number = LOGS_COUNT_TO_CONSIDER,
    logsAnalyzerFromTimestamp: number = 1,
    inferenceConfig?: InferenceConfigType,
    logsAnalyzerS3SignedUrl?: string,
    logLevel?: string,
    logsWindowDuration?: number
) {
    logger.info(
        `Handling logs analysis for accountId: ${accountId}, credentialsId: ${credentialsId}, region: ${region}`,
        {
            logsAnalyzerS3SignedUrl,
            inferenceConfig,
            logsCountToConsider,
            logsAnalyzerFromTimestamp,
            logLevel,
            logsWindowDuration,
            jobId
        }
    );
    let jobStatus;
    let jobError;
    try {
        const databaseInstanceDetails = {
            ...managedInstance,
            storage_type: STORAGE_TYPE.FSXN,
            isManaged: true
        };

        const {
            database_type: dbType,
            database_instance_id: databaseInstanceId,
            resource_id: databaseHostId
        } = managedInstance;
        const databaseType = dbType?.toLowerCase();
        const { nodeId: activeNodeInstanceId, matchingInstance } = await getActiveNodeAndInstanceDetails(
            accountId,
            credentialsId,
            region,
            managedInstance.resource,
            databaseInstanceDetails as unknown as DatabaseInstance
        );

        const { inferenceProfileArn } = await checkLogAnalyzerPreRequisites(
            accountId,
            credentialsId,
            region,
            activeNodeInstanceId,
            databaseType
        );
        if (!inferenceProfileArn) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Inference profile not found');
        }
        const s3SignedUrl =
            logsAnalyzerS3SignedUrl ||
            (await getPreSignedUrl(region, getArtifactsRegionBucketName(region), LOGS_ANALYZER_BUNDLE_PATH));

        const logsPathQuery =
            'SET NOCOUNT ON; SELECT path FROM sys.dm_os_server_diagnostics_log_configurations FOR JSON PATH';
        const { sqlAuthEnabled, instanceName: databaseInstanceName } = matchingInstance;
        const logsAnalysisSsmCommand = sqlQueryExecutionWithAuth([databaseInstanceName], logsPathQuery, sqlAuthEnabled);
        const logsPathResponse = await callSsmExecution(
            credentialsId,
            region,
            [logsAnalysisSsmCommand],
            activeNodeInstanceId,
            'Fetch Logs Path for sql server instance'
        );
        const parsedResponse = logsPathResponse ? sqlResponseParsing(logsPathResponse) : {};
        const [{ path: logsPath } = {}] = parsedResponse?.[databaseInstanceName] || [];
        if (!logsPath) {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                `Could not fetch logs path for the database instance ${databaseInstanceName} on the remote machine.`
            );
        }

        logsAnalyzerFromTimestamp = await getTimestampToProcessLogs(
            accountId,
            databaseHostId,
            databaseInstanceId,
            logsAnalyzerFromTimestamp
        );

        const logsAnalyserScriptCommand =
            databaseType === DATABASE_TYPE.mssql
                ? getWindowsPrepareScript({
                      s3SignedUrl,
                      packageName: LOGS_ANALYZER_PACKAGE_NAME,
                      logsPath,
                      sqlAuthEnabled,
                      databaseInstanceName,
                      version: LOGS_ANALYZER_PACKAGE_VERSION,
                      instanceId: activeNodeInstanceId,
                      region,
                      logsCountToConsider,
                      logsAnalyzerFromTimestamp,
                      inferenceProfileArn,
                      jobId,
                      inferenceConfig,
                      logLevel,
                      logsWindowDuration
                  })
                : getLinuxPrepareScript({
                      s3SignedUrl,
                      packageName: LOGS_ANALYZER_PACKAGE_NAME,
                      logsPath,
                      version: LOGS_ANALYZER_PACKAGE_VERSION,
                      instanceId: activeNodeInstanceId,
                      region,
                      inferenceProfileArn,
                      jobId,
                      inferenceConfig,
                      logLevel
                  });

        const logsAnalysisResponse = await callSsmExecution(
            credentialsId,
            region,
            [logsAnalyserScriptCommand],
            activeNodeInstanceId,
            'Trigger Logs Analysis',
            accountId,
            false,
            '600',
            true // Cloud watch logs enabled
        );

        const parsedAnalysisResponse = logsAnalysisResponse ? sqlResponseParsing(logsAnalysisResponse) : {};
        if (parsedAnalysisResponse?.error || parsedAnalysisResponse?.success === false) {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                `Could not complete logs analysis on the remote machine. ${
                    parsedAnalysisResponse?.error ? parsedAnalysisResponse.error : ''
                }`
            );
        }

        const logGroupName = 'netapp/wlmdb/ssm-response';
        const logStreamName = `${activeNodeInstanceId}-logs-analyzer/${jobId}/aws-runPowerShellScript/stdout`;
        const [ssmLogsResponse] = await getCloudWatchLogs(credentialsId, region, logGroupName, logStreamName);
        const jsonSsmLogsResponse = parseConcatenatedJSON(ssmLogsResponse);

        logger.info('Logs analysis completed successfully for jobId:', jobId);
        logger.debug(`Logs analysis response: ${JSON.stringify(jsonSsmLogsResponse)}`);

        const [{ data: { startTime, endTime } = {} } = {}] =
            (jsonSsmLogsResponse as unknown as [{ data: { startTime: number; endTime: number } }]) || [];

        await updateLogsAnalysisReportsInDB(
            accountId,
            credentialsId,
            databaseHostId,
            databaseInstanceId,
            jobId,
            databaseType,
            jsonSsmLogsResponse,
            startTime ? new Date(startTime) : undefined,
            endTime ? new Date(endTime) : undefined
        );
        await updateLongRunningAuditGroup(AuditStatus.SUCCESS, 'Logs analysis completed successfully');
        await updateJobDetails(accountId, jobId, {
            endTime: Date.now(),
            status: JOBSTATUS.COMPLETED
        });
        return jsonSsmLogsResponse;
    } catch (error) {
        const errorMessage = `Error executing logs analysis: ${error}`;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
        logger.error(errorMessage);
        jobStatus = JOBSTATUS.FAILED;
        jobError = errorMessage;
    } finally {
        await updateJobDetails(accountId, jobId, {
            endTime: Date.now(),
            status: jobStatus || JOBSTATUS.COMPLETED,
            error: jobError
        });
    }
}

async function getTimestampToProcessLogs(
    accountId: string,
    databaseHostId: string,
    databaseInstanceId: string,
    logsAnalyzerFromTimestamp: number
) {
    logger.info('Getting timestamp to process logs:', {
        accountId,
        databaseHostId,
        databaseInstanceId,
        logsAnalyzerFromTimestamp
    });

    const report = await getLastAnalysisData(accountId, databaseHostId, databaseInstanceId);

    let timestampLastLogProcessed = Date.now() - ms('24h');
    if (logsAnalyzerFromTimestamp !== 1) {
        // If logsAnalyzerFromTimestamp is not 1 (1 is the default value indicating beginning of time), there is a user input passed down, use the provided timestamp
        logger.info('Using provided logsAnalyzerFromTimestamp:', logsAnalyzerFromTimestamp);
        timestampLastLogProcessed = logsAnalyzerFromTimestamp;
    } else if (report && !isEmpty(report)) {
        // If report exists, use the end time of the last report
        logger.debug('Using end time from the last logs analysis report');
        const { end_time: endTime } = report;
        timestampLastLogProcessed = endTime ? endTime.getTime() : timestampLastLogProcessed;
    }
    return timestampLastLogProcessed;
}

async function triggerLogsAnalysis(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    logsCountToConsider?: number,
    logsAnalyzerFromTimestamp?: number,
    inferenceConfig?: InferenceConfigType,
    logsAnalyzerS3SignedUrl?: string,
    logLevel?: string,
    logsWindowDuration?: number
) {
    logger.info('Triggering logs analysis:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        logsCountToConsider,
        logsAnalyzerFromTimestamp,
        inferenceConfig,
        logsAnalyzerS3SignedUrl,
        logLevel,
        logsWindowDuration
    });
    const [managedInstance] = (await listDatabaseInstances(accountId, {
        credentialsId,
        region,
        resourceId: databaseHostId,
        sqlInstanceId: databaseInstanceId
    })) as DatabaseInstancesIncludingResource[];

    if (isEmpty(managedInstance)) {
        const errorMessage = `No managed database instance by account ${accountId}, credentials ${credentialsId}, database host ${databaseHostId}, database instance ${databaseInstanceId} found.`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const {
        resource: { resource_name: resourceName },
        database_instance_name: instanceName
    } = managedInstance;

    let jobsStatus: string = JOBSTATUS.IN_PROGRESS;
    let jobId: string;
    try {
        const savedInstanceName = `${resourceName}\\${instanceName}`;
        const jobName = `Logs analysis for ${savedInstanceName}`;
        const jobDescription = `${jobName}`;
        ({ id: jobId } = await registerJob(accountId, credentialsId, region, {
            name: jobName,
            description: jobDescription,
            resourceName: savedInstanceName!,
            initiator: 'USER',
            startTime: Date.now(),
            status: jobsStatus,
            type: JOBTYPE.LOGS_ANALYSIS
        }));
        handleLogsAnalysis(
            accountId,
            credentialsId,
            region,
            managedInstance,
            jobId,
            logsCountToConsider,
            logsAnalyzerFromTimestamp,
            inferenceConfig,
            logsAnalyzerS3SignedUrl,
            logLevel,
            logsWindowDuration
        );
        return { jobId };
    } catch (error) {
        const errorMessage = `Error triggering logs analysis: ${error}`;
        logger.error(errorMessage);
        jobsStatus = JOBSTATUS.FAILED;
        updateLongRunningAuditGroup(AuditStatus.FAILED, errorMessage);
        if (error instanceof Error) {
            throw error;
        }
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function getLogsAnalysisReport(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    jobId?: string,
    reportId?: string
) {
    logger.info('Getting logs analysis report:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        jobId,
        reportId
    });

    const reports = await listLogsAnalysisReports(accountId, databaseHostId, databaseInstanceId, jobId, reportId);

    if (reports.length === 0) {
        const errorMessage = `No logs analysis report found for account ${accountId}, credentials ${credentialsId}, database host ${databaseHostId}, database instance ${databaseInstanceId}`;
        logger.error(errorMessage);
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const aggregatedReport = aggregateErrorCountAcrossReports(reports, accountId, jobId);

    if (aggregatedReport && aggregatedReport.length > 0) {
        return { remediationRecommendation: aggregatedReport };
    }
    return { remediationRecommendation: [] as RemediationRecommendationObjectType[] };
}

async function listLogsAnalysisReportsIdentifiers(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    pageSize: number = 100
) {
    logger.info('Listing logs analysis report identifiers:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        pageSize
    });

    const response = await listLogsAnalysisReports(
        accountId,
        databaseHostId,
        databaseInstanceId,
        undefined,
        undefined,
        'creation_time',
        'desc',
        pageSize,
        undefined,
        {
            id: true,
            creation_time: true
        }
    );

    if (response && response.length > 0) {
        const reports = response.map(({ id, creation_time: creationTime }) => ({
            id,
            creationTime: creationTime.getTime()
        }));

        return {
            reports
        };
    }

    const errorMessage = `No logs analysis reports found for account ${accountId}, credentials ${credentialsId}, database host ${databaseHostId}, database instance ${databaseInstanceId}`;
    logger.error(errorMessage);
    throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
}

function aggregateErrorCountAcrossReports(reports: LogsAnalysisReports[], accountId: string, jobId?: string) {
    // this function aggregates only the error count across all logs analysis reports/ token usage is not aggregated, it is not needed as of the initial implementation
    logger.info('Aggregating data across logs analysis reports:', { accountId, jobId, reportsCount: reports.length });

    const aggregatedErrorMap = new Map<string, any>();

    const logsAnalysisReports = reports.flatMap(
        report => (report?.logs_analysis_data as LogsAnalysisReportObjectType[]) || []
    );

    const allRecommendations = logsAnalysisReports.flatMap(analysisResult => {
        if (analysisResult?.status === 'success' && analysisResult?.data) {
            return (
                analysisResult.data.remediationRecommendation?.map((item: RemediationRecommendationObjectType) => ({
                    ...item,
                    additionalInfo: Array.isArray(item.additionalInfo)
                        ? item.additionalInfo.map(({ query, result, error }) => ({
                              query,
                              result: typeof result === 'object' ? JSON.stringify(result) : result,
                              error
                          }))
                        : []
                })) || []
            );
        }
        logger.warn(`Skipping analysis result with status: ${analysisResult?.status}`, {
            message: analysisResult?.message,
            accountId,
            jobId
        });
        return [];
    });

    for (const item of allRecommendations) {
        const messageKey = getOrGenerateMessageKey(item);

        if (messageKey == null) {
            logger.warn('Skipping item due to null or undefined messageKey', { item });
            return;
        }

        const existingItem = aggregatedErrorMap.get(messageKey);
        if (!existingItem) {
            aggregatedErrorMap.set(messageKey, {
                ...item,
                count: item.count
            });
        } else {
            existingItem.count += item.count;
            if (item.lastOccurrence && item.lastOccurrence > existingItem.lastOccurrence) {
                existingItem.lastOccurrence = item.lastOccurrence;
            }
            if (item.firstOccurrence && item.firstOccurrence < existingItem.firstOccurrence) {
                existingItem.firstOccurrence = item.firstOccurrence;
            }
            if (item.hourlyErrorCounts) {
                const hourlyMap = new Map<number, number>();

                (existingItem.hourlyErrorCounts || []).forEach(({ hour, count }: { hour: number; count: number }) => {
                    hourlyMap.set(hour, count);
                });

                item.hourlyErrorCounts.forEach(({ hour, count }) => {
                    const existingCount = hourlyMap.get(hour) || 0;
                    hourlyMap.set(hour, existingCount + count);
                });

                existingItem.hourlyErrorCounts = Array.from(hourlyMap.entries())
                    .map(([hour, count]) => ({ hour, count }))
                    .sort((a, b) => a.hour - b.hour);
            }
        }
    }

    return Array.from(aggregatedErrorMap.values());
}

function getOrGenerateMessageKey(item: RemediationRecommendationObjectType): string | undefined {
    // Return existing key if available
    if (item.uniqueErrorKey) {
        return item.uniqueErrorKey;
    }

    // Generate key from error pattern
    const match = MSSQL_ERROR_PATTERN.exec(item.error);
    if (match?.groups?.errorCode || match?.groups?.message) {
        const keySource = (match.groups.errorCode || match.groups.message)?.replaceAll(/[^a-zA-Z0-9]/g, '_');
        return generateHash(keySource).toLowerCase();
    }
}

async function calculateLogsAnalysisPrice(region: string) {
    logger.info('Calculating logs analysis price:', { region });
    // Placeholder for pricing calculation logic
    // This function should ideally interact with AWS Pricing API to get the cost based on region and logs count, but https://github.com/aws/aws-cli/issues/9567 SDK does not return cost of output tokens
    /* {
        ServiceCode: "AmazonBedrock",
        Filters: [
            {
                Type: 'TERM_MATCH',
                Field: 'region',
                Value: "us-east-1"
            },
            {
                Type: 'TERM_MATCH',
                Field: 'provider',
                Value: 'Anthropic' // Example instance type, adjust as needed
            }
        ],
    }; */
    // As of June 25, the pricing information for Bedrock is static across regions where Bedrock is available in https://aws.amazon.com/bedrock/pricing/
    const costPerError =
        (AVG_TOKEN_COUNT_PER_ERROR.INPUT / 1000) * BEDROCK_PRICE.INPUT_1K_TOKENS +
        (AVG_TOKEN_COUNT_PER_ERROR.OUTPUT / 1000) * BEDROCK_PRICE.OUTPUT_1K_TOKENS;
    return {
        costPerError
    };
}
export {
    triggerLogsAnalysis,
    handleLogsAnalysis,
    getLogsAnalysisReport,
    listLogsAnalysisReportsIdentifiers,
    calculateLogsAnalysisPrice
};
