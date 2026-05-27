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
import throat from 'throat';
import { callSsmExecution } from '../aws/ssm-operations';
import { preSignedUrl } from '../../lib/aws/s3';
import {
    AuditStatus,
    DatabaseTypes,
    DEFAULT_INSTANCE_NAME,
    HttpErrorCodes,
    SqlServerDeploymentModel
} from '../../utils/consts';

import {
    generateHash,
    getArtifactsRegionBucketName,
    getArtifactsBucketRegion,
    getNextToken,
    sqlResponseParsing,
    IS_DEMO_FLOW
} from '../../utils/utils';
import {
    AVG_TOKEN_COUNT_PER_ERROR,
    BEDROCK_PRICE,
    LOGS_ANALYZER_BUNDLE_PATH,
    LOGS_ANALYZER_MODEL_IDS,
    LOGS_ANALYZER_PACKAGE_NAME,
    LOGS_ANALYZER_PACKAGE_VERSION,
    LOGS_COUNT_TO_CONSIDER,
    MODEL_AVAILABILITY_STATUS,
    MSSQL_PATH,
    MSSQL_ERROR_PATTERN,
    MSSQL_SEVERITY_RANGE,
    ORACLE_PATH,
    PRE_REQ_MESSAGES,
    SEVERITIES
} from '../../utils/logs-analyzer/logs-analyzer-consts';
import { DatabaseInstance, DatabaseInstancesIncludingResource, Metadata } from '../../utils/common-types';

import getLogger from '../../utils/logger';
import { registerJob, updateJobDetails } from '../database/job-operations';
import { getActiveNodeAndInstanceDetails, getActiveSqlNode } from '../workloads/mssql/mssql-operations';
import { sqlQueryExecutionWithAuth } from '../workloads/mssql/ssm-script-utils';
import { getModelAvailability } from '../../lib/aws/bedrock';
import { getCloudWatchLogs } from '../aws/cloud-watch-logs-operations';
import { mapSeverityLevel, parseConcatenatedJSON } from '../../utils/logs-analyzer/logs-analyzer-utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import {
    LogsAnalysisPreRequisitesObjectType,
    LogsAnalyzerBodyType,
    oracleHostType,
    RemediationRecommendationObject,
    RemediationRecommendationObjectType,
    SeverityCountsType
} from '../../routes/types/logs-analyzer.types';
import { getInferenceProfileFromModelId } from '../aws/bedrock-operations';
import {
    getLinuxBedrockAvailabilityCheckScript,
    getLinuxOraclePermissionsCheckScript,
    getLinuxPrepareScript,
    getWindowsBedrockAvailabilityCheckScript,
    getWindowsPrepareScript
} from './remote-script-functions';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../workloads/pgsql/const';
import {
    countLogsAnalysisReports,
    createLogsAnalysisReports,
    listLogsAnalysisReports
} from '../../lib/database/logs-analysis-reports';
import { getPaginatedDatabaseInstances } from '../database/database-operations';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC, SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION } from '../workloads/mssql/const';

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
            logger.warn(`Bedrock model ${modelId} is not available in region, trying next model`, { error });
        }
    }
}

async function checkLogAnalyzerPreRequisites(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    databaseType: string,
    databaseInstanceName: string
) {
    logger.info(`Checking prerequisites for logs analysis with credentialsId: ${credentialsId}, region: ${region}`, {
        accountId,
        activeNodeInstanceId,
        databaseType,
        databaseInstanceName
    });

    const {
        modelId,
        response,
        response: { agreementAvailability, entitlementAvailability } = {}
    } = (await findFirstAvailableModel(accountId, credentialsId, region, LOGS_ANALYZER_MODEL_IDS)) || {};

    if (!modelId || !response || isEmpty(response) || !agreementAvailability || entitlementAvailability === undefined) {
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
        const bedrockAvailabilityCheckResponse = await callSsmExecution({
            credentialsId,
            region,
            commands: [bedrockCheckScript!],
            ec2InstanceId: activeNodeInstanceId,
            comment: 'Check Bedrock Availability',
            accountId,
            executionTimeout: '600',
            documentName: databaseType !== DATABASE_TYPE.mssql ? SSM_RUN_SHELL_SCRIPT_DOC : undefined,
            documentVersion: databaseType !== DATABASE_TYPE.mssql ? SSM_RUN_SHELL_SCRIPT_DOC_VERSION : undefined
        });

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

    try {
        if (databaseType && databaseType === DATABASE_TYPE.oracle && databaseInstanceName) {
            const permissionsCheckScript = getLinuxOraclePermissionsCheckScript(
                activeNodeInstanceId,
                databaseInstanceName
            );
            const permissionsCheckResponse = await callSsmExecution({
                credentialsId,
                region,
                commands: [permissionsCheckScript],
                ec2InstanceId: activeNodeInstanceId,
                comment: 'Check Oracle Database Log Analysis Permissions',
                accountId,
                executionTimeout: '600',
                documentName: SSM_RUN_SHELL_SCRIPT_DOC,
                documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            });

            let hasPermissions = true;
            if (permissionsCheckResponse) {
                const jsonResponse = JSON.parse(permissionsCheckResponse);
                hasPermissions = jsonResponse.toString().trim() === 'true';
            }
            if (!hasPermissions) {
                throw createError(HttpErrorCodes.FORBIDDEN, PRE_REQ_MESSAGES.ALERT_LOG_VIEW_PERMISSION_MISSING);
            }
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
        jobId,
        startTime,
        endTime
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
        const [report] = await listLogsAnalysisReports({
            accountId,
            databaseHostId,
            databaseInstanceId,
            sort: 'creation_time',
            sortOrder: 'desc',
            pageSize: 1
        });
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
    scanParams: LogsAnalyzerBodyType
) {
    let {
        logsCountToConsider = LOGS_COUNT_TO_CONSIDER,
        logsAnalyzerFromTimestamp = 1,
        inferenceConfig,
        logsAnalyzerS3SignedUrl,
        logLevel,
        logsWindowDuration,
        monitorUsage
    } = scanParams;

    logger.info(
        `Handling logs analysis for accountId: ${accountId}, credentialsId: ${credentialsId}, region: ${region}`,
        {
            logsAnalyzerS3SignedUrl,
            inferenceConfig,
            logsCountToConsider,
            logsAnalyzerFromTimestamp,
            logLevel,
            logsWindowDuration,
            monitorUsage,
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
            resource_id: databaseHostId,
            resource: { metadata: resourceMetadata },
            database_instance_name: instanceName
        } = managedInstance;
        const databaseType = dbType?.toLowerCase() as DATABASE_TYPE;

        const { node1InstanceId, node2InstanceId, sqlDeploymentType } = resourceMetadata as unknown as Metadata;

        let activeNodeInstanceId;
        let matchingInstance;
        if (databaseType === DATABASE_TYPE.oracle) {
            const activeSqlNodeResult = await getActiveSqlNode(credentialsId, region, {
                node1InstanceId,
                node2InstanceId,
                resourceId: databaseHostId,
                accountId,
                resourceType: dbType as DatabaseTypes,
                sqlDeploymentType: sqlDeploymentType as SqlServerDeploymentModel
            });
            logger.debug('Active SQL Node for Oracle:', activeSqlNodeResult);
            activeNodeInstanceId = activeSqlNodeResult.activeNodeInstanceId;
            matchingInstance = instanceName;
        } else {
            ({ nodeId: activeNodeInstanceId, matchingInstance } = await getActiveNodeAndInstanceDetails(
                accountId,
                credentialsId,
                region,
                managedInstance.resource,
                databaseInstanceDetails as unknown as DatabaseInstance
            ));
        }

        const { inferenceProfileArn } = await checkLogAnalyzerPreRequisites(
            accountId,
            credentialsId,
            region,
            activeNodeInstanceId!,
            databaseType,
            instanceName
        );
        if (!inferenceProfileArn) {
            throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, 'Inference profile not found');
        }
        const logsAnalyzerPath =
            databaseType === DATABASE_TYPE.mssql
                ? `${LOGS_ANALYZER_BUNDLE_PATH}${MSSQL_PATH}`
                : `${LOGS_ANALYZER_BUNDLE_PATH}${ORACLE_PATH}`;
        const s3SignedUrl =
            logsAnalyzerS3SignedUrl ||
            (await getPreSignedUrl(
                getArtifactsBucketRegion(region),
                getArtifactsRegionBucketName(region),
                logsAnalyzerPath
            ));

        let logsPath = '';
        let databaseInstanceName = '';
        let sqlAuthEnabled;
        if (databaseType === DATABASE_TYPE.oracle) {
            logsPath = '/oracle'; // Dummy path for Oracle logs, actual logs will be fetched from the database directly
            databaseInstanceName = matchingInstance;
        } else {
            const logsPathQuery =
                'SET NOCOUNT ON; SELECT path FROM sys.dm_os_server_diagnostics_log_configurations FOR JSON PATH';
            ({ sqlAuthEnabled, instanceName: databaseInstanceName } = matchingInstance);
            const logsAnalysisSsmCommand = sqlQueryExecutionWithAuth(
                [databaseInstanceName],
                logsPathQuery,
                sqlAuthEnabled
            );
            const logsPathResponse = await callSsmExecution({
                credentialsId,
                region,
                commands: [logsAnalysisSsmCommand],
                ec2InstanceId: activeNodeInstanceId!,
                comment: 'Fetch Logs Path for sql server instance'
            });
            const parsedResponse = logsPathResponse ? sqlResponseParsing(logsPathResponse) : {};

            const [{ path } = {}] = IS_DEMO_FLOW
                ? parsedResponse?.[DEFAULT_INSTANCE_NAME] || []
                : parsedResponse?.[databaseInstanceName] || [];
            logsPath = path;
        }

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
                      instanceId: activeNodeInstanceId!,
                      region,
                      logsCountToConsider,
                      logsAnalyzerFromTimestamp,
                      inferenceProfileArn,
                      jobId,
                      inferenceConfig,
                      logLevel,
                      logsWindowDuration,
                      monitorUsage
                  })
                : getLinuxPrepareScript({
                      s3SignedUrl,
                      packageName: LOGS_ANALYZER_PACKAGE_NAME,
                      logsPath,
                      version: LOGS_ANALYZER_PACKAGE_VERSION,
                      instanceId: activeNodeInstanceId!,
                      region,
                      inferenceProfileArn,
                      jobId,
                      inferenceConfig,
                      logLevel,
                      databaseType,
                      logsAnalyzerFromTimestamp,
                      logsWindowDuration,
                      databaseInstanceName
                  });

        const documentName =
            databaseType !== DATABASE_TYPE.mssql ? SSM_RUN_SHELL_SCRIPT_DOC : SSM_RUN_POWERSHELL_SCRIPT_DOC;
        const documentVersion =
            databaseType !== DATABASE_TYPE.mssql
                ? SSM_RUN_SHELL_SCRIPT_DOC_VERSION
                : SSM_RUN_POWERSHELL_SCRIPT_DOC_VERSION;

        const logsAnalysisResponse = await callSsmExecution({
            credentialsId,
            region,
            commands: [logsAnalyserScriptCommand],
            ec2InstanceId: activeNodeInstanceId!,
            comment: 'Trigger Logs Analysis',
            accountId,
            executionTimeout: '1800',
            shouldReadFromCloudWatchLogs: true, // Cloud watch logs enabled,
            documentName,
            documentVersion
        });

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
        const scriptTypeSuffix =
            databaseType === DATABASE_TYPE.mssql ? 'aws-runPowerShellScript' : 'aws-runShellScript';
        const logStreamName = `${activeNodeInstanceId}-logs-analyzer/${jobId}/${scriptTypeSuffix}/stdout`;
        const [ssmLogsResponse] = await getCloudWatchLogs(credentialsId, region, logGroupName, logStreamName);
        const jsonSsmLogsResponse = parseConcatenatedJSON(ssmLogsResponse);

        logger.info('Logs analysis completed successfully for jobId:', jobId);
        logger.debug(`Logs analysis response: ${JSON.stringify(jsonSsmLogsResponse)}`);

        const [{ data: { startTime: analysisStartTime, endTime: analysisEndTime } = {} } = {}] =
            (jsonSsmLogsResponse as unknown as [{ data: { startTime: number; endTime: number } }]) || [];

        const analysisStartTimeFinal = analysisStartTime
            ? new Date(analysisStartTime)
            : new Date(logsAnalyzerFromTimestamp);
        const analysisEndTimeFinal = analysisEndTime
            ? new Date(analysisEndTime)
            : new Date(Math.min(logsAnalyzerFromTimestamp + (logsWindowDuration || 24) * 60 * 60 * 1000, Date.now()));
        await updateLogsAnalysisReportsInDB(
            accountId,
            credentialsId,
            databaseHostId,
            databaseInstanceId,
            jobId,
            databaseType,
            jsonSsmLogsResponse,
            analysisStartTimeFinal,
            analysisEndTimeFinal
        );
        await updateLongRunningAuditGroup(AuditStatus.SUCCESS, 'Logs analysis completed successfully');
        const {
            items: [
                { id, latestReport: { creationTime, errorCount, severityCounts, startTime, endTime } = {} } = {}
            ] = []
        } = await getLatestLogsAnalysisReports(accountId, region, credentialsId, databaseType, jobId);

        await updateJobDetails(accountId, jobId, {
            endTime: Date.now(),
            status: JOBSTATUS.COMPLETED,
            metadata: {
                latestReport: {
                    creationTime,
                    id,
                    errorCount,
                    severityCounts,
                    startTime,
                    endTime
                }
            }
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
        timestampLastLogProcessed = logsAnalyzerFromTimestamp > Date.now() ? Date.now() : logsAnalyzerFromTimestamp; // if provided timestamp is in future, use current time
    } else if (report && !isEmpty(report)) {
        // If report exists, use the end time of the last report
        logger.debug('Using end time from the last logs analysis report');
        const { end_time: endTime } = report;

        // if endTIme is not older than a day(24hours), use endTime of the last report as the timestamp, else use 24 hours back from current time
        if (ms('24h') > Date.now() - (endTime ? endTime.getTime() : 0)) {
            // endTime is within last 24 hours
            timestampLastLogProcessed = endTime ? endTime.getTime() : timestampLastLogProcessed;
        } else {
            // endTime is older than 24 hours
            logger.debug('Last report end time is older than 24 hours, using 24 hours back from current time');
            timestampLastLogProcessed = Date.now() - ms('24h');
        }
    }
    return timestampLastLogProcessed;
}

async function triggerLogsAnalysis(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    scanParams: LogsAnalyzerBodyType
) {
    logger.info('Triggering logs analysis:', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        scanParams
    });

    if (scanParams.logsAnalyzerFromTimestamp && scanParams.logsAnalyzerFromTimestamp > Date.now()) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Logs analysis start time cannot be in the future');
    }

    const paginatedResponse = await getPaginatedDatabaseInstances(accountId, {
        credentialsId,
        region,
        resourceId: databaseHostId,
        databaseInstanceId,
        shouldIncludeResource: true
    });
    const [managedInstance] = paginatedResponse.items as DatabaseInstancesIncludingResource[];

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
        handleLogsAnalysis(accountId, credentialsId, region, managedInstance, jobId, scanParams);
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

    const reports = await listLogsAnalysisReports({ accountId, databaseHostId, databaseInstanceId, jobId, reportId });

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

    const response = await listLogsAnalysisReports({
        accountId,
        databaseHostId,
        databaseInstanceId,
        sort: 'creation_time',
        sortOrder: 'desc',
        pageSize,
        select: {
            id: true,
            creation_time: true,
            start_time: true,
            end_time: true
        }
    });

    if (response && response.length > 0) {
        const reports = response.map(
            ({ id, creation_time: creationTime, start_time: startTime, end_time: endTime }) => ({
                id,
                creationTime: creationTime.getTime(),
                startTime: startTime ? startTime.getTime() : undefined,
                endTime: endTime ? endTime.getTime() : undefined
            })
        );

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

const READY_TRUE = {
    ready: true
};

const MAX_INSTANCES_LIMIT = 5;
function validateEc2InstanceId(ec2InstanceId: string = '') {
    if (!ec2InstanceId || typeof ec2InstanceId !== 'string' || ec2InstanceId.trim() === '') {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid ec2 instance ID provided');
    }
    const ec2InstanceIdList = ec2InstanceId.split(',');
    if (ec2InstanceIdList.length > 5) {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Too many EC2 instance IDs provided, maximum allowed is 5');
    }
    return ec2InstanceIdList;
}

function validateDatabaseHostId(databaseHostId: string) {
    if (!databaseHostId || typeof databaseHostId !== 'string' || databaseHostId.trim() === '') {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid database host ID provided');
    }
    const databaseHostIdList = databaseHostId.split(',');
    if (databaseHostIdList.length > MAX_INSTANCES_LIMIT) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `Too many database host IDs provided, maximum allowed is ${MAX_INSTANCES_LIMIT}`
        );
    }
    return databaseHostIdList;
}

function validateQueryParams(ec2InstanceId?: string, databaseHostId?: string) {
    if (ec2InstanceId && databaseHostId) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            'Please provide either database host ID or EC2 instance ID, not both'
        );
    }

    if ((!ec2InstanceId || ec2InstanceId.trim() === '') && (!databaseHostId || databaseHostId.trim() === '')) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            'Please provide at least one of database host ID or EC2 instance ID'
        );
    }

    const ec2InstanceIdList = ec2InstanceId ? validateEc2InstanceId(ec2InstanceId) : [];
    const databaseHostIdList = databaseHostId ? validateDatabaseHostId(databaseHostId) : [];

    return {
        ec2InstanceIdList,
        databaseHostIdList
    };
}

async function handlePreReqCheckBasedOnEc2InstanceId(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceIdList: string[],
    databaseType: DATABASE_TYPE,
    databaseInstanceName?: string
) {
    logger.info('Handling pre-requisite check based on EC2 instance ID:', {
        accountId,
        credentialsId,
        region,
        ec2InstanceIdList,
        databaseType,
        databaseInstanceName
    });
    return Promise.all(
        ec2InstanceIdList.map(
            throat(5, async ec2InstanceId => {
                try {
                    const preReqCheckResponse = await handlePreReqCheck(
                        accountId,
                        credentialsId,
                        region,
                        ec2InstanceId,
                        databaseType,
                        databaseInstanceName
                    );
                    return {
                        ec2InstanceId,
                        ...preReqCheckResponse
                    };
                } catch (error) {
                    const errorMessage = `Error verifying pre-requisite check for EC2 instance ID ${ec2InstanceId}: ${error}`;
                    logger.error(errorMessage);
                    return {
                        ec2InstanceId,
                        errorMessage
                    };
                }
            })
        )
    );
}

async function handlePreReqCheckBasedOnDatabaseHostId(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostIdList: string[],
    databaseType: DATABASE_TYPE,
    databaseInstanceName?: string
) {
    logger.info('Handling pre-requisite check based on database host ID:', {
        accountId,
        credentialsId,
        region,
        databaseHostIdList,
        databaseType
    });
    return Promise.all(
        databaseHostIdList.map(
            throat(5, async databaseHostId => {
                try {
                    const {
                        items: [managedInstance]
                    } = await getPaginatedDatabaseInstances(accountId, {
                        resourceId: databaseHostId,
                        credentialsId,
                        region,
                        shouldIncludeResource: true,
                        pageSize: 1
                    });

                    const databaseInstanceDetails = {
                        ...managedInstance,
                        storage_type: STORAGE_TYPE.FSXN,
                        isManaged: true
                    };

                    // For non-MSSQL databases (Oracle, PostgreSQL), directly extract node instance ID
                    // For MSSQL, we need to query SQL Server to determine the active node
                    let activeNodeInstanceId: string;
                    if (databaseType === DATABASE_TYPE.mssql) {
                        const { nodeId } = await getActiveNodeAndInstanceDetails(
                            accountId,
                            credentialsId,
                            region,
                            managedInstance.resource,
                            databaseInstanceDetails as unknown as DatabaseInstance
                        );
                        activeNodeInstanceId = nodeId;
                    } else {
                        // For Oracle/PostgreSQL, get the first node instance ID from metadata
                        const { node1InstanceId } = managedInstance.resource.metadata as { node1InstanceId: string };
                        activeNodeInstanceId = node1InstanceId;
                    }

                    const preReqCheckResponse = await handlePreReqCheck(
                        accountId,
                        credentialsId,
                        region,
                        activeNodeInstanceId,
                        databaseType,
                        databaseInstanceName
                    );
                    return {
                        databaseHostId,
                        ec2InstanceId: activeNodeInstanceId,
                        ...preReqCheckResponse
                    };
                } catch (error) {
                    const errorMessage = `Error verifying pre-requisite check for database host ID ${databaseHostId}: ${error}`;
                    logger.error(errorMessage);
                    return {
                        databaseHostId,
                        errorMessage
                    };
                }
            })
        )
    );
}

async function handlePreReqCheck(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    databaseType: string,
    databaseInstanceName?: string
) {
    logger.info('Handling pre-requisite check:', {
        accountId,
        credentialsId,
        region,
        activeNodeInstanceId,
        databaseType,
        databaseInstanceName
    });
    let bedrockPreRequisites;
    let instanceProfilePreRequisites;
    let credentialsPreRequisites;
    let networkingPreRequisites;
    let oraclePermissionsPreRequisites;

    let inferenceProfileArn: string | undefined;
    try {
        const {
            modelId,
            response,
            response: { agreementAvailability, entitlementAvailability } = {}
        } = (await findFirstAvailableModel(accountId, credentialsId, region, LOGS_ANALYZER_MODEL_IDS)) || {};

        if (!modelId || !response || isEmpty(response)) {
            bedrockPreRequisites = {
                ready: false,
                message: PRE_REQ_MESSAGES.MODEL_NOT_AVAILABLE.replace(
                    '%smodelId%s',
                    LOGS_ANALYZER_MODEL_IDS[0]
                ).replace('%sregion%s', region)
            };
        } else {
            inferenceProfileArn = await getInferenceProfileFromModelId(accountId, credentialsId, region, modelId);
        }

        const isSupported =
            agreementAvailability?.status === MODEL_AVAILABILITY_STATUS.AVAILABLE &&
            entitlementAvailability === MODEL_AVAILABILITY_STATUS.AVAILABLE;
        if (!isSupported) {
            bedrockPreRequisites = {
                ready: false,
                message: PRE_REQ_MESSAGES.MODEL_NOT_AVAILABLE.replace(
                    '%smodelId%s',
                    LOGS_ANALYZER_MODEL_IDS[0]
                ).replace('%sregion%s', region)
            };
        }
        if (isEmpty(bedrockPreRequisites)) {
            bedrockPreRequisites = READY_TRUE;
            credentialsPreRequisites = READY_TRUE;
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('not authorized to perform')) {
            credentialsPreRequisites = {
                ready: false,
                message: PRE_REQ_MESSAGES.WLMDB_CREDENTIALS
            };
        } else {
            throw createError(
                HttpErrorCodes.INTERNAL_SERVER_ERROR,
                `Unable to continue with logs analysis ${error}. Make sure all the prerequisites are met.`
            );
        }
    }

    try {
        if (inferenceProfileArn) {
            const bedrockCheckScript =
                databaseType === DATABASE_TYPE.mssql
                    ? getWindowsBedrockAvailabilityCheckScript(region, inferenceProfileArn)
                    : getLinuxBedrockAvailabilityCheckScript(region, inferenceProfileArn);
            const bedrockAvailabilityCheckResponse = await callSsmExecution({
                credentialsId,
                region,
                commands: [bedrockCheckScript],
                ec2InstanceId: activeNodeInstanceId,
                comment: 'Check Bedrock Availability',
                accountId,
                executionTimeout: '600',
                documentName: databaseType !== DATABASE_TYPE.mssql ? SSM_RUN_SHELL_SCRIPT_DOC : undefined,
                documentVersion: databaseType !== DATABASE_TYPE.mssql ? SSM_RUN_SHELL_SCRIPT_DOC_VERSION : undefined
            });

            const [jsonResponse] = parseConcatenatedJSON(bedrockAvailabilityCheckResponse) as {
                success?: boolean;
                response?: object;
                error?: string;
            }[];
            if (jsonResponse?.success === false) {
                if (jsonResponse?.error?.includes(PRE_REQ_MESSAGES.BEDROCK_TOOL_NOT_FOUND)) {
                    bedrockPreRequisites = {
                        ready: false,
                        message: PRE_REQ_MESSAGES.BEDROCK_TOOL_NOT_FOUND
                    };
                } else if (!bedrockPreRequisites || bedrockPreRequisites.ready !== false) {
                    bedrockPreRequisites = READY_TRUE;
                }

                const errorMsg = jsonResponse?.error || '';
                const isAccessDenied =
                    errorMsg.includes('not authorized to perform') ||
                    errorMsg.includes('AccessDeniedException') ||
                    /don.t have access/.test(errorMsg);
                if (isAccessDenied) {
                    if (!bedrockPreRequisites || bedrockPreRequisites.ready !== false) {
                        instanceProfilePreRequisites = {
                            ready: false,
                            message: PRE_REQ_MESSAGES.IAM_INSTANCE_PROFILE
                        };
                    } else {
                        instanceProfilePreRequisites = READY_TRUE;
                    }
                } else {
                    instanceProfilePreRequisites = READY_TRUE;
                }

                if (bedrockPreRequisites.ready && instanceProfilePreRequisites.ready) {
                    networkingPreRequisites = {
                        ready: false,
                        message: PRE_REQ_MESSAGES.BEDROCK_NW_CONFIGURATION
                    };
                }
            } else {
                bedrockPreRequisites = READY_TRUE;
                instanceProfilePreRequisites = READY_TRUE;
                networkingPreRequisites = READY_TRUE;
            }
        }
        if (!instanceProfilePreRequisites) {
            instanceProfilePreRequisites = READY_TRUE;
        }
        if (!networkingPreRequisites) {
            networkingPreRequisites = READY_TRUE;
        }
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Unable to continue with logs analysis ${error}`);
    }

    try {
        if (databaseType && databaseType === DATABASE_TYPE.oracle && databaseInstanceName) {
            const permissionsCheckScript = getLinuxOraclePermissionsCheckScript(
                activeNodeInstanceId,
                databaseInstanceName
            );
            const permissionsCheckResponse = await callSsmExecution({
                credentialsId,
                region,
                commands: [permissionsCheckScript],
                ec2InstanceId: activeNodeInstanceId,
                comment: 'Check Oracle Database Log Analysis Permissions',
                accountId,
                executionTimeout: '600',
                documentName: SSM_RUN_SHELL_SCRIPT_DOC,
                documentVersion: SSM_RUN_SHELL_SCRIPT_DOC_VERSION
            });

            let hasPermissions = true;
            if (permissionsCheckResponse) {
                const jsonResponse = JSON.parse(permissionsCheckResponse);
                hasPermissions = jsonResponse.toString().trim() === 'true';
            }
            if (!hasPermissions) {
                oraclePermissionsPreRequisites = {
                    ready: false,
                    message: PRE_REQ_MESSAGES.ALERT_LOG_VIEW_PERMISSION_MISSING
                };
            } else {
                oraclePermissionsPreRequisites = READY_TRUE;
            }
        }
    } catch (error) {
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Unable to continue with logs analysis ${error}`);
    }

    return {
        bedrockPreRequisites,
        instanceProfilePreRequisites,
        credentialsPreRequisites,
        networkingPreRequisites,
        oraclePermissionsPreRequisites
    };
}

async function analyzePreRequisites(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseType: string,
    ec2InstanceId?: string,
    databaseHostId?: string,
    databaseInstanceName?: string
) {
    logger.info('Analyzing prerequisites for logs analysis:', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        databaseType
    });

    const { ec2InstanceIdList, databaseHostIdList } = validateQueryParams(ec2InstanceId, databaseHostId);

    const response =
        ec2InstanceIdList.length > 0
            ? await handlePreReqCheckBasedOnEc2InstanceId(
                  accountId,
                  credentialsId,
                  region,
                  ec2InstanceIdList,
                  databaseType as DATABASE_TYPE,
                  databaseInstanceName
              )
            : await handlePreReqCheckBasedOnDatabaseHostId(
                  accountId,
                  credentialsId,
                  region,
                  databaseHostIdList,
                  databaseType as DATABASE_TYPE,
                  databaseInstanceName
              );
    return { items: response };
}

async function analyzeOracleHostsPreRequisites(
    accountId: string,
    credentialsId: string,
    region: string,
    oracleHosts: oracleHostType[]
) {
    logger.info('Analyzing pre-requisites for Oracle hosts:', { accountId, credentialsId, region });
    const preRequisitesResults: Array<LogsAnalysisPreRequisitesObjectType> = [];

    await Promise.all(
        oracleHosts?.map(async (host: oracleHostType) => {
            try {
                const { databaseHostId, databaseInstanceName, ec2InstanceId } = host;
                const preReqCheckResponse = await analyzePreRequisites(
                    accountId,
                    credentialsId,
                    region,
                    DATABASE_TYPE.oracle,
                    ec2InstanceId,
                    databaseHostId,
                    databaseInstanceName
                );
                const [preReqCheckResponseForDatabase] = preReqCheckResponse?.items || [];
                if (preReqCheckResponseForDatabase) {
                    preRequisitesResults.push({
                        databaseHostId,
                        ec2InstanceId,
                        databaseInstanceName,
                        ...preReqCheckResponseForDatabase
                    });
                }
            } catch (error) {
                const errorMessage = `Error verifying pre-requisite check for Oracle host ${JSON.stringify(
                    host
                )}: ${error}`;
                logger.error(errorMessage);
                preRequisitesResults.push({
                    ...host,
                    errorMessage
                });
            }
        })
    );

    return { items: preRequisitesResults };
}

async function getLatestLogsAnalysisReports(
    accountId: string,
    region?: string,
    credentialsId?: string,
    databaseType?: DATABASE_TYPE,
    jobId?: string
) {
    logger.info('Getting latest report data of database instances at account level', {
        accountId,
        region,
        credentialsId,
        databaseType
    });
    // iterate through all pages of listLogsAnalysisReports
    let processedCount = 0;
    let nextToken: string | undefined;
    const DEFAULT_PAGE_SIZE = 50;
    const totalReportCount = await countLogsAnalysisReports(accountId, credentialsId, region);

    const instanceReportsMap = new Map<string, any>();

    do {
        // eslint-disable-next-line no-await-in-loop
        const reports = await listLogsAnalysisReports({
            accountId,
            credentialsId,
            region,
            sort: 'creation_time',
            sortOrder: 'desc',
            pageSize: DEFAULT_PAGE_SIZE,
            select: {
                id: true,
                creation_time: true,
                database_instance_id: true,
                logs_analysis_data: true,
                resource_id: true,
                job_id: true,
                start_time: true,
                end_time: true
            },
            jobId,
            databaseType
        });
        processedCount += reports.length;

        for (const report of reports) {
            const instanceId = report.database_instance_id;

            if (
                !instanceReportsMap.has(instanceId) ||
                report.creation_time > instanceReportsMap.get(instanceId).creation_time
            ) {
                instanceReportsMap.set(instanceId, report);
            }
        }
        nextToken = getNextToken(reports, totalReportCount, DEFAULT_PAGE_SIZE);
    } while (nextToken && processedCount < totalReportCount);

    const latestReports: Array<{
        id: string;
        databaseHostId: string;
        databaseInstanceId: string;
        latestReport: {
            jobId: string;
            creationTime: number;
            errorCount: number;
            severityCounts?: SeverityCountsType;
            startTime?: number;
            endTime?: number;
        };
    }> = [];
    instanceReportsMap.forEach((report, instanceId) => {
        const {
            logs_analysis_data: [{ data: logsAnalysisData }],
            id,
            resource_id: databaseHostId,
            job_id: jobIdFromReport
        } = report;
        if (logsAnalysisData?.remediationRecommendation) {
            const severityCounts: SeverityCountsType = {
                severe: 0,
                important: 0,
                critical: 0
            };
            for (const rec of logsAnalysisData.remediationRecommendation) {
                if (databaseType === DATABASE_TYPE.mssql) {
                    const { severity: initialSeverity = MSSQL_SEVERITY_RANGE[SEVERITIES.SEVERE].start } = rec; // marking errors with unknown severities as 'SEVERE; by default
                    if (initialSeverity) {
                        const severity = mapSeverityLevel(Number(initialSeverity));
                        severityCounts[severity as keyof SeverityCountsType] =
                            (severityCounts[severity as keyof SeverityCountsType] || 0) + 1;
                    }
                } else if (databaseType === DATABASE_TYPE.oracle) {
                    const { severity } = rec;
                    const loweredSeverity = severity?.toLowerCase();
                    severityCounts[loweredSeverity as keyof SeverityCountsType] =
                        (severityCounts[loweredSeverity as keyof SeverityCountsType] || 0) + 1;
                } else {
                    // For other database types, if any in future, we can extend here
                    logger.debug(`Severity count aggregation not available for database type: ${databaseType}`);
                }
            }
            latestReports.push({
                id,
                databaseHostId,
                databaseInstanceId: instanceId,
                latestReport: {
                    jobId: jobIdFromReport,
                    creationTime: report.creation_time.getTime(),
                    errorCount: logsAnalysisData?.remediationRecommendation?.length,
                    severityCounts,
                    startTime: report.start_time ? report.start_time.getTime() : undefined,
                    endTime: report.end_time ? report.end_time.getTime() : undefined
                } // TODO: can be extended to include host level report/ instance level report count if needed.
            });
        }
    });

    return { items: latestReports };
}

export {
    triggerLogsAnalysis,
    handleLogsAnalysis,
    getLogsAnalysisReport,
    listLogsAnalysisReportsIdentifiers,
    calculateLogsAnalysisPrice,
    analyzePreRequisites,
    getLatestLogsAnalysisReports,
    analyzeOracleHostsPreRequisites
};
