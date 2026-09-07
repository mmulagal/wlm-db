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
    [Parameter(Mandatory = $false)]
    [string]$DCName,
    [Parameter(Mandatory = $false)]
    [string]$OUPath,
    [Parameter(Mandatory = $true)]
    [string]$DomainAdminUser,
    [Parameter(Mandatory = $true)]
    [string]$SqlAdminAccounts,
    [Parameter(Mandatory = $true)]
    [string]$SqlCollation,
    [Parameter(Mandatory = $false)]
    [string]$InstanceId,
    [Parameter(Mandatory = $false)]
    [string]$LogFeatureEnabled,

    [Parameter(Mandatory = $true)]
    [string]$SqlNodeName,
    [Parameter(Mandatory = $true)]
    [boolean]$IsStandalone,
    [Parameter(Mandatory = $true)]
    [string]$NodeType,
    [Parameter(Mandatory = $false)]
    [string]$FsxQuorumVolumeName,
    [Parameter(Mandatory = $false)]
    [string]$WorkloadSecurityGroupId,
    [Parameter(Mandatory = $false)]
    [string]$MssqlMediaBucketName,
    [Parameter(Mandatory = $false)]
    [string]$AmiId,
    [Parameter(Mandatory = $false)]
    [string]$MssqlMediaPathKey,

    [Parameter(Mandatory = $false)]
    [string]$SqlFsxWsFcName,
    [Parameter(Mandatory = $false)]
    [string]$SqlFsxFciName,
    [Parameter(Mandatory = $false)]
    [string]$SqlFsxServerNetBiosName,
    [Parameter(Mandatory = $false)]
    [string]$SqlFsxServerNetBiosName2,
    [string]$NetworkInterface1FirstPrivateIp,
    [Parameter(Mandatory = $false)]
    [string]$NetworkInterface1SecondPrivateIp,
    [Parameter(Mandatory = $false)]
    [string]$NetworkInterface2FirstPrivateIp,
    [Parameter(Mandatory = $false)]
    [string]$NetworkInterface2SecondPrivateIp,
    [Parameter(Mandatory = $false)]
    [string]$PrivateSubnet1Id,
    [Parameter(Mandatory = $false)]
    [string]$PrivateSubnet2Id,
    [Parameter(Mandatory = $false)]
    [string]$PrimaryInstanceId,
    [Parameter(Mandatory = $false)]
    [string]$SecondaryInstanceId
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
$DomainNetBiosName = $env:USERDOMAIN
$DomainAdminFullUser = $DomainNetBiosName + '\' + $DomainAdminUser
$DomainPassword = $Store.domain.password
$DomainSecurePassword = ConvertTo-SecureString $DomainPassword -AsPlainText -Force
$LoginCredential = New-Object System.Management.Automation.PSCredential($DomainAdminFullUser, $DomainSecurePassword)

$OutputFilePath = "C:\sqlsetupoutput1.txt"
$IsStandaloneString = if ($IsStandalone) { "1" } else { "0" }

$WLMDBSqlSetupCommand = "C:\cfn\scripts\Sql-Setup.ps1 -DeploymentName '$DeploymentName' -Region '$Region' -SqlServerName '$SqlServerName' -SqlSvmName '$SqlSvmName' -FsxDataVolumeName '$FsxDataVolumeName' -FsxLogVolumeName '$FsxLogVolumeName' -FsxFileSystemId '$FsxFileSystemId' -FsxTempDbVolumeName '$FsxTempDbVolumeName' -FsxDataLunSize '$FsxDataLunSize' -SqlIgroupName '$SqlIgroupName' -FsxVolumeSnapshotPolicy '$FsxVolumeSnapshotPolicy' -AdDnsIpAddresses '$AdDnsIpAddresses' -DCName '$DCName' -OUPath '$OUPath' -DomainDnsName '$DomainDnsName' -DomainAdminUser '$DomainAdminUser' -SqlAdminAccounts '$SqlAdminAccounts' -SqlCollation '$SqlCollation'  -InstanceId '$InstanceId' -LogFeatureEnabled '$LogFeatureEnabled' -SqlNodeName '$SqlNodeName' -IsStandalone $IsStandaloneString -NodeType '$NodeType' -WorkloadSecurityGroupId '$WorkloadSecurityGroupId' -MssqlMediaBucketName '$MssqlMediaBucketName' -AmiId '$AmiId'"

if ($IsStandalone -eq $false) {
    $WLMDBSqlSetupCommand += " -FsxQuorumVolumeName '$FsxQuorumVolumeName' -MssqlMediaPathKey '$MssqlMediaPathKey' -SqlFsxWsFcName '$SqlFsxWsFcName' -SqlFsxFciName '$SqlFsxFciName' -SqlFsxServerNetBiosName '$SqlFsxServerNetBiosName' -SqlFsxServerNetBiosName2 '$SqlFsxServerNetBiosName2' -NetworkInterface1FirstPrivateIp '$NetworkInterface1FirstPrivateIp' -NetworkInterface1SecondPrivateIp '$NetworkInterface1SecondPrivateIp' -NetworkInterface2FirstPrivateIp '$NetworkInterface2FirstPrivateIp' -NetworkInterface2SecondPrivateIp '$NetworkInterface2SecondPrivateIp' -PrivateSubnet1Id '$PrivateSubnet1Id' -PrivateSubnet2Id '$PrivateSubnet2Id' -PrimaryInstanceId '$PrimaryInstanceId' -SecondaryInstanceId '$SecondaryInstanceId'"
}
$WLMDBSqlSetupCommand += " | Out-File '$OutputFilePath'"

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

# The legacy AWS.EC2.Windows.CloudWatch SSM plugin was removed in SSM Agent 3.x, so
# CloudWatch Logs is configured via the unified CloudWatch Agent instead, installed
# on-demand through the AWS-ConfigureAWSPackage SSM document.
$LogFeatureEnabled = $LogFeatureEnabled -eq "true"
if (-not $LogFeatureEnabled) {
    Write-Output "CloudWatch Logs feature is disabled. Skipping configuration."
}
else {
    # ponytail: do not treat amazon-cloudwatch-agent.json as "already configured" — it is
    # written before install/fetch-config; a failed first attempt must be retriable on re-run.
    $cwConfigPath = "C:\cfn\config\amazon-cloudwatch-agent.json"
    Write-Output "Configuring the CloudWatch Logs agent"
    try {
        $cwConfigDir = Split-Path -Path $cwConfigPath -Parent
        if (!(Test-Path -Path $cwConfigDir)) {
            New-Item -ItemType Directory -Path $cwConfigDir | Out-Null
        }
        $config = @{
            agent = @{ region = "$Region" }
            logs  = @{
                logs_collected = @{
                    files = @{
                        collect_list = @(
                            @{
                                file_path         = "C:\cfn\log\*.txt"
                                log_group_name    = "$DeploymentName"
                                log_stream_name   = "{instance_id}"
                                timestamp_format  = "%Y-%m-%d %H:%M:%S,%f"
                            }
                        )
                    }
                }
            }
        }
        ($config | ConvertTo-Json -Depth 10) | Out-File -FilePath $cwConfigPath -Encoding ascii

        $agentCtl = "C:\Program Files\Amazon\AmazonCloudWatchAgent\amazon-cloudwatch-agent-ctl.ps1"
        if (-not (Test-Path $agentCtl)) {
            Write-Output "AmazonCloudWatchAgent not found. Installing via AWS-ConfigureAWSPackage..."
            if (-not (Get-Command Send-SSMCommand -ErrorAction SilentlyContinue)) {
                if (Get-Module -ListAvailable -Name AWS.Tools.SimpleSystemsManagement) {
                    Import-Module -Name AWS.Tools.SimpleSystemsManagement -ErrorAction SilentlyContinue
                }
                elseif (Get-Module -ListAvailable -Name AWSPowerShell) {
                    Import-Module AWSPowerShell -ErrorAction SilentlyContinue 
                }
                else {
                    throw "Neither AWS.Tools.SimpleSystemsManagement nor AWSPowerShell is available; cannot install AmazonCloudWatchAgent via Send-SSMCommand."
                }
            }
            $commandId = (Send-SSMCommand -DocumentName 'AWS-ConfigureAWSPackage' -InstanceId $InstanceId -Region $Region -Parameter @{ action = 'Install'; name = 'AmazonCloudWatchAgent' }).CommandId
            # ponytail: bounded 5-minute poll instead of an SSM waiter; if the install runs
            # long this just moves on and CW Logs picks up on the next setup re-run.
            $deadline = (Get-Date).AddMinutes(5)
            do {
                Start-Sleep -Seconds 10
                $invocationStatus = (Get-SSMCommandInvocation -CommandId $commandId -InstanceId $InstanceId -Region $Region -ErrorAction SilentlyContinue).Status
            } while ($invocationStatus -in @('Pending', 'InProgress', 'Delayed', $null) -and (Get-Date) -lt $deadline)
            if ($invocationStatus -ne 'Success') {
                Write-Warning "AmazonCloudWatchAgent install did not confirm success (status: $invocationStatus)."
            }
        }
        if (Test-Path $agentCtl) {
            & $agentCtl -a fetch-config -m ec2 -s -c file:$cwConfigPath
        }
        else {
            Write-Warning "AmazonCloudWatchAgent is not installed; skipping CloudWatch Logs configuration."
        }
    }
    catch {
        Write-Output "An error occurred while configuring the CloudWatch Logs agent: $($_.Exception.Message)"
    }
}

function Invoke-CommandExecution {
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

        $retryCount = 0
        $maxRetries = 3
        $success = $false

        while ($retryCount -lt $maxRetries -and -not $success) {
            try {
                Write-Output "Starting to execute command: $commandString (Attempt $($retryCount + 1))"
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
                $success = $true

                # If the command is to restart computer lets pause the script for 3 minutes
                if ($command.Command -like "*Restart-Computer.ps1*") {
                    Write-Output "Restart command executed, pausing script for 3 minutes..."
                    Start-Sleep -Seconds 180
                }
            }
            catch {
                Write-Output "An error occurred while executing command $commandString (Attempt $($retryCount + 1))"
                Write-Output $_
                Write-Error $_.Exception.Message
                $retryCount++
                if ($retryCount -ge $maxRetries) {
                    Write-Output "Command $commandString failed after $maxRetries attempts"
                    exit $LASTEXITCODE
                }
                else {
                    Write-Output "Retrying command $commandString..."
                }
            }
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

            $retryCount = 0
            $maxRetries = 3
            $success = $false

            while ($retryCount -lt $maxRetries -and -not $success) {
                try {
                    $result = Invoke-Command -ComputerName localhost -ScriptBlock {
                        param($commandString)
                        $command = ConvertFrom-Json $commandString
                        $res = [PSCustomObject]@{
                            ExitCode = $null
                            Command  = $command.Command
                        }
                        try {
                            $process = Start-Process -FilePath "powershell.exe" -ArgumentList "-Command $($command.Command)" -NoNewWindow -Wait -PassThru
                            # Return the process exit code
                            $res.ExitCode = $process.ExitCode
                            if ($process.ExitCode -ne 0) {
                                Write-Output "Command execution failed with exit code $($process.ExitCode): $($command.Command)"
                                throw "Command execution failed with exit code $($process.ExitCode)"
                            }
                        }
                        catch {
                            Write-Output "Command execution failed: $($command.Command)"
                            throw
                        }
                        return $res
                    } -ArgumentList $commandString -Credential $Credential -Authentication Credssp

                    if ($result.ExitCode -eq 0) {
                        Write-Output "Successfully executed command: $commandValue"
                        # Write a success marker to the log file
                        Add-Content -Path $logFile -Value ("SUCCESS: " + $command.Command)
                        $success = $true
                    }
                    else {
                        Write-Output "Command failed with exit code $($result.ExitCode): $commandValue"
                        throw "Command execution failed $commandValue"
                    }

                    # If the command is to restart computer, pause the script for 3 minutes
                    if ($command.Command -like "*Restart-Computer.ps1*") {
                        Write-Output "Restart command executed, pausing script for 3 minutes..."
                        Start-Sleep -Seconds 180
                    }
                }
                catch {
                    Write-Output "An error occurred while executing command $commandValue (Attempt $($retryCount + 1))"
                    Write-Output $_
                    Write-Error $_.Exception.Message
                    $retryCount++
                    if ($retryCount -ge $maxRetries) {
                        Write-Output "Command $commandValue failed after $maxRetries attempts"
                        exit $LASTEXITCODE
                    }
                    else {
                        Write-Output "Retrying command $commandValue..."
                    }
                }
            }
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
    Write-Output "Starting the initial setup"
    Write-Output "deployment_name : $DeploymentName"
    $ProgressPreference = 'SilentlyContinue'

    New-ScheduledTask -taskName "wlmdbsqlsetup" -argument "$WLMDBSqlSetupCommand" -userName "SYSTEM"

    $IsPrimaryOrStandalone = $IsStandalone -eq $true -or $NodeType -eq 'primary'

    if ($IsStandalone -eq $true) {
        Write-Output "Starting setup for Standalone"
        $SetupCommands = @(
            @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForCFN.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForSSM.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\common\InitializeDisks.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\sqlfci\install-dsc-modules.ps1 -ResourceID '$NodeType' -Stackname '$DeploymentName' -IsTerraform 1"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\sqlfci\LCM-Config.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\common\Unjoin-Domain.ps1 -Parentstackname '$DeploymentName'"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\common\Restart-Computer.ps1 -Count 'First'"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\common\Rename-Computer.ps1 -NewName '$SqlServerName'"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\common\Restart-Computer.ps1 -Count 'Second'"; UseExecutionPolicy = $false }
        )
    }
    else {
        Write-Output "Starting setup for FCI"
        $NewName = if ($NodeType -eq 'primary') { $SqlFsxServerNetBiosName } else { $SqlFsxServerNetBiosName2 }
        $SetupCommands = @(
            @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForCFN.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AWSLaunchWizardForSSM.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\modules\AmznFailoverCluster.zip -Destination 'C:\Program Files\WindowsPowerShell\Modules\'"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\common\InitializeDisks.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\sqlfci\install-dsc-modules.ps1 -ResourceID '$NodeType' -Stackname '$DeploymentName' -IsTerraform 1"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\sqlfci\LCM-Config.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\common\Rename-Computer.ps1 -NewName '$NewName'"; UseExecutionPolicy = $false },
            @{Command = "C:\cfn\scripts\common\Restart-Computer.ps1"; UseExecutionPolicy = $false }
        )
    }
    # rename computer script does restart inside as well so we are not doing it here
    Invoke-CommandExecution -commands $SetupCommands -logFile "C:\cfn\tflogs\SetupCommands.log"
    Write-Output "Completed the initial setup"̣̣

    # here join-domain has restart inside the script also
    if ($IsStandalone -eq $true) {
        Write-Output "Starting instance preparation for standalone"
        $InstancePreparationCommands = @(
            @{Command = "C:\\cfn\\scripts\\common\\Enable-CredSSP.ps1"; UseExecutionPolicy = $true },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Update-DNSServers.ps1 -DNSIpAddresses '${AdDnsIpAddresses}' -Stackname '$DeploymentName' -ResourceID '$NodeType'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Update-DNSSuffixSearchList.ps1 -DomainDNSName '$DomainDnsName'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Join-Domain.ps1 -DomainDNSName '$DomainDnsName' -DCName '$DCName' -OUPath '$OUPath' -Parentstackname '$DeploymentName' -DomainAdminUser '$DomainAdminUser'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$DomainAdminUser' -GroupName 'Administrators'"; UseExecutionPolicy = $true }
        )
    }
    elseif ($NodeType -eq 'primary') {
        Write-Output "Starting instance preparation for FCI Primary Node"
        $InstancePreparationCommands = @(
            @{Command = "C:\\cfn\\scripts\\common\\Enable-CredSSP.ps1"; UseExecutionPolicy = $true },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Update-DNSServers.ps1 -DNSIpAddresses '${AdDnsIpAddresses}' -Stackname '$DeploymentName' -ResourceID '$NodeType'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Update-DNSSuffixSearchList.ps1 -DomainDNSName '$DomainDnsName'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Join-Domain.ps1 -DomainDNSName '$DomainDnsName' -DCName '$DCName' -OUPath '$OUPath' -Parentstackname '$DeploymentName' -DomainAdminUser '$DomainAdminUser'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\OpenWSFCPorts.ps1"; UseExecutionPolicy = $true },
            @{Command = "C:\\cfn\\scripts\\common\\Update-SecurityGroup.ps1 -SGID '$WorkloadSecurityGroupId'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$DomainAdminUser' -GroupName 'Administrators'"; UseExecutionPolicy = $true }
        )
    }
    else {
        Write-Output "Starting instance preparation for FCI Secondary Node"
        $InstancePreparationCommands = @(
            @{Command = "C:\\cfn\\scripts\\common\\Enable-CredSSP.ps1"; UseExecutionPolicy = $true },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Update-DNSServers.ps1 -DNSIpAddresses '${AdDnsIpAddresses}' -Stackname '$DeploymentName' -ResourceID '$NodeType'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Join-Domain.ps1 -DomainDNSName '$DomainDnsName' -DCName '$DCName' -OUPath '$OUPath' -Parentstackname '$DeploymentName' -DomainAdminUser '$DomainAdminUser'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\OpenWSFCPorts.ps1"; UseExecutionPolicy = $true },
            @{Command = "C:\\cfn\\scripts\\common\\Update-SecurityGroup.ps1 -SGID '$WorkloadSecurityGroupId'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$DomainAdminUser' -GroupName 'Administrators'"; UseExecutionPolicy = $true },
            @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$SqlAdminAccounts' -GroupName 'Administrators'"; UseExecutionPolicy = $true },
            @{Command = "C:\\cfn\\scripts\\common\\Update-DNSSuffixSearchList.ps1 -DomainDNSName '$DomainDnsName'"; UseExecutionPolicy = $false }
        )
    }
    Invoke-CommandExecution -commands $InstancePreparationCommands -logFile "C:\cfn\tflogs\InstancePreparationCommands.log"
    Write-Output "Completed instance preparation"
    
    if ($IsPrimaryOrStandalone) {
        Write-Output "Starting instance prep continuation"
        $UserName = if ($IsStandalone -eq $true) { "$DomainDnsName\\$SqlAdminAccounts" } else { "$SqlAdminAccounts" }
        $IntancePreparationContinueCommands = @(
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Create-ADServiceAccount.ps1 -DomainAdminUser '$DomainAdminUser' -DomainDNSName '$DomainDnsName' -DCName '$DCName' -ServiceAccountUser '$SqlAdminAccounts' -Parentstackname '$DeploymentName'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Test-ADUser.ps1 -UserName '$SqlAdminAccounts' -DCName '$DCName' -Wait -TimeoutMinutes 30 -IntervalMinutes 1"; UseExecutionPolicy = $true }, # this has timeout of 30 minutes and runs in interval of 1 minute
            @{Command = "C:\\cfn\\scripts\\common\\AddUserToGroup.ps1 -UserName '$UserName' -GroupName 'Administrators'"; UseExecutionPolicy = $true }
        )
        Invoke-RemoteCommands -commands $IntancePreparationContinueCommands -logFile "C:\cfn\tflogs\IntancePreparationContinueCommands.log" -Credential $LoginCredential
        Write-Output "Completed instance continuation"
    }

    Write-Output "Starting ontap configuration"
    $OntapPreReqCommands = @(
        @{Command = "C:\cfn\scripts\sqlontap\install-ONTAPprereqs.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlontap\install-dotnet.ps1"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\sqlontap\install-powershell7.ps1"; UseExecutionPolicy = $false }
    )
    Invoke-CommandExecution -commands $OntapPreReqCommands -logFile "C:\cfn\tflogs\OntapPreReqCommands.log"
    Write-Output "Completed the ontap and powershell 7 installation"

    Start-Sleep -Seconds 10

    Write-Output "Starting Aws Tools Update"
    $UpdateAwsToolsCommand = @(
        @{
            Command            = "C:\\cfn\\scripts\\sqlontap\\Update-AWSToolsModules.ps1"
            UseExecutionPolicy = $false
        }
    )
    Invoke-CommandExecution -commands $UpdateAwsToolsCommand -logFile "C:\cfn\tflogs\UpdateAwsToolsCommand.log" -usePwsh $true
    Write-Output "Completed Aws Tools Update"

    $ThirdRestartCommand = @(
        @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false }
    )
    Invoke-CommandExecution -commands $ThirdRestartCommand -logFile "C:\cfn\tflogs\ThirdRestartCommand.log"
    
    if ($IsPrimaryOrStandalone) {
        Write-Output "Configuring ontap"
        $ConfigureOntapCommands = @(
            @{
                Command            = "C:\\cfn\\scripts\\sqlontap\\Configure-ONTAP.ps1 -Parentstackname '$DeploymentName' -SQLVMName '$SqlSvmName' -FSxDataVolumeName '$FsxDataVolumeName' -FSxLogVolumeName '$FsxLogVolumeName' -FileSystemId '$FsxFileSystemId' -FSxTempDbVolumeName '$FsxTempDbVolumeName' -FSxQuorumVolumeName '$FsxQuorumVolumeName' -FSxDataLunSize '$FsxDataLunSize' -IGROUP '$SqlIgroupName' -SnapshotPolicy '$FsxVolumeSnapshotPolicy' -ResourceID '$NodeType' -Stackname '$DeploymentName' -IsTerraform 1";
                UseExecutionPolicy = $false
            }
        )
        Invoke-CommandExecution -commands $ConfigureOntapCommands -logFile "C:\cfn\tflogs\ConfigureOntapCommands.log" -usePwsh $true
        Write-Output "Completed ontap configuration"

        Write-Output "Initialize iscsi disks in ontap"
        $IsFCI = if ($IsStandalone -eq $true) { "false" } else { "true" }
        $InitializeOntapCommands = @(
            @{Command = "C:\\cfn\\scripts\\sqlontap\\Connect-ONTAPInstance.ps1 -FileSystemId '$FsxFileSystemId' -SQLVMName '$SqlSvmName' -ResourceID '$NodeType' -Stackname '$DeploymentName' -IsTerraform 1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlontap\\Initialize-Iscsidisk.ps1 -IsFCI $IsFCI"; UseExecutionPolicy = $false }
        )
        Invoke-CommandExecution -commands $InitializeOntapCommands -logFile "C:\cfn\tflogs\InitializeOntapCommands.log"
        Write-Output "Completed initialize iscsi disks in ontap"
    }
    else {
        # setup for FCI Secondary node
        Write-Output "Starting FCI Node2 initiator configuration"
        $AddNode2InitiatorCommand = @{
            Command            = "C:\\cfn\\scripts\\sqlontap\\Add-node2initiator.ps1 -SQLVMName '$SqlSvmName' -igroup '$SqlIgroupName' -FileSystemId '$FsxFileSystemId' -ResourceID '$NodeType' -Stackname '$DeploymentName' -Parentstackname '$DeploymentName' -IsTerraform 1 -PrimaryInstanceId '$PrimaryInstanceId'";
            UseExecutionPolicy = $false 
        }
        Invoke-CommandExecution -commands $AddNode2InitiatorCommand -logFile "C:\cfn\tflogs\AddNode2InitiatorCommand.log"
        Write-Output "Completed the node2 initiator configuration"

        Write-Output "Connect Ontap instance for FCI Secondary Node"
        $InitializeOntapCommands = @(
            @{Command = "C:\\cfn\\scripts\\sqlontap\\Connect-ONTAPInstance.ps1 -FileSystemId '$FsxFileSystemId' -SQLVMName '$SqlSvmName' -ResourceID '$NodeType' -Stackname '$DeploymentName' -IsTerraform 1"; UseExecutionPolicy = $false }
        )
        Invoke-CommandExecution -commands $InitializeOntapCommands -logFile "C:\cfn\tflogs\InitializeOntapCommands.log"
        Write-Output "Completed connect ontap instance for FCI Secondary Node"
    }
   
    if ($IsStandalone -eq $true) {
        Write-Output "Starting sql reconfiguration for Standalone"
        $SqlReConfiguration = @(
            @{Command = "C:\\cfn\\DSC\\PostConfigDSC.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Reconfigure-SQL.ps1 -DomainAdminUser " + $DomainAdminUser + " -SQLServiceAccount " + $SqlAdminAccounts + " -Parentstackname " + $DeploymentName + " -SqlCollation " + $SqlCollation + " -NetBIOSName " + $SqlServerName; UseExecutionPolicy = $false }
        )
        Invoke-RemoteCommands -commands $SqlReConfiguration -logFile "C:\cfn\tflogs\SqlReConfiguration.log" -Credential $LoginCredential
        Write-Output "Completed sql reconfiguration"
    
        Write-Output "Starting sql instance name & create fsx param"
        $ConfigureSql = @(
            @{Command = "C:\\cfn\\scripts\\common\\SetMaxDOP.ps1 -DomainAdminUser `"$DomainAdminUser`" -Parentstackname `"$DeploymentName`" -NetBIOSName `"$SqlServerName`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\SetMTU.ps1 -FSxID `"$FsxFileSystemId`" -FSxRegion `"$Region`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Set-SQLInstanceName.ps1 -DomainAdminUser `"$DomainAdminUser`" -Parentstackname `"$DeploymentName`" -NetBIOSName `"$SqlServerName`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Create-FsxParameter.ps1 -FSxID `"$FsxFileSystemId`" -Parentstackname `"$DeploymentName`""; UseExecutionPolicy = $false }
        )
        Invoke-RemoteCommands -commands $ConfigureSql -logFile "C:\cfn\tflogs\ConfigureSql.log" -Credential $LoginCredential
        Write-Output "Completed sql instance name & created fsx param"
    
        $FifthRestartCommand = @(
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false }
        )
        Invoke-CommandExecution -commands $FifthRestartCommand -logFile "C:\cfn\tflogs\FifthRestartCommand.log"
    
    }
    elseif ($NodeType -eq 'primary') {
        # FCI Node 1 configuration
        Write-Output "Starting the configure instance for FCI Primary Node"
        $ConfigureInstance = @(
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Node1AddCluster.ps1 -DomainDNSName `"$DomainDNSName`" -Parentstackname `"$DeploymentName`" -FileSystemId `"$FsxFileSystemId`" -DomainAdminUser `"$DomainAdminUser`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlontap\\Node1ONTAPClusterConfig.ps1 -DomainDNSName `"$DomainDNSName`" -WSFCNode1PrivateIP2 `"$NetworkInterface1FirstPrivateIp`" -ClusterName `"$SqlFsxWsFcName`" -Parentstackname `"$DeploymentName`" -DomainAdminUser `"$DomainAdminUser`" -ResourceID '$NodeType' -Stackname `"$DeploymentName`" -IsTerraform 1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Configure-MAD-Permissions.ps1 -DomainAdminUser `"$DomainAdminUser`" -wsfcName `"$SqlFsxWsFcName`" -DCName '$DCName' -ResourceID '$NodeType' -Stackname `"$DeploymentName`" -Parentstackname `"$DeploymentName`" -IsTerraform 1"; UseExecutionPolicy = $false }
        )
        Invoke-RemoteCommands -commands $ConfigureInstance -logFile "C:\\cfn\\tflogs\\ConfigureInstance.log" -Credential $LoginCredential
        Write-Output "Completed configure instance for FCI Primary Node"

        Write-Output "Starting FCI Configuration for Primary Node"

        $FCIConfigure = @(
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Uninstall-SQL.ps1 -AMIID `"$AmiId`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1 -Count 'First'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\prepare-fci.ps1 -MSSQLMediaBucket `"$MssqlMediaBucketName`" -MSSQLMediaKey `"$MssqlMediaPathKey`" -AMIID `"$AmiId`" -SqlUser `"$SqlAdminAccounts`" -DomainAdminUser `"$DomainAdminUser`" -ResourceID '$NodeType' -Stackname `"$DeploymentName`" -Parentstackname `"$DeploymentName`" -IsTerraform 1 -SecondaryInstanceId `"$SecondaryInstanceId`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1 -Count 'Second'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\DSC\\PostConfigDSC.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Install-sqlcu.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1 -Count 'Third'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlontap\\completeONTAP-fci.ps1 -Node1FciIp `"$NetworkInterface1SecondPrivateIp`" -Node1SubnetId `"$PrivateSubnet1ID`" -Node2FciIp `"$NetworkInterface2SecondPrivateIp`" -Node2SubnetId `"$PrivateSubnet2ID`" -FCIName `"$SqlFsxFciName`" -DomainAdminUser `"$DomainAdminUser`" -ServiceAccount `"$SQLAdminAccounts`" -ResourceID '$NodeType' -Stackname `"$DeploymentName`" -SqlCollation `"$SqlCollation`" -Parentstackname `"$DeploymentName`" -IsTerraform 1 -SecondaryInstanceId `"$SecondaryInstanceId`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Validate-FCICluster.ps1 -DomainAdminUser `"$DomainAdminUser`" -WFCName `"$SqlFsxWsFcName`" -Node1 `"$SqlFsxServerNetBiosName`" -Node2 `"$SqlFsxServerNetBiosName2`" -ResourceID '$NodeType' -Stackname `"$DeploymentName`" -Parentstackname `"$DeploymentName`" -IsTerraform 1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Validate-SQLLogin.ps1 -SqlServer `"$SqlFsxFciName`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\SetMaxDOP.ps1 -DomainAdminUser `"$DomainAdminUser`" -Parentstackname `"$DeploymentName`" -NetBIOSName `"$SqlFsxServerNetBiosName`" -ClusterName `"$SqlFsxFciName`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\SetMTU.ps1 -FSxID `"$FsxFileSystemId`" -FSxRegion `"$Region`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Update-SQLNodeTag.ps1 -StackName `"$DeploymentName`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Query-SQLNodeTags.ps1 -StackName `"$DeploymentName`" -NumberOfNodes 2"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Create-FsxParameter.ps1 -FSxID `"$FsxFileSystemId`" -Parentstackname `"$DeploymentName`""; UseExecutionPolicy = $false }
        )
        Invoke-RemoteCommands -commands $FCIConfigure -logFile "C:\\cfn\\tflogs\\FCIConfigure.log" -Credential $LoginCredential

        Write-Output "FCI Configuration completed for Primary Node."
    }
    else {
        # FCI Node 2 configuration
        Write-Output "Starting ConfigureInstance for FCI Secondary Node"
        $ConfigureInstance = @(
            @{Command = "C:\\cfn\\scripts\\sqlfci\\AdditionalNodeAddCluster.ps1 -DomainAdminUser `"$DomainAdminUser`" -ResourceID '$NodeType' -Stackname `"$DeploymentName`" -Parentstackname `"$DeploymentName`" -IsTerraform 1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1 -Count 'First'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\AdditionalNodeClusterConfig.ps1 -WSFCNode2PrivateIP2 `"$NetworkInterface2FirstPrivateIp`" -ClusterName `"$SqlFsxWsFcName`" -Parentstackname `"$DeploymentName`" -DomainAdminUser `"$DomainAdminUser`" -IsTerraform 1 -PrimaryInstanceId `"$PrimaryInstanceId`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1 -Count 'Second'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Add-SecondaryNode.ps1 -WSFCNode2PrivateIP2 `"$NetworkInterface2FirstPrivateIp`" -ClusterName `"$SqlFsxWsFcName`" -DomainAdminUser `"$DomainAdminUser`" -ResourceID '$NodeType' -Stackname `"$DeploymentName`" -Parentstackname `"$DeploymentName`" -IsTerraform 1"; UseExecutionPolicy = $false }
        )
        Invoke-RemoteCommands -commands $ConfigureInstance -logFile "C:\\cfn\\tflogs\\ConfigureInstance.log" -Credential $LoginCredential
        Write-Output "Completed ConfigureInstance for FCI Secondary Node"

        Write-Output "Starting ConfigureFCI for FCI Secondary Node"
        $ConfigureFCI = @(
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Uninstall-SQL.ps1 -AMIID `"$AmiId`""; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1 -Count 'First'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\prepare-fci.ps1 -MSSQLMediaBucket `"$MssqlMediaBucketName`" -MSSQLMediaKey `"$MssqlMediaPathKey`" -AMIID `"$AmiId`" -SqlUser `"$SqlAdminAccounts`" -DomainAdminUser `"$DomainAdminUser`" -ResourceID '$NodeType' -Stackname `"$DeploymentName`" -Parentstackname `"$DeploymentName`" -IsTerraform 1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1 -Count 'Second'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\DSC\\PostConfigDSC.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\sqlfci\\Install-sqlcu.ps1"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Restart-Computer.ps1 -Count 'Third'"; UseExecutionPolicy = $false },
            @{Command = "C:\\cfn\\scripts\\common\\Update-SQLNodeTag.ps1 -StackName `"$DeploymentName`" -IsTerraform 1"; UseExecutionPolicy = $false }
        )
        Invoke-RemoteCommands -commands $ConfigureFCI -logFile "C:\\cfn\\tflogs\\ConfigureFCI.log" -Credential $LoginCredential
        Write-Output "Completed ConfigureFCI for FCI Secondary Node"
    }

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
    Invoke-CommandExecution -commands $Cleanup -logFile "C:\cfn\tflogs\Cleanup.log"
    Write-Output "Completed the Cleanup"

    Remove-ScheduledTask -taskName "wlmdbsqlsetup"
    Write-Output "Sql Setup Completed Successfully: $DeploymentName"
    Stop-Transcript
}
catch {
    New-EC2Tag -Region "$Region" -ResourceId "$InstanceId" -Tag @{ Key = "user_data"; Value = "failed" }
    Write-Output "Instance tagged successfully"
    Write-Output "Error while doing sql setup: $_"
}
