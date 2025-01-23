#!/bin/bash -xe

aws_region="${aws_region}"
deployment_name="${deployment_name}"
fsx_file_system_id="${fsx_file_system_id}"
subnet_id="${subnet_id}"
perform_fsx_check="${perform_fsx_check}"
validation_node_initialization_s3_url="${validation_node_initialization_s3_url}"
script_dir="/home/ec2-user/cfn/scripts"
log_file="$script_dir/validation-instance-initializer.log"

echo "Deployment Name: $deployment_name"

# Check if the log directory exists, and create it if it does not
if [ ! -d "$script_dir" ]; then
    mkdir -p "$script_dir"
fi

get_instance_id() {
    token=$(curl -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s http://169.254.169.254/latest/api/token)
    instance_id=$(curl -H "X-aws-ec2-metadata-token: $token" -s http://169.254.169.254/latest/meta-data/instance-id)
    echo "$instance_id"
}

# Ensure necessary security protocols are set
export AWS_CA_BUNDLE=/etc/ssl/certs/ca-bundle.crt

# Get the instance ID
instance_id=$(get_instance_id)
echo "Got the Instance ID: $instance_id"

# Download the initialization script
curl -o "$script_dir/Validation-Instance-Initializer.sh" "$validation_node_initialization_s3_url"
chmod +x "$script_dir/Validation-Instance-Initializer.sh"

# Construct the command to execute the initialization script
command="$script_dir/Validation-Instance-Initializer.sh '$aws_region' '$deployment_name' '$subnet_id' '$perform_fsx_check'"

if [ -n "$fsx_file_system_id" ]; then
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