import { InferenceConfigType } from '../../routes/types/logs-analyzer.types';
import getLogger from '../../utils/logger';

const logger = getLogger();

function getWindowsBedrockAvailabilityCheckScript(region: string, modelId: string) {
    return `
# Ensure AWS CLI is installed
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "AWS CLI not found. Downloading and installing AWS CLI v2..."
    $installer = "$env:TEMP\\AWSCLIV2.msi"
    Invoke-WebRequest -Uri "https://awscli.amazonaws.com/AWSCLIV2.msi" -OutFile $installer
    Start-Process msiexec.exe -ArgumentList "/i \`"$installer\`" /qn" -Wait
    Remove-Item $installer
    $env:Path += ";C:\\Program Files\\Amazon\\AWSCLIV2"
}

$region = "${region}"
$modelId = "${modelId}"

try {
   $messagesPath = "$env:TEMP\\messages.json"
$messagesJson = '[{"role":"user","content":[{"text":"Hello"}]}]'
$sw = New-Object System.IO.StreamWriter($messagesPath, $false, (New-Object System.Text.UTF8Encoding($false)))
$sw.Write($messagesJson)
$sw.Close()

$response = aws bedrock-runtime converse --region $region --model-id $modelId --messages file://$messagesPath

    if ($LASTEXITCODE -eq 0) {
        $result = @{
            success = $true
            response = $response
            error = $null
        }
    } else {
        $result = @{
            success = $false
            response = $null
            error = $response
        }
    }
    $result | ConvertTo-Json -Depth 5
} catch {
    $result = @{
        success = $false
        response = $null
        error = $_.Exception.Message
    }
    $result | ConvertTo-Json -Depth 5
}
`;
}

function getLinuxBedrockAvailabilityCheckScript(region: string, modelId: string): string {
    return `#!/bin/bash

# Check for AWS CLI v2, install if not present


REGION="${region}"
MODEL_ID="${modelId}"

# Prepare the request body as a JSON string
REQUEST_BODY='[{"role":"user","content":"Hello, how are you?"}]'

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
    version: string;
    instanceId: string;
    region: string;
    inferenceProfileArn: string;
    jobId?: string;
    inferenceConfig?: InferenceConfigType;
}): string {
    logger.debug('Generating Windows prepare script with params:', scriptParams);
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
    $modelRegion = "${region}";
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

export {
    getWindowsBedrockAvailabilityCheckScript,
    getLinuxBedrockAvailabilityCheckScript,
    getWindowsPrepareScript,
    getLinuxPrepareScript
};
