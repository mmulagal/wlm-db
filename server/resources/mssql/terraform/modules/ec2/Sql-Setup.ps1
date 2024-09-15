[CmdletBinding()]

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
    [string]$sql_collation,
    [Parameter(Mandatory = $false)]
    [string]$instance_id,
    [Parameter(Mandatory = $false)]
    [string]$log_feature_enabled
)

Write-Output "Starting the sql setup script from terraform"
$WarningPreference = 'SilentlyContinue'

# Define the log directory
$logDir = "C:\cfn\log"

# Check if the log directory exists, and create it if it does not
if (!(Test-Path -Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir
}

# Start the transcript
Start-Transcript -Path "$logDir\Sql.Setup.ps1.txt" -Append

# Get ssm parameter
$ssmParameter = Get-SSMParameter -Name "/netapp/wlmdb/$deployment_name" -WithDecryption $True
$store = $ssmParameter.Value | ConvertFrom-Json

# Get domain credentials
$domain_net_bios_name = $domain_dns_name -replace '\.com$', ''
$domain_admin_full_user = $domain_net_bios_name + '\' + $domain_admin_user
$domain_password = $store.domain.password
$domain_secure_password = ConvertTo-SecureString $domain_password -AsPlainText -Force
$login_credential = New-Object System.Management.Automation.PSCredential($domain_admin_full_user, $domain_secure_password)

$output_file_path = "C:\sqlsetupoutput1.txt"
$wlmdb_sql_setup_command = "C:\cfn\scripts\Sql-Setup.ps1 -deployment_name '$deployment_name' -region '$region' -sql_server_name '$sql_server_name' -sql_svm_name '$sql_svm_name' -fsx_data_volume_name '$fsx_data_volume_name' -fsx_log_volume_name '$fsx_log_volume_name' -fsx_file_system_id '$fsx_file_system_id' -fsx_temp_db_volume_name '$fsx_temp_db_volume_name' -fsx_data_lun_size '$fsx_data_lun_size' -sql_igroup_name '$sql_igroup_name' -fsx_volume_snapshot_policy '$fsx_volume_snapshot_policy' -ad_dns_ip_addresses '$ad_dns_ip_addresses' -domain_dns_name '$domain_dns_name' -domain_admin_user '$domain_admin_user' -sql_admin_accounts '$sql_admin_accounts' -sql_collation '$sql_collation'  -instance_id '$instance_id' | Out-File '$output_file_path'"
Write-Output $wlmdb_sql_setup_command


function New-ScheduledTask {
    param (
        [Parameter(Mandatory = $true)]
        [string]$taskName,

        [Parameter(Mandatory = $true)]
        [string]$argument,

        [Parameter(Mandatory = $true)]
        [string]$userName,

        [Parameter(Mandatory = $false)]
        [System.Security.SecureString]$password
    )

    try {
        # Check if the task already exists
        if (-not (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
            $Action = New-ScheduledTaskAction -Execute '%SystemRoot%\system32\WindowsPowerShell\v1.0\powershell.exe' -Argument $argument
            $Trigger = New-ScheduledTaskTrigger -AtStartup

            if ($userName -eq "SYSTEM") {
                $Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
            }
            else {
                $Principal = New-ScheduledTaskPrincipal -UserId $userName -LogonType Password -RunLevel Highest
            }

            Register-ScheduledTask -TaskName $taskName -Action $Action -Trigger $Trigger -Principal $Principal -Description "wlmdb sql setup for terraform" -TaskPath "\sqlsetup"
            Write-Output "Scheduled task $taskName created successfully"
        }
    }
    catch {
        Write-Error "Failed to create scheduled task: $_"
    }
}

function Remove-ScheduledTask {
    param (
        [Parameter(Mandatory = $true)]
        [string]$taskName
    )

    try {
        # Check if the task exists
        if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Output "Scheduled task $taskName removed successfully"
        }
        else {
            Write-Output "Scheduled task $taskName does not exist"
        }
    }
    catch {
        Write-Error "Failed to remove scheduled task: $_"
    }
}

# Invoke the function with the SYSTEM user
New-ScheduledTask -taskName "wlmdbsqlsetup" -argument "$wlmdb_sql_setup_command" -userName "SYSTEM"

# Invoke the function with a different user
#New-ScheduledTask -taskName "wlmdbsqlsetup2" -argument "$second_setup_command" -userName "$domain_admin_full_user" -password "$domain_secure_password"

$configFilePath = "C:\Program Files\Amazon\SSM\Plugins\awsCloudWatch\AWS.EC2.Windows.CloudWatch.json"
if (Test-Path -Path $configFilePath) {
    Write-Output "The CloudWatch Logs agent is already configured. Skipping configuration."
}
else {
    Write-Output "Configuring the CloudWatch Logs agent"
    # Define the JSON configuration
    try {
        $LogFeatureEnabled = $log_feature_enabled -eq "true"
        if ($LogFeatureEnabled) {
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
                                "LogGroup"  = $deployment_name
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
        }
        else {
            $config = @{
                "IsEnabled" = $false
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



function Invoke-Commands {
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject[]]$commands,
        [Parameter(Mandatory = $true)]
        [string]$logFile,
        [Parameter(Mandatory = $false)]
        [bool]$usePwsh = $false
    )

    # Create the log file if it doesn't exist
    if (!(Test-Path $logFile)) {
        New-Item -Path $logFile -ItemType File -Force | Out-Null
    }

    # Get the completed commands from the log file
    $completedCommands = Get-Content $logFile | Where-Object { $_ -match "SUCCESS:" }

    foreach ($command in $commands) {
        $commandString = $command.Command | Out-String
        if ($completedCommands -contains ("SUCCESS: " + $command.Command)) {
            Write-Output "Skipping command $commandString as it's already completed"
            continue
        }

        # Write the command to the log file before executing it
        Add-Content -Path $logFile -Value $command.Command

        try {
            Write-Output "Starting to execute command: $commandString"
            if ($command.UseExecutionPolicy) {
                if ($usePwsh) {
                    & pwsh -ExecutionPolicy RemoteSigned -Command $command.Command
                }
                else {
                    & powershell.exe -ExecutionPolicy RemoteSigned -Command $command.Command
                }
            }
            else {
                if ($usePwsh) {
                    & pwsh -Command $command.Command
                }
                else {
                    & powershell.exe -Command $command.Command
                }
            }
            if ($LASTEXITCODE -ne 0) {
                throw "Command $commandString failed with exit code $LASTEXITCODE"
            }
            Write-Output "Successfully executed command: $commandString"

            # Write a success marker to the log file
            Add-Content -Path $logFile -Value ("SUCCESS: " + $command.Command)
        }
        catch {
            Write-Output "An error occurred while executing command $commandString"
            Write-Output $_
            Write-Error $_.Exception.Message
            exit $LASTEXITCODE
        }
    }
}

function Invoke-RemoteCommands {
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject[]]$commands,
        [Parameter(Mandatory = $true)]
        [string]$logFile,
        [Parameter(Mandatory = $true)]
        [System.Management.Automation.PSCredential]$Credential
    )

    # Create the log file if it doesn't exist
    if (!(Test-Path $logFile)) {
        New-Item -Path $logFile -ItemType File -Force | Out-Null
    }

    # Get the completed commands from the log file
    $completedCommands = Get-Content $logFile | Where-Object { $_ -match "SUCCESS:" }
    
    if ($null -eq $Credential) {
        Write-Output "No credentials provided, skipping command execution."
        return
    }

    try {
        foreach ($command in $commands) {
            $commandValue = $command.Command | Out-String
            if ($completedCommands -contains ("SUCCESS: " + $command.Command)) {
                Write-Output "Skipping command $commandValue as it's already completed"
                continue
            }

            # Write the command to the log file before executing it
            Add-Content -Path $logFile -Value $command.Command

       
            Write-Output "Starting to execute command: $commandValue"
            $commandString = $command | ConvertTo-Json -Compress
            Invoke-Command -ComputerName localhost -ScriptBlock { 
                param($commandString)
                $command = ConvertFrom-Json $commandString
                Write-Output "command here"
                Write-Output $command.Command
                Start-Process -FilePath "powershell.exe" -ArgumentList "-Command $($command.Command)" -NoNewWindow -Wait
            } -ArgumentList $commandString -Credential $Credential -Authentication Credssp
           
            Write-Output "Successfully executed command: $commandValue"

            # Write a success marker to the log file
            Add-Content -Path $logFile -Value ("SUCCESS: " + $command.Command)
        } 
    }
    catch {
        Write-Output "An error occurred while executing command"
        Write-Output $_
        Write-Error $_.Exception.Message
        exit $LASTEXITCODE
    }
}

try {
    #InitialSetup
    Write-Output "Starting the initial setup"
    Write-Output "deployment_name : $deployment_name"
    $ProgressPreference = 'SilentlyContinue'

    $setup_commands = @(
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForCFN.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForSSM.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\InitializeDisks.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlfci\install-dsc-modules.ps1 -ResourceID SqlNode -Stackname '$deployment_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlfci\LCM-Config.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Unjoin-Domain.ps1 -Parentstackname '$deployment_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Restart-Computer.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Rename-Computer.ps1 -NewName '$sql_server_name'"; UseExecutionPolicy = $false }
        @{Command = "C:\cfn\scripts\common\Restart-Computer.ps1"; UseExecutionPolicy = $false }
    )
    # rename computer script does restart inside as well so we are not doing it here
    Invoke-Commands -commands $setup_commands -logFile "C:\cfn\tflogs\setup_commands.log"
    Write-Output "Completed the initial setup"̣̣

    # ontap configuration
    Write-Output "Starting ontap configuration"
    $ontap_pre_req_commands = @(
        @{Command = "C:\cfn\scripts\sqlontap\install-ONTAPprereqs.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlontap\install-powershell7.ps1"; UseExecutionPolicy = $false }
    )
    Invoke-Commands -commands $ontap_pre_req_commands -logFile "C:\cfn\tflogs\ontap_pre_req_commands.log"
    Write-Output "Completed the ontap and powershell 7 installation"

    # Sleep for 10 seconds
    #Start-Sleep -Seconds 10

    # here restart requires as it says powershell 7 requires restart
    Write-Output "Starting Aws Tools Update"
    $update_aws_tools_commands = @(
        @{
            Command            = "C:\\cfn\\scripts\\sqlontap\\Update-AWSToolsModules.ps1"
            UseExecutionPolicy = $false
        }
    )
    Invoke-Commands -commands $update_aws_tools_commands -logFile "C:\cfn\tflogs\update_aws_tools_commands.log" -usePwsh $true
    Write-Output "Completed Aws Tools Update"

    $restart_command_three = @(
        @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false }
    )
    Invoke-Commands -commands $restart_command_three -logFile "C:\cfn\tflogs\restart_command_three.log"
    
    Write-Output "Configuring ontap"
    $configure_ontap_commands = @(
        @{
            Command            = "`"C:\\cfn\\scripts\\sqlontap\\Configure-ONTAP.ps1 -Parentstackname '$deployment_name' -SQLVMName '$sql_svm_name' -FSxDataVolumeName '$fsx_data_volume_name' -FSxLogVolumeName '$fsx_log_volume_name' -FileSystemId '$fsx_file_system_id' -FSxTempDbVolumeName '$fsx_temp_db_volume_name' -FSxDataLunSize '$fsx_data_lun_size' -IGROUP '$sql_igroup_name' -SnapshotPolicy '$fsx_volume_snapshot_policy' -ResourceID SqlNode -Stackname '$deployment_name'`""
            UseExecutionPolicy = $false
        }
    )
    Invoke-Commands -commands $configure_ontap_commands -logFile "C:\cfn\tflogs\configure_ontap_commands.log" -usePwsh $true
    Write-Output "Completed ontap configuration"

    Write-Output "Initialize iscsi disks in ontap"
    $ontap_commands = @(
        @{Command = "C:\\cfn\\scripts\\sqlontap\\Connect-ONTAPInstance.ps1 -FileSystemId '$fsx_file_system_id' -SQLVMName '$sql_svm_name' -ResourceID SqlNode -Stackname '$deployment_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlontap\\Initialize-Iscsidisk.ps1 -IsFCI false"; UseExecutionPolicy = $false }
    )
    Invoke-Commands -commands $ontap_commands -logFile "C:\cfn\tflogs\ontap_commands.log"
    Write-Output "Completed initialize iscsi disks in ontap"


    Write-Output "Starting instance preparation"
    # here join-domain has restart inside the script also
    $instance_prep_commands = @(
        @{Command = "C:\\cfn\\scripts\\common\\Enable-CredSSP.ps1"; UseExecutionPolicy = $true },
        @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Add-DNSEntry.ps1 -ADServerPrivateIP '$ad_dns_ip_addresses' -DomainDNSName '$domain_dns_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Update-DNSSuffixSearchList.ps1 -DomainDNSName '$domain_dns_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Join-Domain.ps1 -DomainDNSName '$domain_dns_name' -Parentstackname '$deployment_name' -DomainAdminUser '$domain_admin_user'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$domain_admin_user' -GroupName 'Administrators'"; UseExecutionPolicy = $true }
    )
    Invoke-Commands -commands $instance_prep_commands -logFile "C:\cfn\tflogs\instance_prep_commands.log"
    Write-Output "Completed instance preparation"

    Write-Output "Starting instance prep continuation"
    $instance_prep_continue_commands = @(
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Create-ADServiceAccount.ps1 -DomainAdminUser '$domain_admin_user' -DomainDNSName '$domain_dns_name' -ServiceAccountUser '$sql_admin_accounts' -Parentstackname '$deployment_name'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Test-ADUser.ps1 -UserName '$sql_admin_accounts' -Wait -TimeoutMinutes 30 -IntervalMinutes 1"; UseExecutionPolicy = $true }, # this has timeout of 30 minutes and runs in interval of 1 minute
        @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$domain_dns_name\\$sql_admin_accounts' -GroupName 'Administrators'"; UseExecutionPolicy = $true }
    )
    Invoke-RemoteCommands -commands $instance_prep_continue_commands -logFile "C:\cfn\tflogs\instance_prep_continue_commands.log" -Credential $login_credential
    Write-Output "Completed instance continuation"


    Write-Output "Starting sql reconfiguration"
    $sql_included_configure = @(
        @{Command = "C:\\cfn\\DSC\\PostConfigDSC.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Reconfigure-SQL.ps1 -DomainAdminUser " + $domain_admin_user + " -SQLServiceAccount " + $sql_admin_accounts + " -Parentstackname " + $deployment_name + " -SqlCollation " + $sql_collation + " -NetBIOSName " + $sql_server_name; UseExecutionPolicy = $false }
    )
    Invoke-RemoteCommands -commands $sql_included_configure -logFile "C:\cfn\tflogs\sql_included_configure.log" -Credential $login_credential
    Write-Output "Completed sql reconfiguration"

    Write-Output "Starting sql instance name & create fsx param"
    $configure_sql = @(
        @{Command = "C:\\cfn\\scripts\\common\\SetMaxDOP.ps1 -DomainAdminUser `"$domain_admin_user`" -Parentstackname `"$deployment_name`" -NetBIOSName `"$sql_server_name`""; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Set-SQLInstanceName.ps1 -DomainAdminUser `"$domain_admin_user`" -Parentstackname `"$deployment_name`" -NetBIOSName `"$sql_server_name`""; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Create-FsxParameter.ps1 -FSxID `"$fsx_file_system_id`" -Parentstackname `"$deployment_name`""; UseExecutionPolicy = $false }
    )
    Invoke-RemoteCommands -commands $configure_sql -logFile "C:\cfn\tflogs\configure_sql.log" -Credential $login_credential
    Write-Output "Completed sql instance name & created fsx param"

    $restart_command_five = @(
        @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false }
    )
    Invoke-Commands -commands $restart_command_five -logFile "C:\cfn\tflogs\restart_command_five.log"

    try {
        New-EC2Tag -Region "$region" -ResourceId "$instance_id" -Tag @{ Key = "user_data"; Value = "completed" }
        Write-Output "Instance tagged successfully"
    }
    catch {
        Write-Output "An error occurred while tagging the instance: $_"
        exit
    }
    
    Write-Output "Starting the Cleanup"
    $cleanup = @(
        @{Command = "C:\\cfn\\scripts\\common\\Disable-CredSSP.ps1"; UseExecutionPolicy = $true },
        # @{Command = "Remove-Item C:\\cfn\\scripts -Recurse -Force"; UseExecutionPolicy = $false },
        @{Command = "Remove-Item C:\\cfn\\DSC* -Force -Recurse"; UseExecutionPolicy = $false },
        @{Command = "Remove-Item C:\\cfn\\OpenSSL* -Force -Recurse"; UseExecutionPolicy = $false }
    )
    Invoke-Commands -commands $cleanup -logFile "C:\cfn\tflogs\cleanup.log"
    Write-Output "Completed the Cleanup"
    # Invoke the function to remove the task
    Remove-ScheduledTask -taskName "wlmdbsqlsetup"
    Write-Output "Sql Setup Completed Successfully: $deployment_name"
    Stop-Transcript
    
    # finalise
    # $finalize = @(
    #     @{Command="cfn-signal.exe -e $env:ERRORLEVEL --resource SqlNode --stack $env:AWS_StackName --region $env:AWS_Region"; UseExecutionPolicy=$false}
    # )
    # Invoke-Commands -commands $finalize -logFile "C:\cfn\tflogs\finalize.log"
}
catch {
    New-EC2Tag -Region "$region" -ResourceId "$instance_id" -Tag @{ Key = "user_data"; Value = "failed" }
    Write-Output "Instance tagged successfully"
    Write-Output "Error while doing sql setup: $_"
}
