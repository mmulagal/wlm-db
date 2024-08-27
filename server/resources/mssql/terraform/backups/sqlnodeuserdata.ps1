<powershell>

Write-Output "Starting user data script from terraform"
$WarningPreference = 'SilentlyContinue';

$s3_artifacts_url = "${s3_artifacts_url}"
$region = "${region}"
$log_feature_enabled = "${log_feature_enabled}"
$deployment_name = "${deployment_name}"
$sql_server_name = "${sql_server_name}"
$sql_svm_name = "${sql_svm_name}"
$fsx_data_volume_name = "${fsx_data_volume_name}"
$fsx_log_volume_name = "${fsx_log_volume_name}"
$fsx_file_system_id = "${fsx_file_system_id}"
$fsx_temp_db_volume_name = "${fsx_temp_db_volume_name}"
$fsx_data_lun_size = "${fsx_data_lun_size}"
$sql_igroup_name = "${sql_igroup_name}"
$fsx_volume_snapshot_policy = "${fsx_volume_snapshot_policy}"

$ad_dns_ip_addresses = "${ad_dns_ip_addresses}"
$domain_dns_name = "${domain_dns_name}"
$domain_admin_user = "${domain_admin_user}"
$sql_admin_accounts = "${sql_admin_accounts}"
$sql_collation = "${sql_collation}"

Write-Output "Deployment Name: $deployment_name"

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
function DownloadAndParse {
    param (
        [Parameter(Mandatory = $true)]
        [string]$s3_artifacts_url
    )

    try {
        # Step 1: Download the file from S3 to the temp folder
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12
        $tempFilePath = Join-Path -Path $env:TEMP -ChildPath "signed-url.json"
        Invoke-WebRequest -Uri $s3_artifacts_url -OutFile $tempFilePath

        Write-Output "Downloaded the file to $tempFilePath"
        # Step 2: Parse the file and assign the URLs to the variables
        $json = Get-Content -Path $tempFilePath | ConvertFrom-Json
        $urls = $json.sql_standalone_node

        Write-Output "Parsed the file and assigned the URLs to the variables"
        Write-Output "$urls"
    
        return @{
            script_verify_signature      = $urls.verify_signature
            script_unzip_archive         = $urls.unzip_archive
            script_common                = $urls.common 
            script_sqlfci                = $urls.sql_fci 
            script_sqlontap              = $urls.sql_ontap  
            script_dbcreate              = $urls.db_create 
            dsc                          = $urls.dsc 
            power_shell                  = $urls.powershell 
            amazon_launch_wizard_for_cfn = $urls.aws_launch_wizard_for_cfn 
            amazon_launch_wizard_for_ssm = $urls.aws_launch_wizard_for_ssm  
            sqlspcu                      = $urls.sql_spcu 
            dependent_packages           = $urls.dependent_packages  
            artifacts_signatures         = $urls.signing_files  
            open_ssl                     = $urls.open_ssl_win64  
        }
    }
    catch {
        Write-Output "An error occurred while downloading the s3 signed: $_"
        return $null
    }
}

$urls = DownloadAndParse -s3_artifacts_url $s3_artifacts_url

if ($null -eq $urls) {
    Write-Output "The s3 urls object is null. Cannot proceed with assignments."
    exit
}

$script_verify_signature = $urls.script_verify_signature
$script_unzip_archive = $urls.script_unzip_archive
script_common = $urls.script_common
script_sqlfci = $urls.script_sqlfci
script_sqlontap = $urls.script_sqlontap
script_dbcreate = $urls.script_dbcreate
dsc = $urls.dsc
power_shell = $urls.power_shell
amazon_launch_wizard_for_cfn = $urls.amazon_launch_wizard_for_cfn
amazon_launch_wizard_for_ssm = $urls.amazon_launch_wizard_for_ssm
sqlspcu = $urls.sqlspcu
dependent_packages = $urls.dependent_packages
artifacts_signatures = $urls.artifacts_signatures
open_ssl = $urls.open_ssl


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

# Configure CloudWatch Logs
$config = if ($log_feature_enabled -eq "true") {
    @"
{
  "IsEnabled" : true,
  "EngineConfiguration" : {
    "PollInterval" : "00:00:05",
    "Components" : [{
      "Id" : "ApplicationEventLog",
      "FullName" : "AWS.EC2.Windows.CloudWatch.EventLog.EventLogInputComponent,AWS.EC2.Windows.CloudWatch",
      "Parameters" : {
        "LogName" : "Application",
        "Levels" : "7"
      }
    },
    {
      "Id": "CfnInitLog",
      "FullName": "AWS.EC2.Windows.CloudWatch.CustomLog.CustomLogInputComponent,AWS.EC2.Windows.CloudWatch",
      "Parameters": {
        "LogDirectoryPath": "C:\\cfn\\log",
        "LogName" : "CfnInit",
        "Levels" : "7",
        "TimestampFormat": "yyyy-MM-dd HH:mm:ss,fff",
        "Encoding": "ASCII",
        "CultureName": "en-US",
        "TimeZoneKind": "Local"
      }
    },
    {
      "Id": "CloudWatchCfnInitLog",
      "FullName": "AWS.EC2.Windows.CloudWatch.CloudWatchLogsOutput,AWS.EC2.Windows.CloudWatch",
      "Parameters": {
        "AccessKey": "",
        "SecretKey": "",
        "Region": "$region",
        "LogGroup": "$deployment_name",
        "LogStream": "{instance_id}"
      }
    },
    {
      "Id" : "CloudWatch",
      "FullName" : "AWS.EC2.Windows.CloudWatch.CloudWatch.CloudWatchOutputComponent,AWS.EC2.Windows.CloudWatch",
      "Parameters" : {
        "AccessKey" : "",
        "SecretKey" : "",
        "Region": "$region",
        "NameSpace" : "Windows/Default"
      }
    }],
    "Flows": {
      "Flows": [
        "CfnInitLog,CloudWatchCfnInitLog"
      ]
    }
  }
}
"@
}
else {
    '{ "IsEnabled" : false}'
}

try {
    Set-Content -Path "C:\\Program Files\\Amazon\\SSM\\Plugins\\awsCloudWatch\\AWS.EC2.Windows.CloudWatch.json" -Value $config
    Write-Output "Successfully configured CloudWatch Logs"
}
catch {
    Write-Output "An error occurred while setting up CloudWatch Logs: $_"
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

function Invoke-Commands {
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject[]]$commands
    )

    foreach ($command in $commands) {
        try {
            Write-Output "Starting to execute command: $command"
            if ($command.UseExecutionPolicy) {
                & powershell.exe -ExecutionPolicy RemoteSigned -Command $command.Command
            }
            else {
                & powershell.exe -Command $command.Command
            }
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
}

try {
    # FetchResources
    Write-Output "Downloading the files"
    Invoke-WebRequestWithRetry -Uri "$script_verify_signature" -OutFile "C:\\cfn\\scripts\\Verify-Signature.ps1"
    Invoke-WebRequestWithRetry -Uri "$script_unzip_archive" -OutFile "C:\\cfn\\scripts\\Unzip-Archive.ps1"
    Invoke-WebRequestWithRetry -Uri "$script_common" -OutFile "C:\\cfn\\scripts\\common.zip"
    Invoke-WebRequestWithRetry -Uri "$script_sqlfci" -OutFile "C:\\cfn\\scripts\\sqlfci.zip"
    Invoke-WebRequestWithRetry -Uri "$script_sqlontap" -OutFile "C:\\cfn\\scripts\\sqlontap.zip"
    Invoke-WebRequestWithRetry -Uri "$script_dbcreate" -OutFile "C:\\cfn\\scripts\\dbcreate.zip"
    Invoke-WebRequestWithRetry -Uri "$dsc" -OutFile "C:\\cfn\\DSC.zip"
    Invoke-WebRequestWithRetry -Uri "$power_shell" -OutFile "C:\\cfn\\Installer\\powershell.zip"
    Invoke-WebRequestWithRetry -Uri "$amazon_launch_wizard_for_cfn" -OutFile "C:\\cfn\\modules\\AWSLaunchWizardForCFN.zip"
    Invoke-WebRequestWithRetry -Uri "$amazon_launch_wizard_for_ssm" -OutFile "C:\\cfn\\modules\\AWSLaunchWizardForSSM.zip"
    Invoke-WebRequestWithRetry -Uri "$sqlspcu" -OutFile "C:\\cfn\\Installer\\sqlspcu.zip"
    Invoke-WebRequestWithRetry -Uri "$dependent_packages" -OutFile "C:\\cfn\\Installer\\dependent-packages.zip"
    Invoke-WebRequestWithRetry -Uri "$artifacts_signatures" -OutFile "C:\\cfn\\signig_files.zip"
    Invoke-WebRequestWithRetry -Uri "$open_ssl" -OutFile "C:\\cfn\\OpenSSL-Win64.zip"

    Write-Output "Downloaded the files successfully"

    #ScriptSignatureVerificationandExtract
    Write-Output "Starting to verify the signatures and extract the files"
    $commands = @(
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\signig_files.zip -Destination C:\cfn"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\OpenSSL-Win64.zip -Destination C:\cfn"; UseExecutionPolicy = $false },
        # @{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\common.zip -SignatureFilePath C:\cfn\signig_files\common.sig -PubFilePath C:\cfn\signig_files\common.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\common.zip -Destination C:\cfn\scripts"; UseExecutionPolicy = $false },
        # @{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\DSC.zip -SignatureFilePath C:\cfn\signig_files\DSC.sig -PubFilePath C:\cfn\signig_files\DSC.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\DSC.zip -Destination C:\cfn"; UseExecutionPolicy = $false },
        #@{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\sqlfci.zip -SignatureFilePath C:\cfn\signig_files\sqlfci.sig -PubFilePath C:\cfn\signig_files\sqlfci.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\sqlfci.zip -Destination C:\cfn\scripts"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\sqlontap.zip -SignatureFilePath C:\cfn\signig_files\sqlontap.sig -PubFilePath C:\cfn\signig_files\sqlontap.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\sqlontap.zip -Destination C:\cfn\scripts"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\sqlspcu.zip -Destination C:\cfn"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\powershell.zip -Destination C:\cfn\Installer"; UseExecutionPolicy = $false },
        # @{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\dbcreate.zip -SignatureFilePath C:\cfn\signig_files\dbcreate.sig -PubFilePath C:\cfn\signig_files\dbcreate.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\dbcreate.zip -Destination C:\cfn\scripts"; UseExecutionPolicy = $false },
        @{Command = "Copy-Item C:\cfn\scripts\common\ExecuteQueryFromSSM.ps1 -Destination (New-Item -Path C:\SSM\ -Type Directory) -Recurse"; UseExecutionPolicy = $false },
        @{Command = "Copy-Item C:\cfn\scripts\sqlontap\OntapRestGet.ps1 -Destination C:\SSM\"; UseExecutionPolicy = $false },
        @{Command = "Copy-Item C:\cfn\scripts\dbcreate\* -Destination C:\SSM\ -Recurse"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\HideAllSSMScripts.ps1"; UseExecutionPolicy = $false },
        # @{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\Installer\dependent-packages.zip -SignatureFilePath C:\cfn\signig_files\dependent-packages.sig -PubFilePath C:\cfn\signig_files\dependent-packages.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\dependent-packages.zip -Destination C:\cfn\Installer"; UseExecutionPolicy = $false }
    )
    
    Invoke-Commands -commands $commands
    Write-Output "Completed verifying the signatures and extracting the files"

    #InitialSetup
    Write-Output "Starting the initial setup"
    $setup_commands = @(
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForCFN.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForSSM.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\InitializeDisks.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlfci\install-dsc-modules.ps1 -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlfci\LCM-Config.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Unjoin-Domain.ps1 -Parentstackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Restart-Computer.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Rename-Computer.ps1 -Restart -NewName $sql_server_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Restart-Computer.ps1"; UseExecutionPolicy = $false }
    )
    
    Invoke-Commands -commands $setup_commands
    Write-Output "Completed the initial setup"

    # ontap configuration
    Write-Output "Starting ontap configuration"
    $ontap_pre_req_commands = @(
        @{Command = "C:\cfn\scripts\sqlontap\install-ONTAPprereqs.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlontap\install-powershell7.ps1"; UseExecutionPolicy = $false }
    )

    Invoke-Commands -commands $ontap_pre_req_commands

    pwsh -Command C:\\cfn\\scripts\\sqlontap\\Update-AWSToolsModules.ps1
    powershell.exe -Command "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"

    pwsh -Command "C:\\cfn\\scripts\\sqlontap\\Configure-ONTAP.ps1 -Parentstackname '$deployment_name' -SQLVMName '$sql_svm_name' -FSxDataVolumeName '$fsx_data_volume_name' -FSxLogVolumeName '$fsx_log_volume_name' -FileSystemId '$fsx_file_system_id' -FSxTempDbVolumeName '$fsx_temp_db_volume_name' -FSxDataLunSize '$fsx_data_lun_size' -IGROUP '$sql_igroup_name' -SnapshotPolicy '$fsx_volume_snapshot_policy' -ResourceID SqlNode -Stackname '$deployment_name'"
     
    $ontap_commands = @(
        @{Command = "C:\\cfn\\scripts\\sqlontap\\Connect-ONTAPInstance.ps1 -FileSystemId '$fsx_file_system_id' -SQLVMName '$sql_svm_name' -ResourceID SqlNode -Stackname '$deployment_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlontap\\Initialize-Iscsidisk.ps1 -IsFCI false"; UseExecutionPolicy = $false }
    )
    

    Invoke-Commands -commands $ontap_commands
    Write-Output "Completed ontap configuration"

    # instance preparation
    Write-Output "Starting instance preparation"
    $instance_prep_commands = @(
        @{Command = "C:\\cfn\\scripts\\common\\Enable-CredSSP.ps1"; UseExecutionPolicy = $true },
        @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Add-DNSEntry.ps1 -ADServerPrivateIP '$ad_dns_ip_addresses' -DomainDNSName '$domain_dns_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Update-DNSSuffixSearchList.ps1 -DomainDNSName '$domain_dns_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Join-Domain.ps1 -DomainDNSName '$domain_dns_name' -Parentstackname '$deployment_name' -DomainAdminUser '$domain_admin_user'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$domain_admin_user' -GroupName 'Administrators'"; UseExecutionPolicy = $true },
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Create-ADServiceAccount.ps1 -DomainAdminUser '$domain_admin_user' -DomainDNSName '$domain_dns_name' -ServiceAccountUser '$sql_admin_accounts' -Parentstackname '$deployment_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Test-ADUser.ps1 -UserName '$sql_admin_accounts' -Wait -TimeoutMinutes 30 -IntervalMinutes 1"; UseExecutionPolicy = $true }, # this has timeout of 30 minutes and runs in interval of 1 minute
        @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$domain_dns_name\\$sql_admin_accounts' -GroupName 'Administrators'"; UseExecutionPolicy = $true }
    )
    Invoke-Commands -commands $instance_prep_commands
    Write-Output "Completed instance preparation"

    #sql included configure
    Write-Output "Starting sql included configure"
    $SQLIncludedConfigure = @(
        @{Command = "C:\\cfn\\DSC\\PostConfigDSC.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Reconfigure-SQL.ps1 -DomainAdminUser " + $domain_admin_user + " -SQLServiceAccount " + $sql_admin_accounts + " -Parentstackname " + $deployment_name + " -SqlCollation " + $sql_collation + " -NetBIOSName " + $sql_server_name; UseExecutionPolicy = $false }
    )

    Invoke-Commands -commands $SQLIncludedConfigure
    Write-Output "Completed sql included configure"

    Write-Output "Starting sql configure"
    #sql instance configure
    $configure_sql = @(
        @{Command = "C:\\cfn\\scripts\\common\\SetMaxDOP.ps1 -DomainAdminUser `"$domain_admin_user`" -Parentstackname `"$deployment_name`" -NetBIOSName `"$sql_server_name`""; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Set-SQLInstanceName.ps1 -DomainAdminUser `"$domain_admin_user`" -Parentstackname `"$deployment_name`" -NetBIOSName `"$sql_server_name`""; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Create-FsxParameter.ps1 -FSxID `"$fsx_file_system_id`" -Parentstackname `"$deployment_name`""; UseExecutionPolicy = $false }
    )

    Invoke-Commands -commands $configure_sql
    Write-Output "Completed sql configure"

    Write-Output "Starting the Cleanup"
    # clean up
    # $cleanup = @(
    #   @{Command = "C:\\cfn\\scripts\\common\\Disable-CredSSP.ps1"; UseExecutionPolicy = $true },
    #   @{Command = "Remove-Item C:\\cfn\\scripts -Recurse -Force"; UseExecutionPolicy = $false },
    #   @{Command = "Remove-Item C:\\cfn\\DSC* -Force -Recurse"; UseExecutionPolicy = $false },
    #   @{Command = "Remove-Item C:\\cfn\\OpenSSL* -Force -Recurse"; UseExecutionPolicy = $false }
    # )

    # Invoke-Commands -commands $cleanup
    Write-Output "Completed the Cleanup"
  
    # finalise
    # $Finalize = @(
    #     @{Command="cfn-signal.exe -e $env:ERRORLEVEL --resource SqlNode --stack $env:AWS_StackName --region $env:AWS_Region"; UseExecutionPolicy=$false}
    # )

    # Invoke-Commands -commands $Finalize

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

Write-Output "Completed sql standalone setup"
</powershell>