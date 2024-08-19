<powershell>

$s3_artifacts_url = "${s3_artifacts_url}"

$script_verify_signature = "$s3_artifacts_url/scripts/Verify-Signature.ps1"
$script_unzip_archive = "$s3_artifacts_url/scripts/Unzip-Archive.ps1"
$script_common = "$s3_artifacts_url/scripts/common.zip"
$script_sqlfci = "$s3_artifacts_url/scripts/sqlfci.zip"
$script_sqlontap = "$s3_artifacts_url/scripts/sqlontap.zip"
$script_dbcreate = "$s3_artifacts_url/scripts/dbcreate.zip"
$dsc = "$s3_artifacts_url/scripts/DSC.zip"
$power_shell = "$s3_artifacts_url/Installer/powershell.zip"
$amazon_launch_wizard_for_cfn = "$s3_artifacts_url/modules/AWSLaunchWizardForCFN.zip"
$amazon_launch_wizard_for_ssm = "$s3_artifacts_url/modules/AWSLaunchWizardForSSM.zip"
$sqlspcu = "$s3_artifacts_url/Installer/sqlspcu.zip"
$dependent_packages = "$s3_artifacts_url/Installer/dependent-packages.zip"
$artifacts_signatures = "$s3_artifacts_url/signig_files.zip"
$open_ssl = "$s3_artifacts_url/OpenSSL-Win64.zip"

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

try {
  Get-Service AmazonSSMAgent -ErrorAction Stop
} catch {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12
  $progressPreference = "silentlyContinue"
  Invoke-WebRequest https://amazon-ssm-$region.s3.$region.amazonaws.com/latest/windows_amd64/AmazonSSMAgentSetup.exe -OutFile $env:USERPROFILE\\Desktop\\SSMAgent_latest.exe
  Start-Process -FilePath $env:USERPROFILE\\Desktop\\SSMAgent_latest.exe -ArgumentList "/S"
}
# cfn-init.exe -v -c config -s ${stack_id} -r SqlNode --region ${region}

# Configure CloudWatch Logs
$config = @{
  "IsEnabled" = $log_feature_enabled;
  "EngineConfiguration" = @{
    "PollInterval" = "00:00:05";
    "Components" = @(
      @{
        "Id" = "ApplicationEventLog";
        "FullName" = "AWS.EC2.Windows.CloudWatch.EventLog.EventLogInputComponent,AWS.EC2.Windows.CloudWatch";
        "Parameters" = @{
          "LogName" = "Application";
          "Levels" = "7"
        }
      },
      @{
        "Id" = "CfnInitLog";
        "FullName" = "AWS.EC2.Windows.CloudWatch.CustomLog.CustomLogInputComponent,AWS.EC2.Windows.CloudWatch";
        "Parameters" = @{
          "LogDirectoryPath" = "C:\\cfn\\log";
          "LogName" = "CfnInit";
          "Levels" = "7";
          "TimestampFormat" = "yyyy-MM-dd HH:mm:ss,fff";
          "Encoding" = "ASCII";
          "CultureName" = "en-US";
          "TimeZoneKind" = "Local"
        }
      }
    );
    "Flows" = @{
      "Flows" = @(
        "CfnInitLog,CloudWatchCfnInitLog"
      )
    }
  }
}
$config | ConvertTo-Json -Depth 5 | Out-File "C:\\Program Files\\Amazon\\SSM\\Plugins\\awsCloudWatch\\AWS.EC2.Windows.CloudWatch.json"

# Install SSM Agent
# Run commands
echo try{Start-Process -FilePath $env:USERPROFILE\\Desktop\\SSMAgent_latest.exe -ArgumentList "/S"}catch{Write-Host $_.exception} > C:/install-ssm.ps1
Start-Sleep -Seconds 30
powershell.exe -Command C:/install-ssm.ps1
Start-Sleep -Seconds 30
Set-Service -Name AmazonSSMAgent -StartupType Automatic
Start-Sleep -Seconds 30
Restart-Service AmazonSSMAgent -Force


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

function Invoke-Commands {
    param(
        [Parameter(Mandatory=$true)]
        [PSCustomObject[]]$commands
    )

    foreach ($command in $commands) {
        try {
            if ($command.UseExecutionPolicy) {
                & powershell.exe -ExecutionPolicy RemoteSigned -Command $command.Command
            } else {
                & powershell.exe -Command $command.Command
            }
            if ($LASTEXITCODE -ne 0) {
                throw "Command failed with exit code $LASTEXITCODE"
            }
        }
        catch {
            Write-Error $_.Exception.Message
            exit $LASTEXITCODE
        }
    }
}

# Usage
try {
    # FetchResources
    Invoke-WebRequestWithRetry -Uri "$script_verify_signature" -OutFile "C:\\cfn\\scripts\\Verify-Signature.ps1"
    Invoke-WebRequestWithRetry -Uri "$script_unzip_archive" -OutFile "C:\\cfn\\scripts\\Unzip-Archive.ps1"
    Invoke-WebRequestWithRetry -Uri "$script_common" -OutFile "C:\\cfn\\scripts\\common.zip"
    Invoke-WebRequestWithRetry -Uri "$script_sqlfci" -OutFile "C:\\cfn\\scripts\\sqlfci.zip"
    Invoke-WebRequestWithRetry -Uri "$script_ontap" -OutFile "C:\\cfn\\scripts\\sqlontap.zip"
    Invoke-WebRequestWithRetry -Uri "$script_dbcreate" -OutFile "C:\\cfn\\scripts\\dbcreate.zip"
    Invoke-WebRequestWithRetry -Uri "$dsc" -OutFile "C:\\cfn\\DSC.zip"
    Invoke-WebRequestWithRetry -Uri "$power_shell" -OutFile "C:\\cfn\\Installer\\powershell.zip"
    Invoke-WebRequestWithRetry -Uri "$amazon_launch_wizard_for_cfn" -OutFile "C:\\cfn\\modules\\AWSLaunchWizardForCFN.zip"
    Invoke-WebRequestWithRetry -Uri "$amazon_launch_wizard_for_ssm" -OutFile "C:\\cfn\\modules\\AWSLaunchWizardForSSM.zip"
    Invoke-WebRequestWithRetry -Uri "$sqlspcu" -OutFile "C:\\cfn\\Installer\\sqlspcu.zip"
    Invoke-WebRequestWithRetry -Uri "$dependent_packages" -OutFile "C:\\cfn\\Installer\\dependent-packages.zip"
    Invoke-WebRequestWithRetry -Uri "$artifacts_signatures" -OutFile "C:\\cfn\\signig_files.zip"
    Invoke-WebRequestWithRetry -Uri "$open_ssl" -OutFile "C:\\cfn\\OpenSSL-Win64.zip"

    #ScriptSignatureVerificationandExtract
    # Define your commands
    $commands = @(
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\signig_files.zip -Destination C:\cfn"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\OpenSSL-Win64.zip -Destination C:\cfn"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\common.zip -SignatureFilePath C:\cfn\signig_files\common.sig -PubFilePath C:\cfn\signig_files\common.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\common.zip -Destination C:\cfn\scripts"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\DSC.zip -SignatureFilePath C:\cfn\signig_files\DSC.sig -PubFilePath C:\cfn\signig_files\DSC.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\DSC.zip -Destination C:\cfn"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\sqlfci.zip -SignatureFilePath C:\cfn\signig_files\sqlfci.sig -PubFilePath C:\cfn\signig_files\sqlfci.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\sqlfci.zip -Destination C:\cfn\scripts"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\sqlontap.zip -SignatureFilePath C:\cfn\signig_files\sqlontap.sig -PubFilePath C:\cfn\signig_files\sqlontap.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\sqlontap.zip -Destination C:\cfn\scripts"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\sqlspcu.zip -Destination C:\cfn"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\powershell.zip -Destination C:\cfn\Installer"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\dbcreate.zip -SignatureFilePath C:\cfn\signig_files\dbcreate.sig -PubFilePath C:\cfn\signig_files\dbcreate.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\dbcreate.zip -Destination C:\cfn\scripts"; UseExecutionPolicy=$false},
        @{Command="Copy-Item C:\cfn\scripts\common\ExecuteQueryFromSSM.ps1 -Destination (New-Item -Path C:\SSM\ -Type Directory) -Recurse"; UseExecutionPolicy=$false},
        @{Command="Copy-Item C:\cfn\scripts\sqlontap\OntapRestGet.ps1 -Destination C:\SSM\"; UseExecutionPolicy=$false},
        @{Command="Copy-Item C:\cfn\scripts\dbcreate\* -Destination C:\SSM\ -Recurse"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\common\HideAllSSMScripts.ps1"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\Installer\dependent-packages.zip -SignatureFilePath C:\cfn\signig_files\dependent-packages.sig -PubFilePath C:\cfn\signig_files\dependent-packages.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\dependent-packages.zip -Destination C:\cfn\Installer"; UseExecutionPolicy=$false}
)
    

    # Invoke the commands
    Invoke-Commands -commands $commands

    #InitialSetup
    # Define your commands
    $setup_commands = @(
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForCFN.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForSSM.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\common\InitializeDisks.ps1"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\sqlfci\install-dsc-modules.ps1 -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\sqlfci\LCM-Config.ps1"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\common\Unjoin-Domain.ps1 -Parentstackname $deployment_name"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\common\Restart-Computer.ps1"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\common\Rename-Computer.ps1 -Restart -NewName $sql_server_name"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\common\Restart-Computer.ps1"; UseExecutionPolicy=$false}
)
    

    # Invoke the commands
    Invoke-Commands -commands $setup_commands

    # ontap configuration
    # Define your commands
    $ontap_pre_req_commands = @(
        @{Command="C:\cfn\scripts\sqlontap\install-ONTAPprereqs.ps1"; UseExecutionPolicy=$false},
        @{Command="C:\cfn\scripts\sqlontap\install-powershell7.ps1"; UseExecutionPolicy=$false}
)

    # Invoke the commands
    Invoke-Commands -commands $ontap_pre_req_commands

    pwsh -Command C:\\cfn\\scripts\\sqlontap\\Update-AWSToolsModules.ps1
    powershell.exe -Command "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"

    pwsh -Command "C:\\cfn\\scripts\\sqlontap\\Configure-ONTAP.ps1 -Parentstackname '$deployment_name' -SQLVMName '$sql_svm_name' -FSxDataVolumeName '$fsx_data_volume_name' -FSxLogVolumeName '$fsx_log_volume_name' -FileSystemId '$fsx_file_system_id' -FSxTempDbVolumeName '$fsx_temp_db_volume_name' -FSxDataLunSize '$fsx_data_lun_size' -IGROUP '$sql_igroup_name' -SnapshotPolicy '$fsx_volume_snapshot_policy' -ResourceID SqlNode -Stackname '$deployment_name'"
     
    # Define your commands
    $ontap_commands = @(
        @{Command="C:\\cfn\\scripts\\sqlontap\\Connect-ONTAPInstance.ps1 -FileSystemId '$fsx_file_system_id' -SQLVMName '$sql_svm_name' -ResourceID SqlNode -Stackname '$deployment_name'"; UseExecutionPolicy=$false},
        @{Command="C:\\cfn\\scripts\\sqlontap\\Initialize-Iscsidisk.ps1 -IsFCI false"; UseExecutionPolicy=$false}
)
    

    Invoke-Commands -commands $ontap_commands
    
    # instance preparation
    $instance_prep_commands = @(
    @{Command="C:\\cfn\\scripts\\common\\Enable-CredSSP.ps1"; UseExecutionPolicy=$true},
    @{Command="C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy=$false},
    @{Command="C:\\cfn\\scripts\\sqlfci\\Add-DNSEntry.ps1 -ADServerPrivateIP '$ad_dns_ip_addresses' -DomainDNSName '$domain_dns_name'"; UseExecutionPolicy=$false},
    @{Command="C:\\cfn\\scripts\\common\\Update-DNSSuffixSearchList.ps1 -DomainDNSName '$domain_dns_name'"; UseExecutionPolicy=$false},
    @{Command="C:\\cfn\\scripts\\sqlfci\\Join-Domain.ps1 -DomainDNSName '$domain_dns_name' -Parentstackname '$deployment_name' -DomainAdminUser '$domain_admin_user'"; UseExecutionPolicy=$false},
    @{Command="C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$domain_admin_user' -GroupName 'Administrators'"; UseExecutionPolicy=$true},
    @{Command="C:\\cfn\\scripts\\sqlfci\\Create-ADServiceAccount.ps1 -DomainAdminUser '$domain_admin_user' -DomainDNSName '$domain_dns_name' -ServiceAccountUser '$sql_admin_accounts' -Parentstackname '$deployment_name'"; UseExecutionPolicy=$false},
    @{Command="C:\\cfn\\scripts\\common\\Test-ADUser.ps1 -UserName '$sql_admin_accounts' -Wait -TimeoutMinutes 30 -IntervalMinutes 1"; UseExecutionPolicy=$true},
    @{Command="C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$domain_dns_name\\$sql_admin_accounts' -GroupName 'Administrators'"; UseExecutionPolicy=$true}
)
    Invoke-Commands -commands $instance_prep_commands


    #sql included configure
    $SQLIncludedConfigure = @(
    @{Command="powershell.exe -Command 'C:\cfn\DSC\PostConfigDSC.ps1'"; UseExecutionPolicy=$false},
    @{Command="powershell.exe -Command 'C:\cfn\scripts\common\Reconfigure-SQL.ps1 -DomainAdminUser " + $domain_admin_user + " -SQLServiceAccount " + $sql_admin_accounts + " -Parentstackname " + $deployment_name + " -SqlCollation " + $sql_collation + " -NetBIOSName " + $sql_server_name + "'"; UseExecutionPolicy=$false}
)

    Invoke-Commands -commands $SQLIncludedConfigure

    #sql instance configure
    $configure_sql = @(
    @{Command="powershell.exe -Command 'C:\cfn\scripts\common\SetMaxDOP.ps1 -DomainAdminUser " + $domain_admin_user + " -Parentstackname " + $deployment_name + " -NetBIOSName " + $sql_server_name + "'"; UseExecutionPolicy=$false},
    @{Command="powershell.exe -Command 'C:\cfn\scripts\common\Set-SQLInstanceName.ps1 -DomainAdminUser " + $domain_admin_user + " -Parentstackname " + $deployment_name + " -NetBIOSName " + $sql_server_name + "'"; UseExecutionPolicy=$false},
    @{Command="powershell.exe -Command 'C:\cfn\scripts\common\Create-FsxParameter.ps1 -FSxID " + $fsx_file_system_id + " -Parentstackname " + $deployment_name + "'"; UseExecutionPolicy=$false}
)

Invoke-Commands -commands $configure_sql

    # clean up
    $cleanup = @(
    @{Command="powershell.exe -ExecutionPolicy RemoteSigned -Command 'C:\cfn\scripts\common\Disable-CredSSP.ps1'"; UseExecutionPolicy=$true},
    @{Command="powershell -Command 'Remove-Item C:\cfn\scripts -Recurse -Force'"; UseExecutionPolicy=$false},
    @{Command="powershell -Command 'Remove-Item C:\cfn\DSC* -Force -Recurse'"; UseExecutionPolicy=$false},
    @{Command="powershell -Command 'Remove-Item C:\cfn\OpenSSL* -Force -Recurse'"; UseExecutionPolicy=$false}
)

Invoke-Commands -commands $cleanup

# finalise
# $Finalize = @(
#     @{Command="cfn-signal.exe -e $env:ERRORLEVEL --resource SqlNode --stack $env:AWS_StackName --region $env:AWS_Region"; UseExecutionPolicy=$false}
# )

# Invoke-Commands -commands $Finalize

}
catch {
    Write-Output "An error occurred last: $_.Exception.Message"
}

Write-Output "Completed sql standalone setup"

</powershell>