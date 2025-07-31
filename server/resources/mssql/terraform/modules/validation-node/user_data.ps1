<powershell>

Write-Output "Starting user data script from terraform"
$ProgressPreference = "SilentlyContinue";
$WarningPreference = 'SilentlyContinue';

$Region = "${region}"
$DeploymentName = "${deployment_name}"
$ValidationNodeInitializationS3Url = "${validation_node_initialization_s3_url}"
$DnsIpAddresses = "${dns_ip_addresses}"
$DomainDnsName = "${domain_dns_name}"
$DCName = "${preferred_domain_controller}"
$SubnetId = "${subnet_id}"
$DomainAdminUser = "${domain_admin_user}"
$ValidationNode1WaitHandler = "${validation_node1_wait_handler}"
$IsCustomAmi = "${is_custom_ami}"
$PerformFsxCheck = "${perform_fsx_check}"
$FsxFileSystemId = "${fsx_file_system_id}"
$ValidationNodeName = "${validation_node_name}"
$LogGroup = "${log_group}"
$SqlDeploymentMode = "${sql_deployment_mode}"


Write-Output "Deployment Name: $DeploymentName"

$ScriptDir = "C:\cfn\scripts"
# Check if the log directory exists, and create it if it does not
if (!(Test-Path -Path $ScriptDir)) {
    New-Item -ItemType Directory -Path $ScriptDir
}

function Get-InstanceId {
    try {
        $token = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token-ttl-seconds" = "21600" } -Method PUT -Uri "http://169.254.169.254/latest/api/token"
        #Write-Output "Successfully obtained the token."

        $InstanceId = Invoke-RestMethod -Headers @{"X-aws-ec2-metadata-token" = $token } -Method GET -Uri http://169.254.169.254/latest/meta-data/instance-id
        #Write-Output "Successfully obtained the instance ID: $InstanceId"
        return $InstanceId
    }
    catch {
        Write-Output "An error occurred while getting token: $_"
        return $null
    }
}

if (Get-Module -ListAvailable -Name AWSPowerShell) {
    Write-Host "AWS PowerShell module is already installed."
}
else {
    Write-Host "AWS PowerShell module is not installed."
    Install-Module -Name AWSPowerShell -Scope CurrentUser -Force
}

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12
    $InstanceId = Get-InstanceId
    Write-Output "Got the Instance ID: $InstanceId"

    Invoke-WebRequest -Uri $ValidationNodeInitializationS3Url -OutFile "$ScriptDir\Validation-Instance-Initializer.ps1"  -ErrorAction Stop
    
    $Command = "$ScriptDir\Validation-Instance-Initializer.ps1 -Region '$Region' -DeploymentName '$DeploymentName' -DnsIpAddresses '$DnsIpAddresses' -DomainDnsName '$DomainDnsName' -DCName '$DCName' -SubnetId '$SubnetId' -DomainAdminUser '$DomainAdminUser' -ValidationNode1WaitHandler '$ValidationNode1WaitHandler' -IsCustomAmi '$IsCustomAmi' -PerformFsxCheck '$PerformFsxCheck' -LogGroup '$LogGroup' -SqlDeploymentMode '$SqlDeploymentMode' -ValidationNodeName '$ValidationNodeName'" 
    if ($FsxFileSystemId -ne "") {
        $Command += " -FsxFileSystemId $FsxFileSystemId"
    }
    Write-Output "Executing command: $Command"
    Invoke-Expression -Command $Command
}
catch {
    New-EC2Tag -Region "$Region" -ResourceId "$InstanceId" -Tag @{ Key = "user_data"; Value = "failed" }
    Write-Error "An error occurred while invoking the initializer script: $_"
    exit 1
}
</powershell>