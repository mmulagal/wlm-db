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
    jsonSsmLogsResponse: object
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
            version: LOGS_ANALYZER_PACKAGE_VERSION,
            creation_time: new Date()
        }
    ]);
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
    logsAnalyzerS3SignedUrl?: string
) {
    logger.info(
        `Handling logs analysis for accountId: ${accountId}, credentialsId: ${credentialsId}, region: ${region}`,
        { logsAnalyzerS3SignedUrl, inferenceConfig, logsCountToConsider, logsAnalyzerFromTimestamp, jobId }
    );
    let jobStatus;
    let jobError;
    try {
        const databaseInstanceDetails = {
            ...managedInstance,
            storage_type: STORAGE_TYPE.FSXN,
            isManaged: true
        };

        const { database_type: dbType } = managedInstance;
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
                      inferenceConfig
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
                      inferenceConfig
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

        logger.info('Logs analysis compleeted successfully for jobId:', jobId);
        logger.debug(`Logs analysis response: ${JSON.stringify(jsonSsmLogsResponse)}`);

        await updateLogsAnalysisReportsInDB(
            accountId,
            credentialsId,
            managedInstance.resource_id,
            managedInstance.database_instance_id,
            jobId,
            databaseType,
            jsonSsmLogsResponse
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

async function triggerLogsAnalysis(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    logsCountToConsider?: number,
    logsAnalyzerFromTimestamp?: number,
    inferenceConfig?: InferenceConfigType,
    logsAnalyzerS3SignedUrl?: string
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
        logsAnalyzerS3SignedUrl
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
            logsAnalyzerS3SignedUrl
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
    jobId?: string
) {
    logger.info('Getting logs analysis report:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        jobId
    });

    const reports = await listLogsAnalysisReports(accountId, databaseHostId, databaseInstanceId, jobId);

    const aggregatedErrorMap = new Map<string, any>();
    aggregateErrorCountAcrossReports(reports, aggregatedErrorMap, accountId, jobId);

    const newReport = Array.from(aggregatedErrorMap.values());
    if (newReport && newReport.length > 0) {
        return { remediationRecommendation: newReport };
    }
    const errorMessage = `No logs analysis report found for account ${accountId}, credentials ${credentialsId}, database host ${databaseHostId}, database instance ${databaseInstanceId}`;
    logger.error(errorMessage);
    throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
}

function aggregateErrorCountAcrossReports(
    reports: LogsAnalysisReports[],
    aggregatedErrorMap: Map<string, any>,
    accountId: string,
    jobId?: string
) {
    // this function aggregates only the error count across all logs analysis reports/ token usage is not aggregated, it is not needed as of the initial implementation
    logger.info('Aggregating data across logs analysis reports:', { accountId, jobId, reportsCount: reports.length });

    reports.forEach(report => {
        const { logs_analysis_data: logsAnalysisData } = report as unknown as {
            logs_analysis_data: LogsAnalysisReportObjectType[];
        };

        // logs_analysis_data is an array of LogsAnalysisReportObjectType
        if (Array.isArray(logsAnalysisData)) {
            logsAnalysisData.forEach(analysisResult => {
                if (analysisResult?.status === 'success' && analysisResult?.data) {
                    const { remediationRecommendation = [] } = analysisResult.data;

                    remediationRecommendation.forEach((item: RemediationRecommendationObjectType) => {
                        const messageKey = getOrGenerateMessageKey(item);
                        const existingItem = aggregatedErrorMap.get(messageKey!);
                        if (!existingItem) {
                            aggregatedErrorMap.set(messageKey!, {
                                ...item,
                                count: item.count
                            });
                        } else {
                            existingItem.count += item.count;
                            // Update lastOccurence with a more recent timestamp if available
                            if (item.lastOccurrence && item.lastOccurrence > existingItem.lastOccurrence) {
                                existingItem.lastOccurrence = item.lastOccurrence;
                            }

                            // Update firstOccurrence with an oldest occurence timestamp
                            if (item.firstOccurrence && item.firstOccurrence < existingItem.firstOccurrence) {
                                existingItem.firstOccurrence = item.firstOccurrence;
                            }
                        }
                    });
                } else {
                    logger.warn(`Skipping analysis result with status: ${analysisResult.status}`, {
                        message: analysisResult.message,
                        accountId,
                        jobId
                    });
                }
            });
        } else {
            logger.error(
                'Logs analysis data is not available for the selected instance: logs_analysis_data is not an array:',
                { logsAnalysisData, accountId, jobId }
            );
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                'Logs analysis data is not available for the selected instance.'
            );
        }
    });
}

function getOrGenerateMessageKey(item: RemediationRecommendationObjectType): string | null {
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

    return null;
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
export { triggerLogsAnalysis, handleLogsAnalysis, getLogsAnalysisReport, calculateLogsAnalysisPrice };
