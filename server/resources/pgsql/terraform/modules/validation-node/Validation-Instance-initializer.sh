#!/bin/bash

set -e

aws_region=$1
deployment_name=$2
subnet_id=$3
perform_fsx_check=$4
log_feature_enabled=$5 # Set to false if CloudWatch Logs feature is disabled
fsx_file_system_id=$6

get_instance_id() {
    token=$(curl -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s http://169.254.169.254/latest/api/token)
    instance_id=$(curl -H "X-aws-ec2-metadata-token: $token" -s http://169.254.169.254/latest/meta-data/instance-id)
    echo "$instance_id"
}

# Function to tag the instance
tag_instance() {
    local instance_id=$1
    local key=$2
    local value=$3

    echo "Tagging instance ${instance_id} with ${key}=${value}"
    aws ec2 create-tags --region "${aws_region}" --resources "${instance_id}" --tags Key="${key}",Value="${value}"
}

# Function to install SSM Agent and CloudWatch Agent
install_agents() {
    local region=$1

    if [ -z "$region" ]; then
        echo "Region is not set. Exiting."
        return 1
    fi

    local ssm_agent_url="https://s3.${region}.amazonaws.com/amazon-ssm-${region}/latest/linux_amd64/amazon-ssm-agent.rpm"
    local cloudwatch_agent_package="amazon-cloudwatch-agent.x86_64"

    echo "Region: ${region}"
    echo "SSM Agent URL: ${ssm_agent_url}"
    echo "CloudWatch Agent Package: ${cloudwatch_agent_package}"

    echo "Installing SSM Agent from ${ssm_agent_url}"
    if ! sudo yum install -y "${ssm_agent_url}"; then
        echo "Error installing SSM Agent"
        return 1
    fi

    echo "Installing CloudWatch Agent"
    if ! sudo yum install -y "${cloudwatch_agent_package}"; then
        echo "Error installing CloudWatch Agent"
        return 1
    fi
}

# Function to configure CloudWatch Logs
configure_cloudwatch() {
    local region=$1
    local deployment_name=$2
    local config_file="/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json"

    echo "Configuring CloudWatch Logs"
    cat <<EOF > "${config_file}"
{
    "agent": {
        "metrics_collection_interval": 5,
        "run_as_user": "cwagent",
        "region": "${region}"
    },
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/cfn-*.log",
                        "log_group_name": "${deployment_name}",
                        "log_stream_name": "{instance_id}"
                    },
                    {
                        "file_path": "/home/ec2-user/cfn/log/*.log",
                        "log_group_name": "${deployment_name}",
                        "log_stream_name": "{instance_id}"
                    },
                    {
                        "file_path": "/var/log/netapp_wf/*.log",
                        "log_group_name": "${deployment_name}",
                        "log_stream_name": "{instance_id}"
                    }
                ]
            }
        }
    }
}
EOF

    if ! sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:"${config_file}" -s; then
        echo "Error configuring CloudWatch Logs"
        return 1
    fi
}

# Function to download files
download_file() {
    local url=$1
    local dest=$2

    echo "Downloading ${url} to ${dest}"
    if ! wget -O "${dest}" "${url}"; then
        echo "Error downloading ${url}"
        return 1
    fi
    chmod 755 "${dest}"
}

# Function to verify and extract scripts
unzip_archive() {
    local source=$1
    local destination=$2
    
    echo "Unzipping $source to $destination"
    if ! sudo /home/ec2-user/cfn/scripts/unzip-archive.sh -s "$source" -d "$destination"; then
        echo "Error unzipping $source"
        return 1
    fi
}

verify_signature() {
    local file=$1
    local signature=$2
    local pubkey=$3
    local resource=$4
    local deployment_name=$5
    
    echo "Verifying signature for $file"
    if ! sudo /home/ec2-user/cfn/scripts/verify-signature.sh -f "$file" -s "$signature" -p "$pubkey" -r "$resource" -n "$deployment_name"; then
        echo "Error verifying signature for $file"
        return 1
    fi
}

# Function to validate VPC
validate_vpc() {
    local subnet_id=$1
    local region=$2
    local deployment_name=$3
    local resource_id=$4

    echo "Validating VPC with inputs: subnet_id=${subnet_id}, region=${region}, deployment_name=${deployment_name}, resource_id=${resource_id}"

    if ! /home/ec2-user/cfn/scripts/validation/validate-vpc.sh "${subnet_id}" "${region}" "${deployment_name}" "${resource_id}"; then
        echo "Error occurred during VPC validation."
        return 1
    fi
}

# Function to validate FSx connectivity
validate_fsx_connectivity() {
    local perform_fsx_check=$1
    local fsx_file_system_id=$2
    local region=$3
    local deployment_name=$4
    local resource_id=$5

    echo "Validating FSx connectivity with inputs: perform_fsx_check=${perform_fsx_check}, fsx_file_system_id=${fsx_file_system_id}, region=${region}, deployment_name=${deployment_name}, resource_id=${resource_id}"

    if ! /home/ec2-user/cfn/scripts/validation/validate-fsx.sh -e "${perform_fsx_check}" -f "${fsx_file_system_id}" -r "${region}" -n "${deployment_name}" -p "${deployment_name}" -s "${resource_id}"; then
        echo "Error occurred during FSx connectivity validation."
        return 1
    fi
}

handle_error() {
    local instance_id=$1
    echo "Handling error for instance_id: ${instance_id}"
    tag_instance "${instance_id}" "user_data" "failed"
    exit 1
}

# Main script execution
main() {
    local instance_id
    instance_id=$(get_instance_id)
    echo "Got the Instance ID: $instance_id"

    #Trap any error and call the handle_error function
    trap 'handle_error "${instance_id}"' ERR

    install_agents "${aws_region}" 
    if [ "${log_feature_enabled}" = "true" ]; then
        configure_cloudwatch "${aws_region}" "${deployment_name}"
    fi 

    download_file "{{{ScriptVerifySignature}}}" "/home/ec2-user/cfn/scripts/verify-signature.sh"

    download_file "{{{ ScriptUnzipArchive }}}" "/home/ec2-user/cfn/scripts/unzip-archive.sh" 
    
    download_file "{{{ ScriptValidation }}}" "/home/ec2-user/cfn/scripts/validation.zip" 
    
    download_file "{{{ FsxCertificates }}}" "/home/ec2-user/cfn/fsx_certs.zip" 
    
    download_file "{{{ ArtifactsSignatures }}}" "/home/ec2-user/cfn/signig_files.zip" 
    
    unzip_archive "/home/ec2-user/cfn/signig_files.zip" "/home/ec2-user/cfn"
    verify_signature "/home/ec2-user/cfn/scripts/validation.zip" "/home/ec2-user/cfn/signig_files/validation.zip.sig" "/home/ec2-user/cfn/signig_files/validation.zip.pub" "ValidationNode1" "${deployment_name}" 
    unzip_archive "/home/ec2-user/cfn/scripts/validation.zip" "/home/ec2-user/cfn/scripts"
    unzip_archive "/home/ec2-user/cfn/fsx_certs.zip" "/home/ec2-user/cfn"

    validate_vpc "${subnet_id}" "${aws_region}" "${deployment_name}" "ValidationNode1" 
    validate_fsx_connectivity "${perform_fsx_check}" "${fsx_file_system_id}" "${aws_region}" "${deployment_name}" "ValidationNode1" 

    tag_instance "${instance_id}" "user_data" "completed"
}

main "$@"