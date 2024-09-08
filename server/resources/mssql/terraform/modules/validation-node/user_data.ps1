
<powershell>

Write-Output "Starting user data script from terraform"
$WarningPreference = 'SilentlyContinue';

$region = "${region}"
$deployment_name = "${deployment_name}"
$validation_node_initialization_s3_url = "${validation_node_initialization_s3_url}"
$dns_ip_addresses = "${dns_ip_addresses}"
$domain_dns_name = "${domain_dns_name}"
$subnet_id = "${subnet_id}"
$domain_admin_user = "${domain_admin_user}"
$validation_node1_wait_handler = "${validation_node1_wait_handler}"
$is_custom_ami = "${is_custom_ami}"
$perform_fsx_check = "${perform_fsx_check}"
$fsx_file_system_id = "${fsx_file_system_id}"
$log_group = "${log_group}_validation_node"
$sql_deployment_mode = "${sql_deployment_mode}"
$ssm_parameter_name = "/netapp/wlmdb/$deployment_name"

Write-Output "Deployment Name: $deployment_name"

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls12
    $scriptDir = "C:\cfn\scripts"

    # Check if the script directory exists, and create it if it does not
    if (!(Test-Path -Path $scriptDir)) {
        New-Item -ItemType Directory -Path $scriptDir
    }

    Invoke-WebRequest -Uri $validation_node_initialization_s3_url -OutFile "$scriptDir\instance-initializer.ps1"  -ErrorAction Stop
    
    $command = "$scriptDir\instance-initializer.ps1 -region '$region' -deployment_name '$deployment_name' -validation_node_initialization_s3_url '$validation_node_initialization_s3_url' -dns_ip_addresses '$dns_ip_addresses' -domain_dns_name '$domain_dns_name' -subnet_id '$subnet_id' -domain_admin_user '$domain_admin_user' -validation_node1_wait_handler '$validation_node1_wait_handler' -is_custom_ami '$is_custom_ami' -perform_fsx_check '$perform_fsx_check' -log_group '$log_group' -sql_deployment_mode '$sql_deployment_mode' -ssm_parameter_name '$ssm_parameter_name'" 
    if ($fsx_file_system_id -ne "") {
        $command += " -fsx_file_system_id $fsx_file_system_id"
    }
    Write-Output "Executing command: $command"
    Invoke-Expression -Command $command
}
catch {
    Write-Error "An error occurred while invoking the initializer script: $_"
    exit 1
}
</powershell>
