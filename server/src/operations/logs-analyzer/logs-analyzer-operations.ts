import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { DATABASE_TYPE, JOBSTATUS, JOBTYPE, STORAGE_TYPE } from '@prisma/client';
import { callSsmExecution } from '../aws/ssm-operations';
import { preSignedUrl } from '../../lib/aws/s3';
import { AuditStatus, DEFAULT_AWS_REGION, HttpErrorCodes } from '../../utils/consts';
import { getArtifactsRegionBucketName } from '../../utils/utils';
import {
    LOGS_ANALYZER_BEDROCK_REGION,
    LOGS_ANALYZER_BUNDLE_PATH,
    LOGS_ANALYZER_MODEL_ID,
    LOGS_ANALYZER_PACKAGE_NAME,
    LOGS_ANALYZER_PACKAGE_VERSION,
    MODEL_AVAILABILITY_STATUS
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
import { InferenceConfigType } from '../../routes/types/logs-analyzer.types';
import getInferenceProfileFromModelId from '../aws/bedrock-operations';
import {
    getLinuxBedrockAvailabilityCheckScript,
    getLinuxPrepareScript,
    getWindowsBedrockAvailabilityCheckScript,
    getWindowsPrepareScript
} from './remote-script-functions';
import { SSM_RUN_SHELL_SCRIPT_DOC, SSM_RUN_SHELL_SCRIPT_DOC_VERSION } from '../workloads/pgsql/const';

const { getPreSignedUrl } = preSignedUrl;

const logger = getLogger();

async function checkLogAnalyzerPreRequisites(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    databaseType: string,
    inferenceProfileArn: string
) {
    logger.info(`Checking prerequisites for logs analysis with credentialsId: ${credentialsId}, region: ${region}`, {
        accountId,
        activeNodeInstanceId,
        databaseType,
        inferenceProfileArn
    });

    // Check if the AWS Bedrock Inference Profile is available for the account
    try {
        const availabilityResponse = await getModelAvailability(
            accountId,
            credentialsId,
            LOGS_ANALYZER_BEDROCK_REGION,
            LOGS_ANALYZER_MODEL_ID
        );

        const isSupported =
            availabilityResponse?.agreementAvailability?.status === MODEL_AVAILABILITY_STATUS.AVAILABLE &&
            availabilityResponse?.entitlementAvailability === MODEL_AVAILABILITY_STATUS.AVAILABLE;
        if (!isSupported) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                'Unable to continue with logs analysis, the AWS Bedrock model cannot be used.'
            );
        }
    } catch (error) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `Unable to continue with logs analysis, failed to retrieve AWS Bedrock model not available. ${error}`
        );
    }

    try {
        const bedrockCheckScript =
            databaseType === DATABASE_TYPE.mssql
                ? getWindowsBedrockAvailabilityCheckScript(LOGS_ANALYZER_BEDROCK_REGION, inferenceProfileArn)
                : getLinuxBedrockAvailabilityCheckScript(LOGS_ANALYZER_BEDROCK_REGION, inferenceProfileArn);
        const response = await callSsmExecution(
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

        const [jsonResponse] = parseConcatenatedJSON(response);
        if ((jsonResponse as { success?: boolean })?.success === false) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                `Unable to continue with logs analysis, the AWS Bedrock model cannot be used. ${
                    (jsonResponse as any)?.error ?? ''
                }`
            );
        }
    } catch (error) {
        throw createError(HttpErrorCodes.BAD_REQUEST, `Unable to continue with logs analysis ${error}`);
    }
}

async function handleLogsAnalysis(
    accountId: string,
    credentialsId: string,
    region: string,
    managedInstance: DatabaseInstancesIncludingResource,
    jobId: string,
    inferenceConfig?: InferenceConfigType
) {
    logger.info(
        `Handling logs analysis for accountId: ${accountId}, credentialsId: ${credentialsId}, region: ${region}`
    );
    let jobStatus;
    let jobError;
    try {
        const databaseInstanceDetails = {
            ...managedInstance,
            storage_type: STORAGE_TYPE.FSXN,
            isManaged: true
        };

        const { database_type: databaseType } = managedInstance;

        const { nodeId: activeNodeInstanceId, matchingInstance } = await getActiveNodeAndInstanceDetails(
            accountId,
            credentialsId,
            region,
            managedInstance.resource,
            databaseInstanceDetails as unknown as DatabaseInstance
        );

        const inferenceProfileArn = await getInferenceProfileFromModelId(
            accountId,
            credentialsId,
            region,
            LOGS_ANALYZER_MODEL_ID
        );

        await checkLogAnalyzerPreRequisites(
            accountId,
            credentialsId,
            region,
            activeNodeInstanceId,
            databaseType,
            inferenceProfileArn
        );

        const s3SignedUrl = await getPreSignedUrl(
            DEFAULT_AWS_REGION,
            getArtifactsRegionBucketName(DEFAULT_AWS_REGION),
            LOGS_ANALYZER_BUNDLE_PATH
        );

        const logsPathQuery = 'SET NOCOUNT ON; SELECT path FROM sys.dm_os_server_diagnostics_log_configurations';
        const logsAnalysisSsmCommand = sqlQueryExecutionWithAuth(
            [managedInstance?.database_instance_name],
            logsPathQuery,
            matchingInstance?.sqlAuthEnabled
        );
        const logsPath = await callSsmExecution(
            credentialsId,
            region,
            [logsAnalysisSsmCommand],
            activeNodeInstanceId,
            'Fetch Logs Path for sql server instance'
        );

        const logsAnalyserScriptCommand =
            databaseType === DATABASE_TYPE.mssql
                ? getWindowsPrepareScript({
                      s3SignedUrl,
                      packageName: LOGS_ANALYZER_PACKAGE_NAME,
                      logsPath,
                      version: LOGS_ANALYZER_PACKAGE_VERSION,
                      instanceId: activeNodeInstanceId,
                      region,
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

        await callSsmExecution(
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

        const logGroupName = 'netapp/wlmdb/ssm-response';
        const logStreamName = `${activeNodeInstanceId}-logs-analyzer/${jobId}/aws-runPowerShellScript/stdout`;
        const [ssmLogsResponse] = await getCloudWatchLogs(credentialsId, region, logGroupName, logStreamName);
        const jsonSsmLogsResponse = parseConcatenatedJSON(ssmLogsResponse);

        logger.info(`Logs analysis response: ${jsonSsmLogsResponse}`);

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
    inferenceConfig?: InferenceConfigType
) {
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
    let jobId: string = 'test';
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
        handleLogsAnalysis(accountId, credentialsId, region, managedInstance, jobId, inferenceConfig);
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

export { triggerLogsAnalysis, handleLogsAnalysis };
