
$WarningPreference = 'SilentlyContinue';
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12
$token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
$instance_id = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
# $FailureReason = "CF endpoint is not reachable. Check your subnet outbound connectivity."
# try {
#   $Response = Invoke-WebRequest -Uri 'https://cloudformation.${region}.amazonaws.com' -UseBasicParsing
#   $StatusCode = $Response.StatusCode
# }
# catch { 
#   Write-Output $_
#   $StatusCode = 0
# }
# Write-Output $StatusCode
# if ($StatusCode -eq 200) {

$deploymentname = "${deployment_name}"
$ssmParameterName = "/netapp/wlmdb/$deploymentname"
$region = "${region}"
$log_group = "${log_group}"
$s3_artifacts_url = "${s3_artifacts_url}"
$deployment_name = "${deployment_name}"

Write-SSMParameter -Name $ssmParameterName -Value (Get-SSMParameter -Name $ssmParameterName -WithDecryption $True).Value -Type "SecureString" -Overwrite $true
    
function Install-SSMAgent {
    param(
        [string]$region
    )

    try {
        Get-Service AmazonSSMAgent -ErrorAction Stop
    }
    catch {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12
        $progressPreference = "silentlyContinue"
        $ssmAgentUrl = "https://amazon-ssm-$region.s3.$region.amazonaws.com/latest/windows_amd64/AmazonSSMAgentSetup.exe"
        Invoke-WebRequest $ssmAgentUrl -OutFile "$env:USERPROFILE\Desktop\SSMAgent_latest.exe"
    }
}

# Call the function
Install-SSMAgent -region "$region"

Set-ExecutionPolicy Unrestricted -Scope Process -Force

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
  
    # Install SSM agent
    Write-Output "try{Start-Process -FilePath $env:USERPROFILE\Desktop\SSMAgent_latest.exe -ArgumentList '/S'}catch{Write-Host $_.exception}" > C:/install-ssm.ps1
    powershell.exe -Command C:/install-ssm.ps1
    sleep 30
    powershell.exe -Command "Set-Service -Name AmazonSSMAgent -StartupType Automatic"
    sleep 30
    Write-Output "try{Restart-Service AmazonSSMAgent -Force -ErrorAction Continue}catch{Write-Host $_.exception}" > C:/restart-ssm.ps1
    powershell.exe -Command C:/restart-ssm.ps1
    sleep 30    
}
catch {
    Write-Output "An error occurred install ssm: $_.Exception.Message"
}

function Invoke-WebRequestWithRetry {
    param (
        [string]$Uri,
        [string]$OutFile
    )

    try {
        Invoke-WebRequest -Uri $Uri -OutFile $OutFile -ErrorAction Stop
    }
    catch {
        Write-Output "Failed to download from $Uri. Error: $_"
        throw $_
    }
}

function Invoke-Command {
    param(
        [string]$command
    )

    try {
        & powershell.exe -Command $command
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code $LASTEXITCODE"
        }
    }
    catch {
        Write-Error $_.Exception.Message
        exit $LASTEXITCODE
    }
}

# Usage
try {
    Invoke-WebRequestWithRetry -Uri "$s3_artifacts_url/scripts/Verify-Signature.ps1" -OutFile "C:\\cfn\\scripts\\Verify-Signature.ps1"
    Invoke-WebRequestWithRetry -Uri "$s3_artifacts_url/scripts/Unzip-Archive.ps1" -OutFile "C:\\cfn\\scripts\\Unzip-Archive.ps1"
    Invoke-WebRequestWithRetry -Uri "$s3_artifacts_url/modules/AWSLaunchWizardForCFN.zip" -OutFile "C:\\cfn\\modules\\AWSLaunchWizardForCFN.zip"
    Invoke-WebRequestWithRetry -Uri "$s3_artifacts_url/scripts/validation.zip" -OutFile "C:\\cfn\\scripts\\validation.zip"
    Invoke-WebRequestWithRetry -Uri "$s3_artifacts_url/signig_files.zip" -OutFile "C:\\cfn\\signig_files.zip"
    Invoke-WebRequestWithRetry -Uri "$s3_artifacts_url/OpenSSL-Win64.zip" -OutFile "C:\\cfn\\OpenSSL-Win64.zip"


    Invoke-Command "C:\\cfn\\scripts\\Unzip-Archive.ps1 -Source C:\\cfn\\signig_files.zip -Destination C:\\cfn"
    Invoke-Command "C:\\cfn\\scripts\\Unzip-Archive.ps1 -Source C:\\cfn\\OpenSSL-Win64.zip -Destination C:\\cfn"
    Invoke-Command "C:\\cfn\\scripts\\Verify-Signature.ps1 -FilePath C:\\cfn\\scripts\\validation.zip -SignatureFilePath C:\\cfn\\signig_files\\validation.sig -PubFilePath C:\\cfn\\signig_files\\validation.pub -ResourceID ValidationNode1 -Stackname '$deployment_name'"
    Invoke-Command "C:\\cfn\\scripts\\Unzip-Archive.ps1 -Source C:\\cfn\\scripts\\validation.zip -Destination C:\\cfn\\scripts"

    Invoke-Command "C:\\cfn\\scripts\\validation\\Update-DNSServers.ps1 -DNSIpAddresses '${dns_ip_addresses}'"
    Invoke-Command "C:\\cfn\\scripts\\validation\\Validate-VPCConnectivity.ps1 -subnet '${subnet_id}' -region '$region' -Stackname '$deployment_name' -ResourceID ValidationNode1 -WaitHandler '${validation_node1_wait_handler}'"
    Invoke-Command "C:\\cfn\\scripts\\validation\\Validate-Credentials.ps1 -DomainName '${domain_dns_name}' -UserName '${domain_admin_user}' -isSecretManagerSupported 0 -Stackname '$deployment_name' -Parentstackname '$deployment_name' -ResourceID ValidationNode1 -WaitHandler '${validation_node1_wait_handler}'"
    Invoke-Command "C:\\cfn\\scripts\\validation\\Validate-FsxConnectivity.ps1 -PerformFSxCheck '${perform_fsx_check}' -FSxFileSystemId '${fsx_file_system_id}' -FSxRegion '$region' -Stackname '$deployment_name' -Parentstackname '$deployment_name' -ResourceID ValidationNode1"
    Invoke-Command "C:\\cfn\\scripts\\validation\\Validate-Ami.ps1 -IsCustomAmi '${is_custom_ami}' -Region '$region' -DomainDNSName '${domain_dns_name}' -SQLDeploymentMode '${sql_deployment_mode}' -Stackname '$deployment_name' -Parentstackname '$deployment_name' -ResourceID ValidationNode1"
}
catch {
    Write-Output "An error occurred last: $_.Exception.Message"
}

Write-Output "Validation completed successfully"
touch /tmp/user_data_done
# shutdown /s
# } else {
#   Write-Output $FailureReason
#   shutdown /s
# }
