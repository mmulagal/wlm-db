<powershell>

Write-Output "Starting user data script from terraform"
$WarningPreference = 'SilentlyContinue';

$SqlNodeInitializationS3Url = "${sql_node_initialization_s3_url}"
$Region = "${region}"
$LogFeatureEnabled = "${log_feature_enabled}"
$DeploymentName = "${deployment_name}"
$SqlServerName = "${sql_server_name}"
$SqlSvmName = "${sql_svm_name}"
$FsxDataVolumeName = "${fsx_data_volume_name}"
$FsxLogVolumeName = "${fsx_log_volume_name}"
$FsxFileSystemId = "${fsx_file_system_id}"
$FsxTempDbVolumeName = "${fsx_temp_db_volume_name}"
$FsxQuorumVolumeName = "${fsx_quorum_volume_name}"
$FsxDataLunSize = "${fsx_data_lun_size}"
$SqlIgroupName = "${sql_igroup_name}"
$FsxVolumeSnapshotPolicy = "${fsx_volume_snapshot_policy}"
$AdDnsIpAddresses = "${ad_dns_ip_addresses}"
$DomainDnsName = "${domain_dns_name}"
$DomainAdminUser = "${domain_admin_user}"
$SqlAdminAccounts = "${sql_admin_accounts}"
$SqlCollation = "${sql_collation}"

$SqlNodeName = "${sql_node_name}"
$IsStandalone = "${is_standalone}"
$WorkloadSecurityGroupId = "${workload_security_group_id}"
$MssqlMediaBucketName = "${mssql_media_bucket_name}"
$AmiId = "${ami_id}"
$MssqlMediaPathKey = "${mssql_media_path_key}"
$SqlFsxWsFcName = "${sql_fsx_ws_fc_name}"
$SqlFsxFciName = "${sql_fsx_fci_name}"
$SqlFsxServerNetBiosName = "${sql_fsx_server_net_bios_name}"
$SqlFsxServerNetBiosName2 = "${sql_fsx_server_net_bios_name_2}"
$NetworkInterface1FirstPrivateIp = "${network_interface_1_first_private_ip}"
$NetworkInterface1SecondPrivateIp = "${network_interface_1_second_private_ip}"
$NetworkInterface2FirstPrivateIp = "${network_interface_2_first_private_ip}"
$NetworkInterface2SecondPrivateIp = "${network_interface_2_second_private_ip}"

Write-Output "Deployment Name: $DeploymentName"

$ScriptDir = "C:\cfn\scripts"

# Check if the script directory exists, and create it if it does not
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
  Install-Module -Name AWSPowerShell -Scope CurrentUser
}

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12
  $InstanceId = Get-InstanceId
  Write-Output "Got the Instance ID: $InstanceId"
  
  Invoke-WebRequest -Uri $SqlNodeInitializationS3Url -OutFile "$ScriptDir\Sql-Instance-Initializer.ps1"  -ErrorAction Stop

  $IsStandaloneString = if ($IsStandalone) { "1" } else { "0" }

  if ($IsStandalone -eq $true) {
    $Command = "$ScriptDir\Sql-Instance-Initializer.ps1 -Region '$Region' -LogFeatureEnabled '$LogFeatureEnabled' -DeploymentName '$DeploymentName' -SqlServerName '$SqlServerName' -SqlSvmName '$SqlSvmName' -FsxDataVolumeName '$FsxDataVolumeName' -FsxLogVolumeName '$FsxLogVolumeName' -FsxFileSystemId '$FsxFileSystemId' -FsxTempDbVolumeName '$FsxTempDbVolumeName' -FsxDataLunSize '$FsxDataLunSize' -SqlIgroupName '$SqlIgroupName' -FsxVolumeSnapshotPolicy '$FsxVolumeSnapshotPolicy' -AdDnsIpAddresses '$AdDnsIpAddresses' -DomainDnsName '$DomainDnsName' -DomainAdminUser '$DomainAdminUser' -SqlAdminAccounts '$SqlAdminAccounts' -SqlCollation '$SqlCollation' -SqlNodeName '$SqlNodeName' -IsStandalone $IsStandaloneString -WorkloadSecurityGroupId '$WorkloadSecurityGroupId' -MssqlMediaBucketName '$MssqlMediaBucketName' -AmiId '$AmiId'"
  }
  else {
    $Command = "$ScriptDir\Sql-Instance-Initializer.ps1 -Region '$Region' -LogFeatureEnabled '$LogFeatureEnabled' -DeploymentName '$DeploymentName' -SqlServerName '$SqlServerName' -SqlSvmName '$SqlSvmName' -FsxDataVolumeName '$FsxDataVolumeName' -FsxLogVolumeName '$FsxLogVolumeName' -FsxFileSystemId '$FsxFileSystemId' -FsxTempDbVolumeName '$FsxTempDbVolumeName' -FsxQuorumVolumeName '$FsxQuorumVolumeName' -FsxDataLunSize '$FsxDataLunSize' -SqlIgroupName '$SqlIgroupName' -FsxVolumeSnapshotPolicy '$FsxVolumeSnapshotPolicy' -AdDnsIpAddresses '$AdDnsIpAddresses' -DomainDnsName '$DomainDnsName' -DomainAdminUser '$DomainAdminUser' -SqlAdminAccounts '$SqlAdminAccounts' -SqlCollation '$SqlCollation' -SqlNodeName '$SqlNodeName' -IsStandalone $IsStandaloneString -WorkloadSecurityGroupId '$WorkloadSecurityGroupId' -MssqlMediaBucketName '$MssqlMediaBucketName' -AmiId '$AmiId' -MssqlMediaPathKey '$MssqlMediaPathKey' -SqlFsxWsFcName '$SqlFsxWsFcName' -SqlFsxFciName '$SqlFsxFciName' -SqlFsxServerNetBiosName '$SqlFsxServerNetBiosName' -SqlFsxServerNetBiosName2 '$SqlFsxServerNetBiosName2' -NetworkInterface1FirstPrivateIp '$NetworkInterface1FirstPrivateIp' -NetworkInterface1SecondPrivateIp '$NetworkInterface1SecondPrivateIp' -NetworkInterface2FirstPrivateIp '$NetworkInterface2FirstPrivateIp' -NetworkInterface2SecondPrivateIp '$NetworkInterface2SecondPrivateIp'"
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