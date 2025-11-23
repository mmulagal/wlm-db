import { InferenceConfigType } from '../../routes/types/logs-analyzer.types';
import getLogger from '../../utils/logger';
import { LOG_LEVEL, PRE_REQ_MESSAGES } from '../../utils/logs-analyzer/logs-analyzer-consts';

const logger = getLogger();

function getWindowsBedrockAvailabilityCheckScript(region: string, modelId: string) {
    return `
# Bedrock Availability Check Script
$moduleFound = Get-Module -ListAvailable -Name AWS.Tools.BedrockRuntime

$result = @{
        success = $true
        response = $null
        error = $null
    }
if (-not $moduleFound) {
    $result = @{
        success = $false
        response = $null
        error = "${PRE_REQ_MESSAGES.BEDROCK_TOOL_NOT_FOUND}"
    }
    $result | ConvertTo-Json -Depth 5
} elseif ($moduleFound) {
    try {
        Import-Module AWS.Tools.BedrockRuntime -ErrorAction Stop

        $region = "${region}"
        $modelId = "${modelId}"

        $contentBlock = New-Object Amazon.BedrockRuntime.Model.ContentBlock
        $contentBlock.Text = "Hello"
        $message = New-Object Amazon.BedrockRuntime.Model.Message
        $message.Role = "user"
        $message.Content = $contentBlock
        $response = Invoke-BDRRConverse -ModelId $modelId -Messages $message -Region $region
        $result = @{
            success = $true
            response = $response | ConvertTo-Json -Depth 10
            error = $null
        }
    } catch {
        $result = @{
            success = $false
            response = $null
            error = "${PRE_REQ_MESSAGES.BEDROCK_NW_CONFIGURATION} . $_.Exception.Message"
        }
    }
    $result | ConvertTo-Json -Depth 5
    exit 0
}
`;
}

function getLinuxBedrockAvailabilityCheckScript(region: string, modelId: string): string {
    return `
    # Bedrock Availability Check Linux Script
    #!/bin/bash

# Check for AWS CLI availability
if ! command -v aws &> /dev/null; then
    echo '{"success": false, "response": null, "error": "'"${PRE_REQ_MESSAGES.AWS_CLI_NOT_FOUND}"'"}'
    exit 1
fi

REGION="${region}"
MODEL_ID="${modelId}"

# Invoke the model using the inference profile ARN and JSON string body
RESPONSE=$(
aws bedrock-runtime converse \
  --region $REGION \
  --model-id $MODEL_ID \
  --messages '[{"role":"user","content":[{"text":"Hello, how are you?"}]}]' 2>&1)

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo '{"success": true, "response": '"$RESPONSE"', "error": null}'
else
    # Escape double quotes and backslashes in error message for valid JSON
    ESCAPED_ERROR=$(echo "$RESPONSE" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
    echo '{"success": false, "response": null, "error": '"$ESCAPED_ERROR"'}'
fi
`;
}

function getWindowsPrepareScript(scriptParams: {
    s3SignedUrl: string;
    packageName: string;
    logsPath: string;
    sqlAuthEnabled?: boolean;
    databaseInstanceName?: string;
    version: string;
    instanceId: string;
    region: string;
    logsCountToConsider: number;
    logsAnalyzerFromTimestamp: number;
    inferenceProfileArn: string;
    jobId?: string;
    inferenceConfig?: InferenceConfigType;
    logLevel?: string;
    logsWindowDuration?: number;
    monitorUsage?: boolean;
}): string {
    logger.debug('Generating Windows prepare script with params:', scriptParams);
    const {
        s3SignedUrl,
        packageName,
        logsPath,
        sqlAuthEnabled,
        databaseInstanceName,
        version,
        instanceId,
        region,
        inferenceProfileArn,
        jobId,
        inferenceConfig = {},
        logsAnalyzerFromTimestamp,
        logsCountToConsider,
        logLevel = LOG_LEVEL,
        logsWindowDuration = 24,
        monitorUsage = false
    } = scriptParams;

    const { temperature = 0.5, maxTokens = 5000, topP = 0.9 } = inferenceConfig;

    return `
    # Logs Analysis Windows Prepare Script
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
        $s3SignedUrl = "${s3SignedUrl}";
        $packageName = "${packageName}";
        $logsPath = "${encodeURIComponent(logsPath)}";
        $sqlAuthEnabled = $${sqlAuthEnabled};
        $databaseInstanceName = "${databaseInstanceName}";
        $version = "${version}";
        $instanceId = "${instanceId}";
        $region = "${region}";
        $jobId = "${jobId}";
        $modelId = "${inferenceProfileArn}";
        $modelRegion = "${region}";
        $temperature = ${temperature};
        $maxTokens = ${maxTokens};
        $topP = ${topP};
        $logLevel = "${logLevel}";
        $logsCountToConsider = ${logsCountToConsider};
        $timestamp = ${logsAnalyzerFromTimestamp};
        $logsWindowDuration = ${logsWindowDuration};
        $monitorUsage = $${monitorUsage};
        $databaseType = "mssql";

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
                        throw "Download failed after $Retries attempts. $_"
                    }
                    Start-Sleep -Seconds 5
                }
            }
        }

        $downloadDir = "C:/Program Files/NetApp/netapp-logs-analyzer"
        if (-not (Test-Path $downloadDir)) {
            New-Item -ItemType Directory -Path $downloadDir | Out-Null
        }
        Set-Location -Path $downloadDir
        $filePath = ".\\$packageName-$version.exe"
        if (-not (Test-Path $filePath)) {
            Invoke-RetryCommand {
                Invoke-WebRequest -Uri $s3SignedUrl -OutFile $filePath -ErrorAction Stop -TimeoutSec 10
            }           
            try {
                icacls $filePath /grant Everyone:F > $null 2>&1
            } catch {
                throw "Failed to set permissions: $($_.Exception.Message)"
            }
            
            Get-ChildItem -Path . -Filter "$packageName-*.exe" | Where-Object { $_.Name -ne "$packageName-$version.exe" } | Remove-Item -Force
        }


        try {
            if (-Not (Test-Path $filePath)) {
                throw "The specified file does not exist."
            }

            $argumentList = @(
                '--logs-path', $logsPath,
                '--database-instance-name', $databaseInstanceName,
                '--log-level', $logLevel,
                '--region', $region,
                '--model-id', $modelId,
                '--model-region', $modelRegion,
                '--job-id', $jobId,
                '--instance-id', $instanceId,
                '--temperature', $temperature,
                '--max-tokens', $maxTokens,
                '--top-p', $topP,
                '--logs-count-to-consider', $logsCountToConsider,
                '--timestamp', $timestamp,
                '--time-window-hours', $logsWindowDuration,
                '--database-type', $databaseType
            )
            if ($sqlAuthEnabled) { $argumentList += '--sql-auth-enabled' }
            if ($monitorUsage) { $argumentList += '--monitor-usage' }
            Start-Process -FilePath $filePath -ArgumentList $argumentList -NoNewWindow -Wait  > $null 2>&1
        } catch {
            throw "Failed to run Logs Analyzer: $($_.Exception.Message)"
        }

        $result = @{
            success = $true
            error = $null
        }
    } catch {
        $result = @{
            success = $false
            error = $_.Exception.Message
        }
    }
    $result | ConvertTo-Json -Depth 5
    exit 0
    `;
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
    logLevel?: string;
    databaseType?: string;
    logsAnalyzerFromTimestamp?: number;
    logsWindowDuration?: number;
    databaseInstanceName?: string;
}): string {
    logger.debug('Generating Linux prepare script with params:', scriptParams);
    const {
        s3SignedUrl,
        packageName,
        logsPath,
        version,
        instanceId,
        region,
        inferenceProfileArn,
        jobId,
        inferenceConfig = {},
        logLevel = LOG_LEVEL,
        databaseType,
        logsAnalyzerFromTimestamp,
        logsWindowDuration = 24,
        databaseInstanceName
    } = scriptParams;
    const { temperature = 0.5, maxTokens = 5000, topP = 0.9 } = inferenceConfig;

    return `
    
    # Logs Analysis Linux Prepare Script
    #!/bin/bash

    s3SignedUrl="${s3SignedUrl}"
    packageName="${packageName}"
    logsPath="${logsPath}"
    version="${version}"
    instanceId="${instanceId}"
    region="${region}"
    jobId="${jobId}"
    modelId="${inferenceProfileArn}"
    modelRegion="${region}"
    temperature="${temperature}"
    maxTokens="${maxTokens}"
    topP="${topP}"
    logLevel="${logLevel}"
    databaseType="${databaseType}"
    databaseInstanceName="${databaseInstanceName}"
    timestamp="${logsAnalyzerFromTimestamp}"
    logsWindowDuration="${logsWindowDuration}"

retry_command() {
    local retries=5
    local count=0
    while [ $count -lt $retries ]; do
        "$@" && return 0 || {
            count=$((count + 1))
            sleep 5
        }
    done
    return 1
}

filePath="./$packageName-$version"
if [ ! -f "$filePath" ]; then
    retry_command curl -sS -fSL -o "$filePath" "$s3SignedUrl"

    find . -name "$packageName-*" ! -name "$packageName-$version" -exec rm -f {} +
fi

chmod +x "$filePath"

if [ ! -f "$filePath" ]; then
    exit 1
fi

"$filePath" --logs-path "$logsPath" --log-level "$logLevel" --region "$region" --model-id $modelId --model-region $modelRegion --job-id "$jobId" --instance-id "$instanceId" --temperature "$temperature" --maxTokens "$maxTokens" --topP "$topP" --database-type "$databaseType" --database-instance-name "$databaseInstanceName" --timestamp "$timestamp" --time-window-hours "$logsWindowDuration"

if [ $? -ne 0 ]; then
    exit 1
fi
`;
}

export {
    getWindowsBedrockAvailabilityCheckScript,
    getLinuxBedrockAvailabilityCheckScript,
    getWindowsPrepareScript,
    getLinuxPrepareScript
};
