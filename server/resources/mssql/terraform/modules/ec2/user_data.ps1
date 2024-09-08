<powershell>

Write-Output "Starting user data script from terraform"
$WarningPreference = 'SilentlyContinue';

$sql_node_initialization_s3_url = "${sql_node_initialization_s3_url}"
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

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12
  $scriptDir = "C:\cfn\scripts"

  # Check if the script directory exists, and create it if it does not
  if (!(Test-Path -Path $scriptDir)) {
    New-Item -ItemType Directory -Path $scriptDir
  }
    
  Invoke-WebRequest -Uri $sql_node_initialization_s3_url -OutFile "$scriptDir\instance-initializer.ps1"  -ErrorAction Stop

  $command = "$scriptDir\instance-initializer.ps1 -region '$region' -log_feature_enabled '$log_feature_enabled' -deployment_name '$deployment_name' -sql_server_name '$sql_server_name' -sql_svm_name '$sql_svm_name' -fsx_data_volume_name '$fsx_data_volume_name' -fsx_log_volume_name '$fsx_log_volume_name' -fsx_file_system_id '$fsx_file_system_id' -fsx_temp_db_volume_name '$fsx_temp_db_volume_name' -fsx_data_lun_size '$fsx_data_lun_size' -sql_igroup_name '$sql_igroup_name' -fsx_volume_snapshot_policy '$fsx_volume_snapshot_policy' -ad_dns_ip_addresses '$ad_dns_ip_addresses' -domain_dns_name '$domain_dns_name' -domain_admin_user '$domain_admin_user' -sql_admin_accounts '$sql_admin_accounts' -sql_collation '$sql_collation'"
  Write-Output "Executing command: $command"
  Invoke-Expression -Command $command
}
catch {
  Write-Error "An error occurred while invoking the initializer script: $_"
  exit 1
}

</powershell>