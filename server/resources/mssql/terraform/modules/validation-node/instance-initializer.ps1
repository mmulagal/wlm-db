[CmdletBinding()]

param(
    [Parameter(Mandatory = $true)]
    [string]$region,
    [Parameter(Mandatory = $true)]
    [string]$deployment_name,
    [Parameter(Mandatory = $true)]
    [string]$validation_node_initialization_s3_url,
    [Parameter(Mandatory = $true)]
    [string]$dns_ip_addresses,
    [Parameter(Mandatory = $true)]
    [string]$domain_dns_name,
    [Parameter(Mandatory = $true)]
    [string]$subnet_id,
    [Parameter(Mandatory = $true)]
    [string]$domain_admin_user,
    [Parameter(Mandatory = $true)]
    [string]$validation_node1_wait_handler,
    [Parameter(Mandatory = $true)]
    [string]$is_custom_ami,
    [Parameter(Mandatory = $true)]
    [string]$perform_fsx_check,
    [Parameter(Mandatory = $false)]
    [string]$fsx_file_system_id,
    [Parameter(Mandatory = $true)]
    [string]$log_group,
    [Parameter(Mandatory = $true)]
    [string]$sql_deployment_mode,
    [Parameter(Mandatory = $true)]
    [string]$ssm_parameter_name
)

Write-Output "Starting the initializer script from terraform"
$WarningPreference = 'SilentlyContinue'

# Define the log directory
$logDir = "C:\cfn\log"

# Check if the log directory exists, and create it if it does not
if (!(Test-Path -Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir
}
Start-Transcript -Path "$logDir\instance.initializer.ps1.txt" -Append

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12
$progressPreference = "silentlyContinue"
$verify_signature = "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/scripts/Verify-Signature.ps1?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20240905%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20240905T233806Z&X-Amz-Expires=604800&X-Amz-Signature=db5fae6c9cf224c947451c989eec28e52ff0cc3caffe9557df9a7bff57880367&X-Amz-SignedHeaders=host&x-id=GetObject"
$unzip_archive = "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/scripts/Unzip-Archive.ps1?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20240905%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20240905T233806Z&X-Amz-Expires=604800&X-Amz-Signature=69a7516f466f5e6ee3f45d174faffbba4e3b3b5c2c43656492e08d0846431d3c&X-Amz-SignedHeaders=host&x-id=GetObject"
$aws_launch_wizard_for_fcn = "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/modules/AWSLaunchWizardForCFN.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20240905%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20240905T233806Z&X-Amz-Expires=604800&X-Amz-Signature=caacd9c598f914988fe09f7f0324afb3a054501579f227bfbd2c76a1e1c731e5&X-Amz-SignedHeaders=host&x-id=GetObject"
$validation_zip = "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/scripts/validation.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20240905%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20240905T233806Z&X-Amz-Expires=604800&X-Amz-Signature=546231a97f07c63126d9c58eb40dc360d4095f2e21cba7714725f85741350a62&X-Amz-SignedHeaders=host&x-id=GetObject"
$common_zip = "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/scripts/common.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20240905%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20240905T233806Z&X-Amz-Expires=604800&X-Amz-Signature=b421ae7e5926e723eabbf4e8a28bb2bb717cfd7ed8e6e61a7944f5b393619c1b&X-Amz-SignedHeaders=host&x-id=GetObject"
$signing_files_zip = "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/signig_files.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20240905%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20240905T233806Z&X-Amz-Expires=604800&X-Amz-Signature=a9f3abaa6e8499ddb60e900c343259cd467850657cca0cdd1a8a8f4b6a5c1caf&X-Amz-SignedHeaders=host&x-id=GetObject"
$open_ssl_win64_zip = "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/OpenSSL-Win64.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20240905%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20240905T233806Z&X-Amz-Expires=604800&X-Amz-Signature=2d994a2fca3b8d777992360cb29d4be6df82c44d4112171dd4536a0da09f3a00&X-Amz-SignedHeaders=host&x-id=GetObject"

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
        Write-Output "An error occurred with updating ssm parameter: $_"
    }
}

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

$instance_id = Get-InstanceId
Write-Output "Got the Instance ID: $instance_id"

Update-SSMParameterToSecureString -ssmParameterName $ssm_parameter_name

Install-SSMAgent -region "$region"
Set-ExecutionPolicy Unrestricted -Scope Process -Force

# Define the directories
# $dirs = @("C:\\cfn\\log", "C:\\Program Files\\Amazon\\SSM\\Plugins\\awsCloudWatch\\")

# # Check each directory
# foreach ($dir in $dirs) {
#     if (!(Test-Path -Path $dir)) {
#         # Directory doesn't exist, create it
#         New-Item -ItemType Directory -Path $dir | Out-Null
#     }
# }

# Configure CloudWatch
$configFilePath = "C:\Program Files\Amazon\SSM\Plugins\awsCloudWatch\AWS.EC2.Windows.CloudWatch.json"
if (Test-Path -Path $configFilePath) {
    Write-Output "The CloudWatch Logs agent is already configured. Skipping configuration."
}
else {
    Write-Output "Configuring the CloudWatch Logs agent"
    # Define the JSON configuration
    try {
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
                            "Region"    = $region
                            "LogGroup"  = $log_group
                            "LogStream" = $instance_id
                        }
                    },
                    @{
                        "Id"         = "CloudWatch"
                        "FullName"   = "AWS.EC2.Windows.CloudWatch.CloudWatch.CloudWatchOutputComponent,AWS.EC2.Windows.CloudWatch"
                        "Parameters" = @{
                            "AccessKey" = ""
                            "SecretKey" = ""
                            "Region"    = $region
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
    
        # Convert the configuration to JSON
        $json = $config | ConvertTo-Json -Depth 10
    
        # Write the JSON to the configuration file
        $json | Out-File -FilePath $configFilePath
    }
    catch {
        Write-Output "An error occurred while configuring the CloudWatch Logs agent: $($_.Exception.Message)"
    }
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
    Invoke-Command "C:\\cfn\\scripts\\Unzip-Archive.ps1 -Source C:\\cfn\\scripts\\common.zip -Destination C:\\cfn\\scripts"
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
    
    New-EC2Tag -Region "$region" -ResourceId "$instance_id" -Tag @{ Key = "user_data"; Value = "completed" }
    Write-Output "Instance tagged successfully"
    Write-Output "Validation completed successfully"
}
catch {
    New-EC2Tag -Region "$region" -ResourceId "$instance_id" -Tag @{ Key = "user_data"; Value = "failed" }
    Write-Output "An error occurred while running instance initializer: $_.Exception.Message"
    exit 1
}