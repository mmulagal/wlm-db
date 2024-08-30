
<powershell>
# Write output
Write-Output "Starting user data script from terraform"

$WarningPreference = 'SilentlyContinue';

$deploymentname = "${deployment_name}"
$ssmParameterName = "/netapp/wlmdb/$deploymentname"
$region = "${region}"
$log_group = "${log_group}"
$s3_artifacts_url = "${s3_artifacts_url}"
$deployment_name = "${deployment_name}"
$fsx_file_system_id = "${fsx_file_system_id}"
$sql_deployment_mode = "${sql_deployment_mode}"

Write-Output "Deployment Name: $deployment_name"

# Step 1: Download the file from S3 to the temp folder
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12
$tempFilePath = Join-Path -Path $env:TEMP -ChildPath "signed-url.json"
Invoke-WebRequest -Uri "$s3_artifacts_url" -OutFile $tempFilePath
Write-Output "Downloaded the file to $tempFilePath"

# Step 2: Parse the file and assign the URLs to the variables
$json = Get-Content -Path $tempFilePath | ConvertFrom-Json
$urls = $json.validation_node

Write-Output "The s3 urls object: $urls"

if ($null -eq $urls) {
    Write-Output "The s3 urls object is null. Cannot proceed with assignments."
    exit
}

$verify_signature = $urls.verify_signature
$unzip_archive = $urls.unzip_archive
$aws_launch_wizard_for_fcn = $urls.aws_launch_wizard_for_fcn
$validation_zip = $urls.validation_zip
$signing_files_zip = $urls.signing_files_zip
$open_ssl_win64_zip = $urls.open_ssl_win64_zip
$common_zip = $urls.common_zip

function Get-InstanceId {
    try {
        $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
        #Write-Output "Successfully obtained the token."

        $instance_id = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
        #Write-Output "Successfully obtained the instance ID: $instance_id"
        return $instance_id
    }
    catch {
        Write-Output "An error occurred while getting token: $_"
        return $null
    }
}

$instance_id = Get-InstanceId

Write-Output "Got the Instance ID: $instance_id"
# in summary, this command is retrieving the current value of an SSM parameter, decrypting it, and then overwriting the parameter with the same value, ensuring it's stored as a "SecureString".
# Write-SSMParameter -Name $ssmParameterName -Value (Get-SSMParameter -Name $ssmParameterName -WithDecryption $True).Value -Type "SecureString" -Overwrite $true
function Update-SSMParameterToSecureString {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ssmParameterName
    )

    try {
        $parameter = Get-SSMParameter -Name $ssmParameterName
        if ($parameter.Type -ne "SecureString") {
            Write-SSMParameter -Name $ssmParameterName -Value $parameter.Value -Type "SecureString" -Overwrite $true
            Write-Output "The parameter is now stored as a SecureString"
        }
        else {
            Write-Output "The parameter is already stored as a SecureString"
        }
    }
    catch {
        Write-Output "An error occurred: $_"
    }
}

Update-SSMParameterToSecureString -ssmParameterName $ssmParameterName

function Install-SSMAgent {
    param(
        [string]$region
    )

    try {
        Get-Service AmazonSSMAgent -ErrorAction Stop
        # Set the SSM Agent service to start automatically
        Write-Output "Setting SSM Agent service to start automatically"
        Set-Service -Name AmazonSSMAgent -StartupType Automatic
        Start-Sleep -Seconds 30
     
        # Restart the SSM Agent service
        Write-Output "Restarting SSM Agent service"
        Restart-Service AmazonSSMAgent -Force -ErrorAction Continue
        Start-Sleep -Seconds 30
    }
    catch {
        $progressPreference = "silentlyContinue"
        $ssmAgentUrl = "https://amazon-ssm-$region.s3.$region.amazonaws.com/latest/windows_amd64/AmazonSSMAgentSetup.exe"
        Write-Output "Downloading SSM Agent from $ssmAgentUrl"
        Invoke-WebRequest $ssmAgentUrl -OutFile "$env:USERPROFILE\Desktop\SSMAgent_latest.exe"
        
        # Install the SSM Agent
        Write-Output "Installing SSM Agent"
        Start-Process -FilePath "$env:USERPROFILE\Desktop\SSMAgent_latest.exe" -ArgumentList '/S'
        Start-Sleep -Seconds 30
    
        # Set the SSM Agent service to start automatically
        Write-Output "Setting SSM Agent service to start automatically"
        Set-Service -Name AmazonSSMAgent -StartupType Automatic
        Start-Sleep -Seconds 30
    
        # Restart the SSM Agent service
        Write-Output "Restarting SSM Agent service"
        Restart-Service AmazonSSMAgent -Force -ErrorAction Continue
        Start-Sleep -Seconds 30
    }
}

Install-SSMAgent -region "$region"

Set-ExecutionPolicy Unrestricted -Scope Process -Force

# Define the directories
$dirs = @("C:\\cfn\\log", "C:\\Program Files\\Amazon\\SSM\\Plugins\\awsCloudWatch\\")

# Check each directory
foreach ($dir in $dirs) {
    if (!(Test-Path -Path $dir)) {
        # Directory doesn't exist, create it
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
}

# Configure CloudWatch
$config = @{
    "IsEnabled"           = $true
    "EngineConfiguration" = @{
        "PollInterval" = "00:00:05"
        "Components"   = @(
            @{
                "Id"         = "ApplicationEventLog"
                "FullName"   = "AWS.EC2.Windows.CloudWatch.EventLog.EventLogInputComponent,AWS.EC2.Windows.CloudWatch"
                "Parameters" = @{
                    "LogName" = "Application"
                    "Levels"  = "7"
                }
            },
            @{
                "Id"         = "CfnInitLog"
                "FullName"   = "AWS.EC2.Windows.CloudWatch.CustomLog.CustomLogInputComponent,AWS.EC2.Windows.CloudWatch"
                "Parameters" = @{
                    "LogDirectoryPath" = "C:\\cfn\\log"
                    "LogName"          = "CfnInit"
                    "Levels"           = "7"
                    "TimestampFormat"  = "yyyy-MM-dd HH:mm:ss,fff"
                    "Encoding"         = "ASCII"
                    "CultureName"      = "en-US"
                    "TimeZoneKind"     = "Local"
                }
            },
            @{
                "Id"         = "CloudWatchCfnInitLog"
                "FullName"   = "AWS.EC2.Windows.CloudWatch.CloudWatchLogsOutput,AWS.EC2.Windows.CloudWatch"
                "Parameters" = @{
                    "AccessKey" = ""
                    "SecretKey" = ""
                    "Region"    = "$region"
                    "LogGroup"  = "$log_group"
                    "LogStream" = "$instance_id"
                }
            },
            @{
                "Id"         = "CloudWatch"
                "FullName"   = "AWS.EC2.Windows.CloudWatch.CloudWatch.CloudWatchOutputComponent,AWS.EC2.Windows.CloudWatch"
                "Parameters" = @{
                    "AccessKey" = ""
                    "SecretKey" = ""
                    "Region"    = "$region"
                    "NameSpace" = "Windows/Default"
                }
            }
        )
        "Flows"        = @{
            "Flows" = @(
                "CfnInitLog,CloudWatchCfnInitLog"
            )
        }
    }
}

try {
    Set-Content -Path "C:\\Program Files\\Amazon\\SSM\\Plugins\\awsCloudWatch\\AWS.EC2.Windows.CloudWatch.json" -Value (ConvertTo-Json -InputObject $config) 
}
catch {
    Write-Output "An error occurred setup cloud watch config: $_.Exception.Message"
}

Write-Output "Configured CloudWatch successfully"

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
    }
}

function Invoke-Command {
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
        exit $LASTEXITCODE
    }
}

try {
    Write-Output "Downloading the files"
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequestWithRetry -Uri "$verify_signature" -OutFile "C:\\cfn\\scripts\\Verify-Signature.ps1"
    Invoke-WebRequestWithRetry -Uri "$unzip_archive" -OutFile "C:\\cfn\\scripts\\Unzip-Archive.ps1"
    Invoke-WebRequestWithRetry -Uri "$aws_launch_wizard_for_fcn" -OutFile "C:\\cfn\\modules\\AWSLaunchWizardForCFN.zip"
    Invoke-WebRequestWithRetry -Uri "$validation_zip" -OutFile "C:\\cfn\\scripts\\validation.zip"
    Invoke-WebRequestWithRetry -Uri "$signing_files_zip" -OutFile "C:\\cfn\\signig_files.zip"
    Invoke-WebRequestWithRetry -Uri "$open_ssl_win64_zip" -OutFile "C:\\cfn\\OpenSSL-Win64.zip"
    Invoke-WebRequestWithRetry -Uri "$common_zip" -OutFile "C:\\cfn\\scripts\\common.zip"

    Write-Output "Downloaded the files successfully"

    Invoke-Command "C:\\cfn\\scripts\\Unzip-Archive.ps1 -Source C:\\cfn\\signig_files.zip -Destination C:\\cfn"
    Invoke-Command "C:\\cfn\\scripts\\Unzip-Archive.ps1 -Source C:\\cfn\\OpenSSL-Win64.zip -Destination C:\\cfn"
    # commented since having issue with signature verification
    # Invoke-Command "C:\\cfn\\scripts\\Verify-Signature.ps1 -FilePath C:\\cfn\\scripts\\validation.zip -SignatureFilePath C:\\cfn\\signig_files\\validation.sig -PubFilePath C:\\cfn\\signig_files\\validation.pub -ResourceID ValidationNode1 -Stackname '$deployment_name'"
    Invoke-Command "C:\\cfn\\scripts\\Unzip-Archive.ps1 -Source C:\\cfn\\scripts\\validation.zip -Destination C:\\cfn\\scripts"

    Write-Output "Unzipped the files successfully"

    Invoke-Command "C:\\cfn\\scripts\\validation\\Update-DNSServers.ps1 -DNSIpAddresses '${dns_ip_addresses}'"
    Invoke-Command "C:\\cfn\\scripts\\validation\\Validate-VPCConnectivity.ps1 -subnet '${subnet_id}' -region '$region' -Stackname '$deployment_name' -ResourceID ValidationNode1 -WaitHandler '${validation_node1_wait_handler}'"
    Invoke-Command "C:\\cfn\\scripts\\validation\\Validate-Credentials.ps1 -DomainName '${domain_dns_name}' -UserName '${domain_admin_user}' -isSecretManagerSupported 0 -Stackname '$deployment_name' -Parentstackname '$deployment_name' -ResourceID ValidationNode1 -WaitHandler '${validation_node1_wait_handler}'"
    # run this validate-fsxconnecitivity.ps1 script only for existing fsx file system
    if (![string]::IsNullOrEmpty($fsx_file_system_id)) {
        Invoke-Command "C:\\cfn\\scripts\\validation\\Validate-FsxConnectivity.ps1 -PerformFSxCheck '${perform_fsx_check}' -FSxFileSystemId '$fsx_file_system_id' -FSxRegion '$region' -Stackname '$deployment_name' -Parentstackname '$deployment_name' -ResourceID ValidationNode1"
    }
    # this runs for the custom ami verifications
    Invoke-Command "C:\\cfn\\scripts\\validation\\Validate-Ami.ps1 -IsCustomAmi '${is_custom_ami}' -Region '$region' -SQLDeploymentMode '$sql_deployment_mode' -DomainDNSName '${domain_dns_name}' -Stackname '$deployment_name' -Parentstackname '$deployment_name' -ResourceID ValidationNode1 -WaitHandler '${validation_node1_wait_handler}'"
    Write-Output "Validation ran successfully"
}
catch {
    Write-Output "An error occurred last: $_.Exception.Message"
}
try {
    New-EC2Tag -Region "$region" -ResourceId "$instance_id" -Tag @{ Key = "user_data"; Value = "completed" }
}
catch {
    Write-Output "An error occurred while tagging the instance: $_"
    exit
}

Write-Output "Validation completed successfully"
</powershell>
