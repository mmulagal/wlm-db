$WarningPreference = 'SilentlyContinue';

param(
    [Parameter(Mandatory = $true)]
    [string]$deployment_name,
    [Parameter(Mandatory = $true)]
    [string]$region,
    [Parameter(Mandatory = $true)]
    [string]$sql_server_name,
    [Parameter(Mandatory = $true)]
    [string]$sql_svm_name,
    [Parameter(Mandatory = $true)]
    [string]$fsx_data_volume_name,
    [Parameter(Mandatory = $true)]
    [string]$fsx_log_volume_name,
    [Parameter(Mandatory = $true)]
    [string]$fsx_file_system_id,
    [Parameter(Mandatory = $true)]
    [string]$fsx_temp_db_volume_name,
    [Parameter(Mandatory = $true)]
    [string]$fsx_data_lun_size,
    [Parameter(Mandatory = $true)]
    [string]$sql_igroup_name,
    [Parameter(Mandatory = $true)]
    [string]$fsx_volume_snapshot_policy,
    [Parameter(Mandatory = $true)]
    [string]$ad_dns_ip_addresses,
    [Parameter(Mandatory = $true)]
    [string]$domain_dns_name,
    [Parameter(Mandatory = $true)]
    [string]$domain_admin_user,
    [Parameter(Mandatory = $true)]
    [string]$sql_admin_accounts,
    [Parameter(Mandatory = $true)]
    [string]$sql_collation
)

function Invoke-Commands {
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject[]]$commands,
        [Parameter(Mandatory = $true)]
        [string]$logFile
    )

    # Create the log file if it doesn't exist
    if (!(Test-Path $logFile)) {
        New-Item -Path $logFile -ItemType File -Force | Out-Null
    }

    # Get the completed commands from the log file
    $completedCommands = Get-Content $logFile

    foreach ($command in $commands) {
        if ($completedCommands -contains $command.Command) {
            Write-Output "Skipping command $command as it's already completed"
            continue
        }

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

            # Write the command to the log file
            Add-Content -Path $logFile -Value $command.Command
        }
        catch {
            Write-Output "An error occurred while executing command: $_"
            Write-Error $_.Exception.Message
            exit $LASTEXITCODE
        }
    }
}
  
try {
    #InitialSetup
    Write-Output "Starting the initial setup"
    $setup_commands = @(
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForCFN.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForSSM.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\InitializeDisks.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlfci\install-dsc-modules.ps1 -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlfci\LCM-Config.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Unjoin-Domain.ps1 -Parentstackname $deployment_name"; UseExecutionPolicy = $false },
        # @{Command = "C:\cfn\scripts\common\Restart-Computer.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Rename-Computer.ps1 -Restart -NewName $sql_server_name"; UseExecutionPolicy = $false }
        # @{Command = "C:\cfn\scripts\common\Restart-Computer.ps1"; UseExecutionPolicy = $false }
    )
    
    Invoke-Commands -commands $setup_commands -logFile "C:\cfn\tflogs\setup_commands.log"
    Write-Output "Completed the initial setup"̣̣

    # ontap configuration
    Write-Output "Starting ontap configuration"
    $ontap_pre_req_commands = @(
        @{Command = "C:\cfn\scripts\sqlontap\install-ONTAPprereqs.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlontap\install-powershell7.ps1"; UseExecutionPolicy = $false }
    )

    Invoke-Commands -commands $ontap_pre_req_commands -logFile "C:\cfn\tflogs\ontap_pre_req_commands.log"

    pwsh -Command C:\\cfn\\scripts\\sqlontap\\Update-AWSToolsModules.ps1
    # powershell.exe -Command "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"

    pwsh -Command "C:\\cfn\\scripts\\sqlontap\\Configure-ONTAP.ps1 -Parentstackname '$deployment_name' -SQLVMName '$sql_svm_name' -FSxDataVolumeName '$fsx_data_volume_name' -FSxLogVolumeName '$fsx_log_volume_name' -FileSystemId '$fsx_file_system_id' -FSxTempDbVolumeName '$fsx_temp_db_volume_name' -FSxDataLunSize '$fsx_data_lun_size' -IGROUP '$sql_igroup_name' -SnapshotPolicy '$fsx_volume_snapshot_policy' -ResourceID SqlNode -Stackname '$deployment_name'"
     
    $ontap_commands = @(
        @{Command = "C:\\cfn\\scripts\\sqlontap\\Connect-ONTAPInstance.ps1 -FileSystemId '$fsx_file_system_id' -SQLVMName '$sql_svm_name' -ResourceID SqlNode -Stackname '$deployment_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlontap\\Initialize-Iscsidisk.ps1 -IsFCI false"; UseExecutionPolicy = $false }
    )
    

    Invoke-Commands -commands $ontap_commands -logFile "C:\cfn\tflogs\ontap_commands.log"
    Write-Output "Completed ontap configuration"

    # instance preparation
    Write-Output "Starting instance preparation"
    $instance_prep_commands = @(
        @{Command = "C:\\cfn\\scripts\\common\\Enable-CredSSP.ps1"; UseExecutionPolicy = $true },
        # @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Add-DNSEntry.ps1 -ADServerPrivateIP '$ad_dns_ip_addresses' -DomainDNSName '$domain_dns_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Update-DNSSuffixSearchList.ps1 -DomainDNSName '$domain_dns_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Join-Domain.ps1 -DomainDNSName '$domain_dns_name' -Parentstackname '$deployment_name' -DomainAdminUser '$domain_admin_user'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$domain_admin_user' -GroupName 'Administrators'"; UseExecutionPolicy = $true },
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Create-ADServiceAccount.ps1 -DomainAdminUser '$domain_admin_user' -DomainDNSName '$domain_dns_name' -ServiceAccountUser '$sql_admin_accounts' -Parentstackname '$deployment_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Test-ADUser.ps1 -UserName '$sql_admin_accounts' -Wait -TimeoutMinutes 30 -IntervalMinutes 1"; UseExecutionPolicy = $true }, # this has timeout of 30 minutes and runs in interval of 1 minute
        @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$domain_dns_name\\$sql_admin_accounts' -GroupName 'Administrators'"; UseExecutionPolicy = $true }
    )
    Invoke-Commands -commands $instance_prep_commands -logFile "C:\cfn\tflogs\instance_prep_commands.log"
    Write-Output "Completed instance preparation"

    #sql included configure
    Write-Output "Starting sql included configure"
    $sql_included_configure = @(
        @{Command = "C:\\cfn\\DSC\\PostConfigDSC.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Reconfigure-SQL.ps1 -DomainAdminUser " + $domain_admin_user + " -SQLServiceAccount " + $sql_admin_accounts + " -Parentstackname " + $deployment_name + " -SqlCollation " + $sql_collation + " -NetBIOSName " + $sql_server_name; UseExecutionPolicy = $false }
    )

    Invoke-Commands -commands $sql_included_configure -logFile "C:\cfn\tflogs\sql_included_configure.log"
    Write-Output "Completed sql included configure"

    Write-Output "Starting sql configure"
    #sql instance configure
    $configure_sql = @(
        @{Command = "C:\\cfn\\scripts\\common\\SetMaxDOP.ps1 -DomainAdminUser `"$domain_admin_user`" -Parentstackname `"$deployment_name`" -NetBIOSName `"$sql_server_name`""; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Set-SQLInstanceName.ps1 -DomainAdminUser `"$domain_admin_user`" -Parentstackname `"$deployment_name`" -NetBIOSName `"$sql_server_name`""; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Create-FsxParameter.ps1 -FSxID `"$fsx_file_system_id`" -Parentstackname `"$deployment_name`""; UseExecutionPolicy = $false }
    )

    Invoke-Commands -commands $configure_sql -logFile "C:\cfn\tflogs\configure_sql.log"
    Write-Output "Completed sql configure"

    powershell.exe -Command "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"

    # Write-Output "Starting the Cleanup"
    # clean up
    # $cleanup = @(
    #   @{Command = "C:\\cfn\\scripts\\common\\Disable-CredSSP.ps1"; UseExecutionPolicy = $true },
    #   @{Command = "Remove-Item C:\\cfn\\scripts -Recurse -Force"; UseExecutionPolicy = $false },
    #   @{Command = "Remove-Item C:\\cfn\\DSC* -Force -Recurse"; UseExecutionPolicy = $false },
    #   @{Command = "Remove-Item C:\\cfn\\OpenSSL* -Force -Recurse"; UseExecutionPolicy = $false }
    # )

    # Invoke-Commands -commands $cleanup -logFile "C:\cfn\tflogs\cleanup.log"
    Write-Output "Completed the Cleanup"
  
    # finalise
    # $finalize = @(
    #     @{Command="cfn-signal.exe -e $env:ERRORLEVEL --resource SqlNode --stack $env:AWS_StackName --region $env:AWS_Region"; UseExecutionPolicy=$false}
    # )

    # Invoke-Commands -commands $finalize -logFile "C:\cfn\tflogs\finalize.log"
}
catch {
    Write-Output "Error setting ErrorActionPreference"
}
