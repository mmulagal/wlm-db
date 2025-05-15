import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { DATABASE_TYPE, JOBSTATUS, JOBTYPE, STORAGE_TYPE } from '@prisma/client';
import { GetInstanceProfileCommandInput } from '@aws-sdk/client-iam';
import { callSsmExecution } from '../aws/ssm-operations';
import { preSignedUrl } from '../../lib/aws/s3';
import { AuditStatus, DEFAULT_AWS_REGION, HttpErrorCodes } from '../../utils/consts';
import { derivePropertiesFromARN, getArtifactsRegionBucketName } from '../../utils/utils';
import {
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
import simulatePrincipalPolicy, { getInstanceProfile } from '../../lib/aws/iam';
import { describeInstance } from '../../lib/aws/ec2';
import { sqlQueryExecutionWithAuth } from '../workloads/mssql/ssm-script-utils';
import { getModelAvailability } from '../../lib/aws/bedrock';
import { getCloudWatchLogs } from '../aws/cloud-watch-logs-operations';
import { parseConcatenatedJSON } from '../../utils/logs-analyzer/logs-analyzer-utils';
import { updateLongRunningAuditGroup } from '../cloud-manager/audit-operations';
import { InferenceConfigType } from '../../routes/types/logs-analyzer.types';
import getInferenceProfileFromModelId from '../aws/bedrock-operations';

const { getPreSignedUrl } = preSignedUrl;

const logger = getLogger();
function getWindowsPrepareScript(scriptParams: {
    s3SignedUrl: string;
    packageName: string;
    logsPath: string;
    version: string;
    instanceId: string;
    region: string;
    inferenceProfileArn: string;
    jobId?: string;
    inferenceConfig?: InferenceConfigType;
}): string {
    const {
        s3SignedUrl,
        packageName,
        logsPath,
        version,
        instanceId,
        region,
        inferenceProfileArn,
        jobId,
        inferenceConfig = {
            temperature: 0.5,
            maxTokens: 1000,
            topP: 0.9
        }
    } = scriptParams;

    const { temperature, maxTokens, topP } = inferenceConfig;

    return `$s3SignedUrl = "${s3SignedUrl}";
    $packageName = "${packageName}";
    $logsPath = "${logsPath}";
    $version = "${version}";
    $instanceId = "${instanceId}";
    $region = "${region}";
    $jobId = "${jobId}";
    $modelId = "${inferenceProfileArn}";
    $modelRegion = "${region}";
    $temperature = ${temperature};
    $maxTokens = ${maxTokens};
    $topP = ${topP};

    

    function Invoke-RetryCommand {
        param ([scriptblock]$Command, [int]$Retries = 5)
        $Count = 0
        while ($Count -lt $Retries) {
            try {
                & $Command
                return
            } catch {
                $Count++
                if ($Count -ge $Retries) {
                    Write-Host "Command failed after $Retries attempts."
                    throw
                }
                Write-Host "Retrying... ($Count/$Retries)"
                Start-Sleep -Seconds 5
            }
        }
    }

    Write-Host "Checking if the Logs Analyzer package version $version is already available..."
    $filePath = ".\\$packageName-$version.exe"
    if (Test-Path $filePath) {
        Write-Host "Logs Analyzer package version $version already exists: $filePath"
    } else {
        Write-Host "Downloading the latest version of the Logs Analyzer package..."
        Invoke-RetryCommand {
            Invoke-WebRequest -Uri $s3SignedUrl -OutFile $filePath
        }

        Write-Host "Deleting older versions of the Logs Analyzer package..."
        Get-ChildItem -Path . -Filter "$packageName-*.exe" | Where-Object { $_.Name -ne "$packageName-$version.exe" } | Remove-Item -Force
    }

    Write-Host "Setting execution permissions for the package..."
    try {
        icacls $filePath /grant Everyone:F
    } catch {
        Write-Host "Failed to set execution permissions for the package."
        throw
    }

    Write-Host "Running the Logs Analyzer..."
    try {
        if (-Not (Test-Path $filePath)) {
            Write-Host "File not found: $filePath"
            throw "The specified file does not exist."
        }

        Start-Process -FilePath $filePath -ArgumentList "--logs-path $logsPath --log-level info --region $region --model-id $modelId --model-region $modelRegion --job-id $jobId --instance-id $instanceId --temperature $temperature --maxTokens $maxTokens --topP $topP" -NoNewWindow -Wait
    } catch {
        Write-Host "Failed to run Logs Analyzer. Please check the logs for more details."
        throw
    }`;
}

function getLinuxPrepareScript(scriptParams: {
    s3SignedUrl: string;
    packageName: string;
    logsPath: string;
    version: string;
    instanceId: string;
    region: string;
    inferenceProfileArn: string;
    jobId?: string;
    inferenceConfig?: InferenceConfigType;
}): string {
    const {
        s3SignedUrl,
        packageName,
        logsPath,
        version,
        instanceId,
        region,
        inferenceProfileArn,
        jobId,
        inferenceConfig = {
            temperature: 0.5,
            maxTokens: 1000,
            topP: 0.9
        }
    } = scriptParams;
    const { temperature, maxTokens, topP } = inferenceConfig;

    return `#!/bin/bash

s3SignedUrl="${s3SignedUrl}"
packageName="${packageName}"
logsPath="${logsPath}"
version="${version}"
instanceId="${instanceId}"
region="${region}"
jobId="${jobId}"
    $modelId = "${inferenceProfileArn}";
    $modelRegion = "${DEFAULT_AWS_REGION}";
    $temperature = ${temperature};
    $maxTokens = ${maxTokens};
    $topP = ${topP};

retry_command() {
    local retries=5
    local count=0
    while [ $count -lt $retries ]; do
        "$@" && return 0 || {
            count=$((count + 1))
            echo "Retrying... ($count/$retries)"
            sleep 5
        }
    done
    echo "Command failed after $retries attempts."
    return 1
}

# Check if the Logs Analyzer package version is already available
filePath="./$packageName-$version"
if [ -f "$filePath" ]; then
    echo "Logs Analyzer package version $version already exists: $filePath"
else
    echo "Downloading the latest version of the Logs Analyzer package..."
    retry_command curl -o "$filePath" "$s3SignedUrl"

    echo "Deleting older versions of the Logs Analyzer package..."
    find . -name "$packageName-*" ! -name "$packageName-$version" -exec rm -f {} +
fi

# Set execution permissions for the package
chmod +x "$filePath"

# Run the Logs Analyzer
if [ ! -f "$filePath" ]; then
    echo "File not found: $filePath"
    exit 1
fi

echo "Running the Logs Analyzer..."
"$filePath" --logs-path "$logsPath" --log-level info --region "$region" --model-id $modelId --model-region $modelRegion --job-id "$jobId" --instance-id "$instanceId" --temperature "$temperature" --maxTokens "$maxTokens" --topP "$topP"

if [ $? -ne 0 ]; then
    echo "Failed to run Logs Analyzer. Please check the logs for more details."
    exit 1
fi
`;
}

async function checkLogAnalyzerPreRequisites(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string
) {
    logger.info(`Checking prerequisites for logs analysis with credentialsId: ${credentialsId}, region: ${region}`);

    // Check if the AWS Bedrock Inference Profile is available for the account
    try {
        const availabilityResponse = await getModelAvailability(
            accountId,
            credentialsId,
            region,
            LOGS_ANALYZER_MODEL_ID
        );

        const isSupported =
            availabilityResponse?.agreementAvailability?.status === MODEL_AVAILABILITY_STATUS.AVAILABLE &&
            availabilityResponse?.entitlementAvailability === MODEL_AVAILABILITY_STATUS.AVAILABLE;
        if (isSupported) {
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

    // Check if instance profile has the required permissions -> the following approach needs an additional permissions to get instance profile
    /*
     * DescribeInstance to get the instance profile ARN, use the ARN to get the instance profile details containing the role ARN, use the role ARN to simulate the policy
     */
    try {
        const {
            Reservations: [
                { Instances: [{ IamInstanceProfile: { Arn: instanceProfileArn } = {} } = {}] = [] } = {}
            ] = []
        } = await describeInstance(credentialsId, region, {
            InstanceIds: [activeNodeInstanceId]
        });

        if (isEmpty(instanceProfileArn)) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                'Unable to continue with logs analysis, the instance profile is not attached to the SQL node.'
            );
        }
        const { resourceName } = derivePropertiesFromARN(instanceProfileArn!) || {};
        const params: GetInstanceProfileCommandInput = {
            InstanceProfileName: resourceName?.split('/').pop() || ''
        };
        const { InstanceProfile: { Roles: [{ Arn: instanceIamRoleArn } = {}] = [] } = {} } = await getInstanceProfile(
            credentialsId,
            region,
            params
        );
        const { EvaluationResults: [{ EvalDecision: evaluationDecision } = {}] = [] } =
            (await simulatePrincipalPolicy(credentialsId, region, {
                PolicySourceArn: instanceIamRoleArn,
                ActionNames: ['bedrock:InvokeModelWithResponseStream']
            })) || {};

        if (evaluationDecision !== 'allowed') {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                'Unable to continue with logs analysis, the instance profile does not have the required permissions.'
            );
        }
    } catch (error) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `Unable to continue with logs analysis, we could not get the instance profile details. ${error}`
        );
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

        await checkLogAnalyzerPreRequisites(accountId, credentialsId, region, activeNodeInstanceId);

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
            managedInstance.database_type === DATABASE_TYPE.mssql
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
