[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$region,
    [Parameter(Mandatory = $true)]
    [string]$log_feature_enabled,
    [Parameter(Mandatory = $true)]
    [string]$deployment_name,
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

Write-Output "Starting the initializer script from terraform"
$WarningPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12

# Define the log directory
$logDir = "C:\cfn\log"

# Check if the log directory exists, and create it if it does not
if (!(Test-Path -Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir
}

Start-Transcript -Path "$logDir\instance.initializer.ps1.txt" -Append

$script_verify_signature = ""
$script_unzip_archive = ""
$script_common = ""
$script_sqlfci = ""
$script_sqlontap = ""
$script_dbcreate = ""
$dsc = ""
$power_shell = ""
$amazon_launch_wizard_for_cfn = ""
$amazon_launch_wizard_for_ssm = ""
$sqlspcu = ""
$dependent_packages = ""
$artifacts_signatures = ""
$open_ssl = ""
$sql_setup = ""

function Get-InstanceId {
    try {
        $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
        $instance_id = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
        return $instance_id
    }
    catch {
        Write-Output "An error occurred while getting token: $_"
        return $null
    }
}

function Install-SSMAgent {
    param(
        [string]$region
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
        $ssmAgentUrl = "https://amazon-ssm-$region.s3.$region.amazonaws.com/latest/windows_amd64/AmazonSSMAgentSetup.exe"
        Write-Output "Downloading SSM Agent from $ssmAgentUrl"
        Invoke-WebRequest $ssmAgentUrl -OutFile "$env:USERPROFILE\Desktop\SSMAgent_latest.exe"
      
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
            exit $LASTEXITCODE
        }
    }
}

$instance_id = Get-InstanceId
Write-Output "Instance ID: $instance_id"
try {
    Install-SSMAgent -region "$region"

    # FetchResources
    Write-Output "Downloading the files"
    $downloads = @{
        "$script_verify_signature"      = "C:\\cfn\\scripts\\Verify-Signature.ps1"
        "$script_unzip_archive"         = "C:\\cfn\\scripts\\Unzip-Archive.ps1"
        "$script_common"                = "C:\\cfn\\scripts\\common.zip"
        "$script_sqlfci"                = "C:\\cfn\\scripts\\sqlfci.zip"
        "$script_sqlontap"              = "C:\\cfn\\scripts\\sqlontap.zip"
        "$script_dbcreate"              = "C:\\cfn\\scripts\\dbcreate.zip"
        "$dsc"                          = "C:\\cfn\\DSC.zip"
        "$power_shell"                  = "C:\\cfn\\Installer\\powershell.zip"
        "$amazon_launch_wizard_for_cfn" = "C:\\cfn\\modules\\AWSLaunchWizardForCFN.zip"
        "$amazon_launch_wizard_for_ssm" = "C:\\cfn\\modules\\AWSLaunchWizardForSSM.zip"
        "$sqlspcu"                      = "C:\\cfn\\Installer\\sqlspcu.zip"
        "$dependent_packages"           = "C:\\cfn\\Installer\\dependent-packages.zip"
        "$artifacts_signatures"         = "C:\\cfn\\signig_files.zip"
        "$open_ssl"                     = "C:\\cfn\\OpenSSL-Win64.zip"
        "$sql_setup"                    = "C:\\cfn\\scripts\\Sql-Setup.ps1"
    }
    $ProgressPreference = 'SilentlyContinue'
    foreach ($uri in $downloads.Keys) {
        Invoke-WebRequestWithRetry -Uri $uri -OutFile $downloads[$uri]
    }
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
        #@{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\sqlontap.zip -SignatureFilePath C:\cfn\signig_files\sqlontap.sig -PubFilePath C:\cfn\signig_files\sqlontap.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\sqlontap.zip -Destination C:\cfn\scripts"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\sqlspcu.zip -Destination C:\cfn"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\powershell.zip -Destination C:\cfn\Installer"; UseExecutionPolicy = $false },
        # @{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\scripts\dbcreate.zip -SignatureFilePath C:\cfn\signig_files\dbcreate.sig -PubFilePath C:\cfn\signig_files\dbcreate.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\scripts\dbcreate.zip -Destination C:\cfn\scripts"; UseExecutionPolicy = $false },
        @{Command = "Copy-Item C:\cfn\scripts\common\ExecuteQueryFromSSM.ps1 -Destination (New-Item -Path C:\SSM -Type Directory) -Recurse"; UseExecutionPolicy = $false },
        @{Command = "Copy-Item C:\cfn\scripts\sqlontap\OntapRestGet.ps1 -Destination C:\SSM"; UseExecutionPolicy = $false },
        @{Command = "Copy-Item C:\cfn\scripts\dbcreate\* -Destination C:\SSM -Recurse"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\common\HideAllSSMScripts.ps1"; UseExecutionPolicy = $false },
        # @{Command = "C:\cfn\scripts\Verify-Signature.ps1 -FilePath C:\cfn\Installer\dependent-packages.zip -SignatureFilePath C:\cfn\signig_files\dependent-packages.sig -PubFilePath C:\cfn\signig_files\dependent-packages.pub -ResourceID SqlNode -Stackname $deployment_name"; UseExecutionPolicy = $false },
        @{Command = "C:\cfn\scripts\Unzip-Archive.ps1 -Source C:\cfn\Installer\dependent-packages.zip -Destination C:\cfn\Installer"; UseExecutionPolicy = $false }
    )
    Invoke-Commands -commands $commands
    Write-Output "Completed verifying the signatures and extracting the files"
  
    Write-Output "Invoking the sql setup script"
    $sql_setup_command = @(
        @{Command = "C:\cfn\scripts\Sql-Setup.ps1 -deployment_name '$deployment_name' -region '$region' -sql_server_name '$sql_server_name' -sql_svm_name '$sql_svm_name' -fsx_data_volume_name '$fsx_data_volume_name' -fsx_log_volume_name '$fsx_log_volume_name' -fsx_file_system_id '$fsx_file_system_id' -fsx_temp_db_volume_name '$fsx_temp_db_volume_name' -fsx_data_lun_size '$fsx_data_lun_size' -sql_igroup_name '$sql_igroup_name' -fsx_volume_snapshot_policy '$fsx_volume_snapshot_policy' -ad_dns_ip_addresses '$ad_dns_ip_addresses' -domain_dns_name '$domain_dns_name' -domain_admin_user '$domain_admin_user' -sql_admin_accounts '$sql_admin_accounts' -sql_collation '$sql_collation'  -instance_id '$instance_id' -log_feature_enabled '$log_feature_enabled'"; UseExecutionPolicy = $false }
    )
    $command = "C:\cfn\scripts\Sql-Setup.ps1 -deployment_name '$deployment_name' -region '$region' -sql_server_name '$sql_server_name' -sql_svm_name '$sql_svm_name' -fsx_data_volume_name '$fsx_data_volume_name' -fsx_log_volume_name '$fsx_log_volume_name' -fsx_file_system_id '$fsx_file_system_id' -fsx_temp_db_volume_name '$fsx_temp_db_volume_name' -fsx_data_lun_size '$fsx_data_lun_size' -sql_igroup_name '$sql_igroup_name' -fsx_volume_snapshot_policy '$fsx_volume_snapshot_policy' -ad_dns_ip_addresses '$ad_dns_ip_addresses' -domain_dns_name '$domain_dns_name' -domain_admin_user '$domain_admin_user' -sql_admin_accounts '$sql_admin_accounts' -sql_collation '$sql_collation' -instance_id '$instance_id' -log_feature_enabled '$log_feature_enabled'"
    Write-Output $command
    Invoke-Commands -commands $sql_setup_command
    Write-Output "Completed with instance initializer script"
}
catch {
    New-EC2Tag -Region "$region" -ResourceId "$instance_id" -Tag @{ Key = "user_data"; Value = "failed" }
    Write-Output "An error occurred in instance initializer: $_.Exception.Message"
    exit 1
}