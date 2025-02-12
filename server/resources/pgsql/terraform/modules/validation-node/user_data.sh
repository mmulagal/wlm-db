#!/bin/bash -xe

aws_region="${aws_region}"
deployment_name="${deployment_name}"
fsx_file_system_id="${fsx_file_system_id}"
subnet_id="${subnet_id}"
perform_fsx_check="${perform_fsx_check}"
validation_node_initialization_s3_url="${validation_node_initialization_s3_url}"
log_feature_enabled="${log_feature_enabled}"
script_dir="/home/ec2-user/cfn/scripts"
log_dir="/var/log/netapp_wf"
log_file="$log_dir/Validation-instance-initializer.log"

echo "Deployment Name: $deployment_name"

# Create necessary directories
echo "Creating folder $script_dir"
if ! mkdir -p "$script_dir"; then
    echo "Error creating folder $script_dir"
    exit 1
fi

echo "Creating folder $log_dir"
if ! mkdir -p "$log_dir"; then
    echo "Error creating folder $log_dir"
    exit 1
fi


get_instance_id() {
    token=$(curl -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s http://169.254.169.254/latest/api/token)
    instance_id=$(curl -H "X-aws-ec2-metadata-token: $token" -s http://169.254.169.254/latest/meta-data/instance-id)
    echo "$instance_id"
}

# Ensure necessary security protocols are set
export AWS_CA_BUNDLE=/etc/ssl/certs/ca-bundle.crt

# Create necessary deployment folders
create_deployment_folders

# Get the instance ID
instance_id=$(get_instance_id)
echo "Got the Instance ID: $instance_id"

# Download the initialization script
curl -o "$script_dir/Validation-Instance-Initializer.sh" "$validation_node_initialization_s3_url"
chmod +x "$script_dir/Validation-Instance-Initializer.sh"

# Construct the command to execute the initialization script
command="$script_dir/Validation-Instance-Initializer.sh '$aws_region' '$deployment_name' '$subnet_id' '$perform_fsx_check' '$log_feature_enabled'"

if [ -n "$fsx_file_system_id" ]; then
    echo "FSx file system ID: $fsx_file_system_id"
    command+=" $fsx_file_system_id"
fi

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