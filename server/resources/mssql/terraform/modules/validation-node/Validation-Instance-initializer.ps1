[CmdletBinding()]

param(
    [Parameter(Mandatory = $true)]
    [string]$Region,
    [Parameter(Mandatory = $true)]
    [string]$DeploymentName,
    [Parameter(Mandatory = $true)]
    [string]$DnsIpAddresses,
    [Parameter(Mandatory = $true)]
    [string]$DomainDnsName,
    [Parameter(Mandatory = $false)]
    [string]$DCName,    
    [Parameter(Mandatory = $true)]
    [string]$SubnetId,
    [Parameter(Mandatory = $true)]
    [string]$DomainAdminUser,
    [Parameter(Mandatory = $true)]
    [string]$ValidationNode1WaitHandler,
    [Parameter(Mandatory = $true)]
    [string]$IsCustomAmi,
    [Parameter(Mandatory = $true)]
    [string]$PerformFsxCheck,
    [Parameter(Mandatory = $false)]
    [string]$FsxFileSystemId,
    [Parameter(Mandatory = $true)]
    [string]$LogGroup,
    [Parameter(Mandatory = $true)]
    [string]$SqlDeploymentMode,
    [Parameter(Mandatory = $true)]
    [string]$ValidationNodeName
)

Write-Output "Starting the initializer script from terraform"
$WarningPreference = 'SilentlyContinue'

# Define the log directory
$LogDir = "C:\cfn\log"

# Check if the log directory exists, and create it if it does not
if (!(Test-Path -Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir
}
Start-Transcript -Path "$LogDir\validation-instance.initializer.ps1.txt" -Append

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12
$progressPreference = "silentlyContinue"

$VerifySignature = "{{{VerifySignature}}}"
$UnzipArchive = "{{{UnzipArchive}}}"
$AwsLaunchWizardForFcn = "{{{AwsLaunchWizardForFcn}}}"
$ValidationZip = "{{{ValidationZip}}}"
$CommonZip = "{{{CommonZip}}}"
$SigningFilesZip = "{{{SigningFilesZip}}}"
$OpenSslWin64Zip = "{{{OpenSslWin64Zip}}}"

function Get-InstanceId {
    try {
        $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"

        $InstanceId = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
        return $InstanceId
    }
    catch {
        Write-Output "An error occurred while getting token: $_"
        return $null
    }
}

function Install-SSMAgent {
    param(
        [string]$Region
    )

    try {
        $progressPreference = "silentlyContinue"
        $SSMAgentUrl = "https://amazon-ssm-$Region.s3.$Region.amazonaws.com/latest/windows_amd64/AmazonSSMAgentSetup.exe"
        Write-Output "Downloading SSM Agent from $SSMAgentUrl"
        # ponytail: UserData runs as SYSTEM, which has no Desktop folder; download to C:\ instead.
        Invoke-WebRequest $SSMAgentUrl -OutFile "C:\SSMAgent_latest.exe"
        
        # Install the SSM Agent
        Write-Output "Installing SSM Agent"
        Start-Process -FilePath "C:\SSMAgent_latest.exe" -ArgumentList '/S'
        Start-Sleep -Seconds 60
    
        # Set the SSM Agent service to start automatically
        Write-Output "Setting SSM Agent service to start automatically"
        Set-Service -Name AmazonSSMAgent -StartupType Automatic
        Start-Sleep -Seconds 45
    
        # Restart the SSM Agent service
        Write-Output "Restarting SSM Agent service"
        Restart-Service AmazonSSMAgent -Force -ErrorAction Continue
        Start-Sleep -Seconds 30
    }
    catch {
        Write-Output "An error occurred while installing SSM Agent: $_"
    }
}

$InstanceId = Get-InstanceId
Write-Output "Got the Instance ID: $InstanceId"

Install-SSMAgent -Region "$Region"
Set-ExecutionPolicy Unrestricted -Scope Process -Force

# Configure CloudWatch Logs via the unified CloudWatch Agent (the legacy
# AWS.EC2.Windows.CloudWatch SSM plugin was removed in SSM Agent 3.x), installed
# on-demand through the AWS-ConfigureAWSPackage SSM document.
# ponytail: do not treat amazon-cloudwatch-agent.json as "already configured" — it is
# written before install/fetch-config; a failed first attempt must be retriable on re-run.
$CwConfigPath = "C:\cfn\config\amazon-cloudwatch-agent.json"
Write-Output "Configuring the CloudWatch Logs agent"
try {
    $CwConfigDir = Split-Path -Path $CwConfigPath -Parent
    if (!(Test-Path -Path $CwConfigDir)) {
        New-Item -ItemType Directory -Path $CwConfigDir | Out-Null
    }
    $config = @{
        agent = @{ region = "$Region" }
        logs  = @{
            logs_collected = @{
                files = @{
                    collect_list = @(
                        @{
                            file_path         = "C:\cfn\log\*.txt"
                            log_group_name    = "$LogGroup"
                            log_stream_name   = "{instance_id}"
                            timestamp_format  = "%Y-%m-%d %H:%M:%S,%f"
                        }
                    )
                }
            }
        }
    }
    ($config | ConvertTo-Json -Depth 10) | Out-File -FilePath $CwConfigPath -Encoding ascii

    $AgentCtl = "C:\Program Files\Amazon\AmazonCloudWatchAgent\amazon-cloudwatch-agent-ctl.ps1"
    if (-not (Test-Path $AgentCtl)) {
        Write-Output "AmazonCloudWatchAgent not found. Installing via AWS-ConfigureAWSPackage..."
        if (-not (Get-Command Send-SSMCommand -ErrorAction SilentlyContinue)) {
            Import-Module AWSPowerShell -ErrorAction SilentlyContinue
        }
        $CommandId = (Send-SSMCommand -DocumentName 'AWS-ConfigureAWSPackage' -InstanceId $InstanceId -Region $Region -Parameter @{ action = 'Install'; name = 'AmazonCloudWatchAgent' }).CommandId
        # ponytail: bounded 5-minute poll instead of an SSM waiter; if the install runs
        # long this just moves on and CW Logs picks up on the next setup re-run.
        $Deadline = (Get-Date).AddMinutes(5)
        do {
            Start-Sleep -Seconds 10
            $InvocationStatus = (Get-SSMCommandInvocation -CommandId $CommandId -InstanceId $InstanceId -Region $Region -ErrorAction SilentlyContinue).Status
        } while ($InvocationStatus -in @('Pending', 'InProgress', 'Delayed', $null) -and (Get-Date) -lt $Deadline)
        if ($InvocationStatus -ne 'Success') {
            Write-Warning "AmazonCloudWatchAgent install did not confirm success (status: $InvocationStatus)."
        }
    }
    if (Test-Path $AgentCtl) {
        & $AgentCtl -a fetch-config -m ec2 -s -c file:$CwConfigPath
    }
    else {
        Write-Warning "AmazonCloudWatchAgent is not installed; skipping CloudWatch Logs configuration."
    }
}
catch {
    Write-Output "An error occurred while configuring the CloudWatch Logs agent: $($_.Exception.Message)"
}

function Invoke-WebRequestWithRetry {
    param(
        [string]$Uri,
        [string]$OutFile
    )

    # Create the directory if it doesn't exist
    $OutDir = Split-Path -Path $OutFile -Parent
    if (!(Test-Path -Path $OutDir)) {
        New-Item -ItemType Directory -Path $OutDir | Out-Null
    }

    # Download the file
    try {
        Write-Output "Starting to download file from $Uri"
        Invoke-WebRequest -Uri $Uri -OutFile $OutFile -ErrorAction Stop
        Write-Output "Successfully downloaded file to $OutFile"
    }
    catch {
        Write-Output "An error occurred while downloading file: $_"
        Write-Error $_.Exception.Message
        throw $_.Exception.Message
    }
}

function Invoke-CommandExecution {
    param(
        [string]$command
    )

    try {
        Write-Output "Starting to execute command: $command"
        & powershell.exe -Command $command
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code $LASTEXITCODE"
        }
        Write-Output "Successfully executed command: $command"
    }
    catch {
        Write-Output "An error occurred while executing command: $_"
        Write-Error $_.Exception.Message
        throw $_.Exception.Message
    }
}

try {
    Write-Output "Downloading the files"
    $ProgressPreference = 'SilentlyContinue'

    Invoke-WebRequestWithRetry -Uri "$VerifySignature" -OutFile "C:\\cfn\\scripts\\Verify-Signature.ps1"
    Invoke-WebRequestWithRetry -Uri "$UnzipArchive" -OutFile "C:\\cfn\\scripts\\Unzip-Archive.ps1"
    Invoke-WebRequestWithRetry -Uri "$AwsLaunchWizardForFcn" -OutFile "C:\\cfn\\modules\\AWSLaunchWizardForCFN.zip"
    Invoke-WebRequestWithRetry -Uri "$ValidationZip" -OutFile "C:\\cfn\\scripts\\validation.zip"
    Invoke-WebRequestWithRetry -Uri "$SigningFilesZip" -OutFile "C:\\cfn\\signig_files.zip"
    Invoke-WebRequestWithRetry -Uri "$OpenSslWin64Zip" -OutFile "C:\\cfn\\OpenSSL-Win64.zip"
    Invoke-WebRequestWithRetry -Uri "$CommonZip" -OutFile "C:\\cfn\\scripts\\common.zip"
    Write-Output "Downloaded the files successfully"

    Invoke-CommandExecution "C:\\cfn\\scripts\\Unzip-Archive.ps1 -Source C:\\cfn\\signig_files.zip -Destination C:\\cfn"
    Invoke-CommandExecution "C:\\cfn\\scripts\\Unzip-Archive.ps1 -Source C:\\cfn\\OpenSSL-Win64.zip -Destination C:\\cfn"
    # comment it only locally since having issue with signature verification
    Invoke-CommandExecution "C:\\cfn\\scripts\\Verify-Signature.ps1 -FilePath C:\\cfn\\scripts\\validation.zip -SignatureFilePath C:\\cfn\\signig_files\\validation.sig -PubFilePath C:\\cfn\\signig_files\\validation.pub -ResourceID '$ValidationNodeName' -Stackname '$DeploymentName'"
    Invoke-CommandExecution "C:\\cfn\\scripts\\Unzip-Archive.ps1 -Source C:\\cfn\\scripts\\validation.zip -Destination C:\\cfn\\scripts"
    Invoke-CommandExecution "C:\\cfn\\scripts\\Unzip-Archive.ps1 -Source C:\\cfn\\scripts\\common.zip -Destination C:\\cfn\\scripts"
    Write-Output "Unzipped the files successfully"

    Invoke-CommandExecution "C:\\cfn\\scripts\\common\\Update-DNSServers.ps1 -DNSIpAddresses '${DnsIpAddresses}' -Stackname '$DeploymentName' -ResourceID '$ValidationNodeName' -WaitHandler '${ValidationNode1WaitHandler}'"
    Invoke-CommandExecution "C:\\cfn\\scripts\\validation\\Validate-VPCConnectivity.ps1 -subnet '${SubnetId}' -region '$Region' -Stackname '$DeploymentName' -ResourceID '$ValidationNodeName' -WaitHandler '${ValidationNode1WaitHandler}' -IsTerraform 1"
    Invoke-CommandExecution "C:\\cfn\\scripts\\validation\\Validate-Credentials.ps1 -DomainName '${DomainDnsName}' -DCName '${DCName}' -UserName '${DomainAdminUser}' -isSecretManagerSupported 0 -Stackname '$DeploymentName' -Parentstackname '$DeploymentName' -ResourceID '$ValidationNodeName' -WaitHandler '${ValidationNode1WaitHandler}' -IsTerraform 1"
    # run this validate-fsxconnecitivity.ps1 script only for existing fsx file system
    if (![string]::IsNullOrEmpty($FsxFileSystemId)) {
        Invoke-CommandExecution "C:\\cfn\\scripts\\validation\\Validate-FsxConnectivity.ps1 -PerformFSxCheck '${PerformFsxCheck}' -FSxFileSystemId '$FsxFileSystemId' -FSxRegion '$Region' -Stackname '$DeploymentName' -Parentstackname '$DeploymentName' -ResourceID '$ValidationNodeName' -WaitHandler '${ValidationNode1WaitHandler}' -IsTerraform 1"
    }
    # this runs for the custom ami verifications
    Invoke-CommandExecution "C:\\cfn\\scripts\\validation\\Validate-Ami.ps1 -IsCustomAmi '${IsCustomAmi}' -Region '$Region' -SQLDeploymentMode '$SqlDeploymentMode' -DomainDNSName '${DomainDnsName}' -Stackname '$DeploymentName' -Parentstackname '$DeploymentName' -ResourceID '$ValidationNodeName' -WaitHandler '${ValidationNode1WaitHandler}' -IsTerraform 1"
    
    New-EC2Tag -Region "$Region" -ResourceId "$InstanceId" -Tag @{ Key = "user_data"; Value = "completed" }

    Write-Output "Instance tagged successfully"
    Write-Output "Validation completed successfully"
    # Shutdown command
    shutdown /s /t 60
}
catch {
    New-EC2Tag -Region "$Region" -ResourceId "$InstanceId" -Tag @{ Key = "user_data"; Value = "failed" }
    Write-Output "An error occurred while running instance initializer: $_.Exception.Message"
    exit 1
}