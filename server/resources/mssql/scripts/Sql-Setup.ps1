[CmdletBinding()]

param(
    [Parameter(Mandatory = $true)]
    [string]$DeploymentName,
    [Parameter(Mandatory = $true)]
    [string]$Region,
    [Parameter(Mandatory = $true)]
    [string]$SqlServerName,
    [Parameter(Mandatory = $true)]
    [string]$SqlSvmName,
    [Parameter(Mandatory = $true)]
    [string]$FsxDataVolumeName,
    [Parameter(Mandatory = $true)]
    [string]$FsxLogVolumeName,
    [Parameter(Mandatory = $true)]
    [string]$FsxFileSystemId,
    [Parameter(Mandatory = $true)]
    [string]$FsxTempDbVolumeName,
    [Parameter(Mandatory = $true)]
    [string]$FsxDataLunSize,
    [Parameter(Mandatory = $true)]
    [string]$SqlIgroupName,
    [Parameter(Mandatory = $true)]
    [string]$FsxVolumeSnapshotPolicy,
    [Parameter(Mandatory = $true)]
    [string]$AdDnsIpAddresses,
    [Parameter(Mandatory = $true)]
    [string]$DomainDnsName,
    [Parameter(Mandatory = $true)]
    [string]$DomainAdminUser,
    [Parameter(Mandatory = $true)]
    [string]$SqlAdminAccounts,
    [Parameter(Mandatory = $true)]
    [string]$SqlCollation,
    [Parameter(Mandatory = $false)]
    [string]$InstanceId,
    [Parameter(Mandatory = $false)]
    [string]$LogFeatureEnabled
)

Write-Output "Starting the sql setup script from terraform"
$WarningPreference = 'SilentlyContinue'

# Define the log directory
$LogDir = "C:\cfn\log"

# Check if the log directory exists, and create it if it does not
if (!(Test-Path -Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir
}

# Start the transcript
Start-Transcript -Path "$LogDir\Sql.Setup.ps1.txt" -Append

# Get ssm parameter
$SsmParameter = Get-SSMParameter -Name "/netapp/wlmdb/$DeploymentName" -WithDecryption $True
$Store = $SsmParameter.Value | ConvertFrom-Json

# Get domain credentials
$DomainNetBiosName = $DomainDnsName -replace '\.com$', ''
$DomainAdminFullUser = $DomainNetBiosName + '\' + $DomainAdminUser
$DomainPassword = $Store.domain.password
$DomainSecurePassword = ConvertTo-SecureString $DomainPassword -AsPlainText -Force
$LoginCredential = New-Object System.Management.Automation.PSCredential($DomainAdminFullUser, $DomainSecurePassword)

$OutputFilePath = "C:\sqlsetupoutput1.txt"
$WLMDBSqlSetupCommand = "C:\cfn\scripts\Sql-Setup.ps1 -DeploymentName '$DeploymentName' -Region '$Region' -SqlServerName '$SqlServerName' -SqlSvmName '$SqlSvmName' -FsxDataVolumeName '$FsxDataVolumeName' -FsxLogVolumeName '$FsxLogVolumeName' -FsxFileSystemId '$FsxFileSystemId' -FsxTempDbVolumeName '$FsxTempDbVolumeName' -FsxDataLunSize '$FsxDataLunSize' -SqlIgroupName '$SqlIgroupName' -FsxVolumeSnapshotPolicy '$FsxVolumeSnapshotPolicy' -AdDnsIpAddresses '$AdDnsIpAddresses' -DomainDnsName '$DomainDnsName' -DomainAdminUser '$DomainAdminUser' -SqlAdminAccounts '$SqlAdminAccounts' -SqlCollation '$SqlCollation'  -InstanceId '$InstanceId' -LogFeatureEnabled '$LogFeatureEnabled' | Out-File '$OutputFilePath'"
Write-Output $WLMDBSqlSetupCommand


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
        throw $_.Exception.Message
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

# Invoke the function with a different user
#New-ScheduledTask -taskName "wlmdbsqlsetup2" -argument "$second_setup_command" -userName "$DomainAdminFullUser" -password "$DomainSecurePassword"

$ConfigFilePath = "C:\Program Files\Amazon\SSM\Plugins\awsCloudWatch\AWS.EC2.Windows.CloudWatch.json"
if (Test-Path -Path $ConfigFilePath) {
    Write-Output "The CloudWatch Logs agent is already configured. Skipping configuration."
}
else {
    Write-Output "Configuring the CloudWatch Logs agent"
    # Define the JSON configuration
    try {
        $LogFeatureEnabled = $LogFeatureEnabled -eq "true"
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
                                "Region"    = $Region
                                "LogGroup"  = $DeploymentName
                                "LogStream" = $InstanceId
                            }
                        },
                        @{
                            "Id"         = "CloudWatch"
                            "FullName"   = "AWS.EC2.Windows.CloudWatch.CloudWatch.CloudWatchOutputComponent,AWS.EC2.Windows.CloudWatch"
                            "Parameters" = @{
                                "AccessKey" = ""
                                "SecretKey" = ""
                                "Region"    = $Region
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
        $json | Out-File -FilePath $ConfigFilePath
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
    Write-Output "deployment_name : $DeploymentName"
    $ProgressPreference = 'SilentlyContinue'

    # Invoke the function with the SYSTEM user
    New-ScheduledTask -taskName "wlmdbsqlsetup" -argument "$WLMDBSqlSetupCommand" -userName "SYSTEM"

    $SetupCommands = @(
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForCFN.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForSSM.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\InitializeDisks.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlfci\install-dsc-modules.ps1 -ResourceID SqlNode -Stackname '$DeploymentName'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlfci\LCM-Config.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Unjoin-Domain.ps1 -Parentstackname '$DeploymentName'"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Restart-Computer.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\Rename-Computer.ps1 -NewName '$SqlServerName'"; UseExecutionPolicy = $false }
        @{Command = "C:\cfn\scripts\common\Restart-Computer.ps1"; UseExecutionPolicy = $false }
    )
    # rename computer script does restart inside as well so we are not doing it here
    Invoke-Commands -commands $SetupCommands -logFile "C:\cfn\tflogs\SetupCommands.log"
    Write-Output "Completed the initial setup"̣̣

    # ontap configuration
    Write-Output "Starting ontap configuration"
    $OntapPreReqCommands = @(
        @{Command = "C:\cfn\scripts\sqlontap\install-ONTAPprereqs.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlontap\install-powershell7.ps1"; UseExecutionPolicy = $false }
    )
    Invoke-Commands -commands $OntapPreReqCommands -logFile "C:\cfn\tflogs\OntapPreReqCommands.log"
    Write-Output "Completed the ontap and powershell 7 installation"

    # Sleep for 10 seconds
    Start-Sleep -Seconds 10

    # here restart requires as it says powershell 7 requires restart
    Write-Output "Starting Aws Tools Update"
    $UpdateAwsToolsCommand = @(
        @{
            Command            = "C:\\cfn\\scripts\\sqlontap\\Update-AWSToolsModules.ps1"
            UseExecutionPolicy = $false
        }
    )
    Invoke-Commands -commands $UpdateAwsToolsCommand -logFile "C:\cfn\tflogs\UpdateAwsToolsCommand.log" -usePwsh $true
    Write-Output "Completed Aws Tools Update"

    $ThirdRestartCommand = @(
        @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false }
    )
    Invoke-Commands -commands $ThirdRestartCommand -logFile "C:\cfn\tflogs\ThirdRestartCommand.log"
    
    Write-Output "Configuring ontap"
    $ConfigureOntapCommands = @(
        @{
            Command            = "`"C:\\cfn\\scripts\\sqlontap\\Configure-ONTAP.ps1 -Parentstackname '$DeploymentName' -SQLVMName '$SqlSvmName' -FSxDataVolumeName '$FsxDataVolumeName' -FSxLogVolumeName '$FsxLogVolumeName' -FileSystemId '$FsxFileSystemId' -FSxTempDbVolumeName '$FsxTempDbVolumeName' -FSxDataLunSize '$FsxDataLunSize' -IGROUP '$SqlIgroupName' -SnapshotPolicy '$FsxVolumeSnapshotPolicy' -ResourceID SqlNode -Stackname '$DeploymentName'`""
            UseExecutionPolicy = $false
        }
    )
    Invoke-Commands -commands $ConfigureOntapCommands -logFile "C:\cfn\tflogs\ConfigureOntapCommands.log" -usePwsh $true
    Write-Output "Completed ontap configuration"

    Write-Output "Initialize iscsi disks in ontap"
    $InitializeOntapCommands = @(
        @{Command = "C:\\cfn\\scripts\\sqlontap\\Connect-ONTAPInstance.ps1 -FileSystemId '$FsxFileSystemId' -SQLVMName '$SqlSvmName' -ResourceID SqlNode -Stackname '$DeploymentName'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlontap\\Initialize-Iscsidisk.ps1 -IsFCI false"; UseExecutionPolicy = $false }
    )
    Invoke-Commands -commands $InitializeOntapCommands -logFile "C:\cfn\tflogs\InitializeOntapCommands.log"
    Write-Output "Completed initialize iscsi disks in ontap"


    Write-Output "Starting instance preparation"
    # here join-domain has restart inside the script also
    $InstancePreparationCommands = @(
        @{Command = "C:\\cfn\\scripts\\common\\Enable-CredSSP.ps1"; UseExecutionPolicy = $true },
        @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Add-DNSEntry.ps1 -ADServerPrivateIP '$AdDnsIpAddresses' -DomainDNSName '$DomainDnsName'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Update-DNSSuffixSearchList.ps1 -DomainDNSName '$DomainDnsName'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Join-Domain.ps1 -DomainDNSName '$DomainDnsName' -Parentstackname '$DeploymentName' -DomainAdminUser '$DomainAdminUser'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$DomainAdminUser' -GroupName 'Administrators'"; UseExecutionPolicy = $true }
    )
    Invoke-Commands -commands $InstancePreparationCommands -logFile "C:\cfn\tflogs\InstancePreparationCommands.log"
    Write-Output "Completed instance preparation"

    Write-Output "Starting instance prep continuation"
    $IntancePreparationContinueCommands = @(
        @{Command = "C:\\cfn\\scripts\\sqlfci\\Create-ADServiceAccount.ps1 -DomainAdminUser '$DomainAdminUser' -DomainDNSName '$DomainDnsName' -ServiceAccountUser '$SqlAdminAccounts' -Parentstackname '$DeploymentName'"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Test-ADUser.ps1 -UserName '$SqlAdminAccounts' -Wait -TimeoutMinutes 30 -IntervalMinutes 1"; UseExecutionPolicy = $true }, # this has timeout of 30 minutes and runs in interval of 1 minute
        @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$DomainDnsName\\$SqlAdminAccounts' -GroupName 'Administrators'"; UseExecutionPolicy = $true }
    )
    Invoke-RemoteCommands -commands $IntancePreparationContinueCommands -logFile "C:\cfn\tflogs\IntancePreparationContinueCommands.log" -Credential $LoginCredential
    Write-Output "Completed instance continuation"


    Write-Output "Starting sql reconfiguration"
    $SqlReConfiguration = @(
        @{Command = "C:\\cfn\\DSC\\PostConfigDSC.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Reconfigure-SQL.ps1 -DomainAdminUser " + $DomainAdminUser + " -SQLServiceAccount " + $SqlAdminAccounts + " -Parentstackname " + $DeploymentName + " -SqlCollation " + $SqlCollation + " -NetBIOSName " + $SqlServerName; UseExecutionPolicy = $false }
    )
    Invoke-RemoteCommands -commands $SqlReConfiguration -logFile "C:\cfn\tflogs\SqlReConfiguration.log" -Credential $LoginCredential
    Write-Output "Completed sql reconfiguration"

    Write-Output "Starting sql instance name & create fsx param"
    $ConfigureSql = @(
        @{Command = "C:\\cfn\\scripts\\common\\SetMaxDOP.ps1 -DomainAdminUser `"$DomainAdminUser`" -Parentstackname `"$DeploymentName`" -NetBIOSName `"$SqlServerName`""; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Set-SQLInstanceName.ps1 -DomainAdminUser `"$DomainAdminUser`" -Parentstackname `"$DeploymentName`" -NetBIOSName `"$SqlServerName`""; UseExecutionPolicy = $false },
        @{Command = "C:\\cfn\\scripts\\common\\Create-FsxParameter.ps1 -FSxID `"$FsxFileSystemId`" -Parentstackname `"$DeploymentName`""; UseExecutionPolicy = $false }
    )
    Invoke-RemoteCommands -commands $ConfigureSql -logFile "C:\cfn\tflogs\ConfigureSql.log" -Credential $LoginCredential
    Write-Output "Completed sql instance name & created fsx param"

    $FifthRestartCommand = @(
        @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false }
    )
    Invoke-Commands -commands $FifthRestartCommand -logFile "C:\cfn\tflogs\FifthRestartCommand.log"

    try {
        New-EC2Tag -Region "$Region" -ResourceId "$InstanceId" -Tag @{ Key = "user_data"; Value = "completed" }
        Write-Output "Instance tagged successfully"
    }
    catch {
        Write-Output "An error occurred while tagging the instance: $_"
        exit
    }
    
    Write-Output "Starting the Cleanup"
    $Cleanup = @(
        @{Command = "C:\\cfn\\scripts\\common\\Disable-CredSSP.ps1"; UseExecutionPolicy = $true },
        # @{Command = "Remove-Item C:\\cfn\\scripts -Recurse -Force"; UseExecutionPolicy = $false },
        @{Command = "Remove-Item C:\\cfn\\DSC* -Force -Recurse"; UseExecutionPolicy = $false },
        @{Command = "Remove-Item C:\\cfn\\OpenSSL* -Force -Recurse"; UseExecutionPolicy = $false }
    )
    Invoke-Commands -commands $Cleanup -logFile "C:\cfn\tflogs\Cleanup.log"
    Write-Output "Completed the Cleanup"
    # Invoke the function to remove the task
    Remove-ScheduledTask -taskName "wlmdbsqlsetup"
    Write-Output "Sql Setup Completed Successfully: $DeploymentName"
    Stop-Transcript
}
catch {
    New-EC2Tag -Region "$Region" -ResourceId "$InstanceId" -Tag @{ Key = "user_data"; Value = "failed" }
    Write-Output "Instance tagged successfully"
    Write-Output "Error while doing sql setup: $_"
}
