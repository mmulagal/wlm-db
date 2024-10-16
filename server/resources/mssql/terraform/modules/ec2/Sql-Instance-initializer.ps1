[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Region,
    [Parameter(Mandatory = $true)]
    [string]$LogFeatureEnabled,
    [Parameter(Mandatory = $true)]
    [string]$DeploymentName,
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
    [Parameter(Mandatory = $true)]
    [string]$SqlNodeName,
    [Parameter(Mandatory = $true)]
    [boolean]$IsStandalone,
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
    [string]$NetworkInterface2SecondPrivateIp
)

Write-Output "Starting the initializer script from terraform"
$WarningPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12

if ($IsStandalone -eq $true) {
    $NodeType = "SqlNode"
}
else {
    if ($SqlNodeName -eq "SQL-Node-1") {
        $NodeType = "primary"
    }
    else {
        $NodeType = "secondary"
    }
}

# Define the log directory
$LogDir = "C:\cfn\log"

# Check if the log directory exists, and create it if it does not
if (!(Test-Path -Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir
}

Start-Transcript -Path "$LogDir\sql-instance.initializer.ps1.txt" -Append

$ScriptVerifySignature = "{{{ScriptVerifySignature}}}"
$ScriptUnzipArchive = "{{{ScriptUnzipArchive}}}"
$ScriptCommon = "{{{ScriptCommon}}}"
$ScriptSqlFci = "{{{ScriptSqlFci}}}"
$ScriptSqlOntap = "{{{ScriptSqlOntap}}}"
$ScriptDbCreate = "{{{ScriptDbCreate}}}"
$Dsc = "{{{Dsc}}}"
$PowerShell = "{{{PowerShell}}}"
$AmazonLaunchWizardForCfn = "{{{AmazonLaunchWizardForCfn}}}"
$AmazonLaunchWizardForSsm = "{{{AmazonLaunchWizardForSsm}}}"
$SqlSpcu = "{{{SqlSpcu}}}"
$DependentPackages = "{{{DependentPackages}}}"
$ArtifactsSignatures = "{{{ArtifactsSignatures}}}"
$OpenSsl = "{{{OpenSsl}}}"
$SqlSetup = "{{{SqlSetup}}}"
if ($IsStandalone -eq $false) {
    $AmazonFailoverCluster = "{{{AmazonFailoverCluster}}}"
}
else {
    $AmazonFailoverCluster = ""
}

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
        Get-Service AmazonSSMAgent -ErrorAction Stop
        Write-Output "Setting SSM Agent service to start automatically"
        Set-Service -Name AmazonSSMAgent -StartupType Automatic
        Start-Sleep -Seconds 30
   
        Write-Output "Restarting SSM Agent service"
        Restart-Service AmazonSSMAgent -Force -ErrorAction Continue
        Start-Sleep -Seconds 30
    }
    catch {
        $progressPreference = "silentlyContinue"
        $SSMAgentUrl = "https://amazon-ssm-$Region.s3.$Region.amazonaws.com/latest/windows_amd64/AmazonSSMAgentSetup.exe"
        Write-Output "Downloading SSM Agent from $SSMAgentUrl"
        Invoke-WebRequest $SSMAgentUrl -OutFile "$env:USERPROFILE\Desktop\SSMAgent_latest.exe"
      
        Write-Output "Installing SSM Agent"
        Start-Process -FilePath "$env:USERPROFILE\Desktop\SSMAgent_latest.exe" -ArgumentList '/S'
        Start-Sleep -Seconds 30
  
        Write-Output "Setting SSM Agent service to start automatically"
        Set-Service -Name AmazonSSMAgent -StartupType Automatic
        Start-Sleep -Seconds 30
  
        Write-Output "Restarting SSM Agent service"
        Restart-Service AmazonSSMAgent -Force -ErrorAction Continue
        Start-Sleep -Seconds 30
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
        Write-Error $_.Exception.Message
        throw $_.Exception.Message
    }
}

function Invoke-Commands {
    param(
        [Parameter(Mandatory = $true)]
        [PSCustomObject[]]$commands
    )

    foreach ($command in $commands) {
        $commandString = $command.Command | Out-String
        try {
            Write-Output "Starting to execute command: $commandString"
            if ($command.UseExecutionPolicy) {
                & powershell.exe -ExecutionPolicy RemoteSigned -Command $command.Command
            }
            else {
                & powershell.exe -Command $command.Command
            }
            if ($LASTEXITCODE -ne 0) {
                throw "Command failed with exit code $LASTEXITCODE"
            }
            Write-Output "Successfully executed command: $commandString"
        }
        catch {
            Write-Output "An error occurred while executing command $commandString"
            Write-Output $_
            Write-Error $_.Exception.Message
            throw $_.Exception.Message
        }
    }
}

try {
    $InstanceId = Get-InstanceId
    Write-Output "Instance ID: $InstanceId"
    Install-SSMAgent -Region "$Region"

    # FetchResources
    Write-Output "Downloading the files"
    $Downloads = @{
        "$ScriptVerifySignature"    = "C:\\cfn\\scripts\\Verify-Signature.ps1"
        "$ScriptUnzipArchive"       = "C:\\cfn\\scripts\\Unzip-Archive.ps1"
        "$ScriptCommon"             = "C:\\cfn\\scripts\\common.zip"
        "$ScriptSqlFci"             = "C:\\cfn\\scripts\\sqlfci.zip"
        "$ScriptSqlOntap"           = "C:\\cfn\\scripts\\sqlontap.zip"
        "$ScriptDbCreate"           = "C:\\cfn\\scripts\\dbcreate.zip"
        "$Dsc"                      = "C:\\cfn\\DSC.zip"
        "$PowerShell"               = "C:\\cfn\\Installer\\powershell.zip"
        "$AmazonLaunchWizardForCfn" = "C:\\cfn\\modules\\AWSLaunchWizardForCFN.zip"
        "$AmazonLaunchWizardForSsm" = "C:\\cfn\\modules\\AWSLaunchWizardForSSM.zip"
        "$SqlSpcu"                  = "C:\\cfn\\Installer\\sqlspcu.zip"
        "$DependentPackages"        = "C:\\cfn\\Installer\\dependent-packages.zip"
        "$ArtifactsSignatures"      = "C:\\cfn\\signig_files.zip"
        "$OpenSsl"                  = "C:\\cfn\\OpenSSL-Win64.zip"
        "$SqlSetup"                 = "C:\\cfn\\scripts\\Sql-Setup.ps1"
    }
    # only for fci this will be added
    if (![string]::IsNullOrEmpty($AmazonFailoverCluster)) {
        $Downloads["$AmazonFailoverCluster"] = "C:\\cfn\\modules\\AmazonFailoverCluster.zip"
    }
    $ProgressPreference = 'SilentlyContinue'
    foreach ($uri in $Downloads.Keys) {
        Invoke-WebRequestWithRetry -Uri $uri -OutFile $Downloads[$uri]
    }
    Write-Output "Downloaded the files successfully"

    #ScriptSignatureVerificationandExtract
    Write-Output "Starting to verify the signatures and extract the files"
    $Commands = @(
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\signig_files.zip -Destination C:\cfn"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\OpenSSL-Win64.zip -Destination C:\cfn"; UseExecutionPolicy = $false },
        # @{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\common.zip -SignatureFilePath C:\cfn\signig_files\common.sig -PubFilePath C:\cfn\signig_files\common.pub -ResourceID $NodeType -Stackname $DeploymentName"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\common.zip -Destination C:\cfn\scripts"; UseExecutionPolicy = $false },
        # @{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\DSC.zip -SignatureFilePath C:\cfn\signig_files\DSC.sig -PubFilePath C:\cfn\signig_files\DSC.pub -ResourceID $NodeType -Stackname $DeploymentName"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\DSC.zip -Destination C:\cfn"; UseExecutionPolicy = $false },
        #@{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\sqlfci.zip -SignatureFilePath C:\cfn\signig_files\sqlfci.sig -PubFilePath C:\cfn\signig_files\sqlfci.pub -ResourceID $NodeType -Stackname $DeploymentName"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\sqlfci.zip -Destination C:\cfn\scripts"; UseExecutionPolicy = $false },
        #@{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\sqlontap.zip -SignatureFilePath C:\cfn\signig_files\sqlontap.sig -PubFilePath C:\cfn\signig_files\sqlontap.pub -ResourceID $NodeType -Stackname $DeploymentName"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\sqlontap.zip -Destination C:\cfn\scripts"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\sqlspcu.zip -Destination C:\cfn"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\powershell.zip -Destination C:\cfn\Installer"; UseExecutionPolicy = $false },
        # @{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\dbcreate.zip -SignatureFilePath C:\cfn\signig_files\dbcreate.sig -PubFilePath C:\cfn\signig_files\dbcreate.pub -ResourceID $NodeType -Stackname $DeploymentName"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\dbcreate.zip -Destination C:\cfn\scripts"; UseExecutionPolicy = $false },
        @{Command = "Copy-Item C:\cfn\scripts\common\ExecuteQueryFromSSM.ps1 -Destination (New-Item -Path C:\SSM -Type Directory) -Recurse"; UseExecutionPolicy = $false },
        @{Command = "Copy-Item C:\cfn\scripts\sqlontap\OntapRestGet.ps1 -Destination C:\SSM"; UseExecutionPolicy = $false },
        @{Command = "Copy-Item C:\cfn\scripts\dbcreate\* -Destination C:\SSM -Recurse"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\HideAllSSMScripts.ps1"; UseExecutionPolicy = $false },
        # @{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\Installer\dependent-packages.zip -SignatureFilePath C:\cfn\signig_files\dependent-packages.sig -PubFilePath C:\cfn\signig_files\dependent-packages.pub -ResourceID $NodeType -Stackname $DeploymentName"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\dependent-packages.zip -Destination C:\cfn\Installer"; UseExecutionPolicy = $false }
    )

    Invoke-Commands -commands $Commands
    Write-Output "Completed verifying the signatures and extracting the files"
  
    Write-Output "Invoking the sql setup script"
    $IsStandaloneString = if ($IsStandalone -eq $true) { "1" } else { "0" }

    $SqlSetupCommand = "C:\cfn\scripts\Sql-Setup.ps1 -DeploymentName '$DeploymentName' -Region '$Region' -SqlServerName '$SqlServerName' -SqlSvmName '$SqlSvmName' -FsxDataVolumeName '$FsxDataVolumeName' -FsxLogVolumeName '$FsxLogVolumeName' -FsxFileSystemId '$FsxFileSystemId' -FsxTempDbVolumeName '$FsxTempDbVolumeName' -FsxDataLunSize '$FsxDataLunSize' -SqlIgroupName '$SqlIgroupName' -FsxVolumeSnapshotPolicy '$FsxVolumeSnapshotPolicy' -AdDnsIpAddresses '$AdDnsIpAddresses' -DomainDnsName '$DomainDnsName' -DomainAdminUser '$DomainAdminUser' -SqlAdminAccounts '$SqlAdminAccounts' -SqlCollation '$SqlCollation'  -InstanceId '$InstanceId' -LogFeatureEnabled '$LogFeatureEnabled' -SqlNodeName '$SqlNodeName' -IsStandalone $IsStandaloneString -NodeType '$NodeType' -WorkloadSecurityGroupId '$WorkloadSecurityGroupId' -MssqlMediaBucketName '$MssqlMediaBucketName' -AmiId '$AmiId'"

    if ($IsStandalone -eq $false) {
        Write-Output "FCI Instance Command"
        $SqlSetupCommand += " -FsxQuorumVolumeName '$FsxQuorumVolumeName' -MssqlMediaPathKey '$MssqlMediaPathKey' -SqlFsxWsFcName '$SqlFsxWsFcName' -SqlFsxFciName '$SqlFsxFciName' -SqlFsxServerNetBiosName '$SqlFsxServerNetBiosName' -SqlFsxServerNetBiosName2 '$SqlFsxServerNetBiosName2' -NetworkInterface1FirstPrivateIp '$NetworkInterface1FirstPrivateIp' -NetworkInterface1SecondPrivateIp '$NetworkInterface1SecondPrivateIp' -NetworkInterface2FirstPrivateIp '$NetworkInterface2FirstPrivateIp' -NetworkInterface2SecondPrivateIp '$NetworkInterface2SecondPrivateIp'"
    }

    $CommandToInvoke = @{Command = $SqlSetupCommand; UseExecutionPolicy = $false }
    $CommandToInvoke | Format-List
    Invoke-Commands -commands $CommandToInvoke
    Write-Output "Completed with instance initializer script"
}
catch {
    New-EC2Tag -Region "$Region" -ResourceId "$InstanceId" -Tag @{ Key = "user_data"; Value = "failed" }
    Write-Output "An error occurred in instance initializer: $_.Exception.Message"
    exit 1
}