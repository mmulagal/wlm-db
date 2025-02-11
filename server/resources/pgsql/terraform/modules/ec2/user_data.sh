#!/bin/bash -xe

# Set required variables
aws_region="${aws_region}"
deployment_name="${deployment_name}"
fsx_file_system_id="${fsx_file_system_id}"
fsx_svm_id="${fsx_svm_id}"
sql_svm_name="${sql_svm_name}"
sql_service_account_password="${sql_service_account_password}"
sql_server_name="${sql_server_name}"
sql_version="${sql_version}"
fsx_aggr_name="${fsx_aggr_name}"
fsx_data_volume_name="${fsx_data_volume_name}"
fsx_log_volume_name="${fsx_log_volume_name}"
fsx_svm_uuid="${fsx_svm_uuid}"
log_feature_enabled="${log_feature_enabled}"
script_dir="/home/ec2-user/cfn/scripts"
log_dir="/var/log/netapp_wf"
log_file="$log_dir/Pgsql-Instance-initializer.log"
pgsql_node_initialization_s3_url="${pgsql_node_initialization_s3_url}"

echo "Deployment Name: $deployment_name"

# Function to create deployment folders
# Check if the log directory exists, and create it if it does not
create_deployment_folders() {
    local folders=("$@")
    for folder in "${folders[@]}"; do
        echo "Creating folder ${folder}"
        if ! mkdir -p "${folder}"; then
            echo "Error creating folder ${folder}"
            return 1
        fi
    done
}

get_instance_id() {
    token=$(curl -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s http://169.254.169.254/latest/api/token)
    instance_id=$(curl -H "X-aws-ec2-metadata-token: $token" -s http://169.254.169.254/latest/meta-data/instance-id)
    echo "$instance_id"
}

# Ensure necessary security protocols are set
export AWS_CA_BUNDLE=/etc/ssl/certs/ca-bundle.crt

create_deployment_folders "$script_dir" "$log_dir"

# Get the instance ID
instance_id=$(get_instance_id)
echo "Got the Instance ID: $instance_id"

# Download the initialization script
curl -o "$script_dir/Pgsql-Instance-initializer.sh" "$pgsql_node_initialization_s3_url"
chmod +x "$script_dir/Pgsql-Instance-initializer.sh"

# Construct the command to execute the initialization script
command="$script_dir/Pgsql-Instance-initializer.sh '$aws_region' '$deployment_name' '$fsx_file_system_id' '$fsx_svm_id' '$sql_svm_name' '$fsx_aggr_name' '$fsx_data_volume_name' '$fsx_log_volume_name' '$fsx_svm_uuid' '$sql_version' '$sql_service_account_password' '$sql_server_name' '$log_feature_enabled'"

echo "Executing command: $command"
bash -c "$command" &> "$log_file"

# Check if the command was successful
if [ $? -ne 0 ]; then
    echo "An error occurred while invoking the initializer script"
    aws ec2 create-tags --region "$aws_region" --resources "$instance_id" --tags Key="user_data",Value="failed"
    exit 1
else
    aws ec2 create-tags --region "$aws_region" --resources "$instance_id" --tags Key="user_data",Value="completed"
fi