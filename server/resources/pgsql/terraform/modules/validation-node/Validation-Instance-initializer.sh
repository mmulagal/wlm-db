#!/bin/bash

set -e

aws_region=$1
deployment_name=$2
subnet_id=$3
perform_fsx_check=$4
fsx_file_system_id=$5



get_instance_id() {
    curl -s http://169.254.169.254/latest/meta-data/instance-id
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
# install_agents() {
#     local region=$1
#     local ssm_agent_url="https://s3.${region}.amazonaws.com/amazon-ssm-${region}/latest/linux_amd64/amazon-ssm-agent.rpm"
#     local cloudwatch_agent_package="amazon-cloudwatch-agent.x86_64"

#     echo "Installing SSM Agent from ${ssm_agent_url}"
#     if ! sudo yum install -y "${ssm_agent_url}"; then
#         echo "Error installing SSM Agent"
#         exit 1
#     fi

#     echo "Installing CloudWatch Agent"
#     if ! sudo yum install -y "${cloudwatch_agent_package}"; then
#         echo "Error installing CloudWatch Agent"
#         exit 1
#     fi
# }


install_agents() {
    local region=$1

    if [ -z "$region" ]; then
        echo "Region is not set. Exiting."
        exit 1
    fi

    local ssm_agent_url="https://s3.${region}.amazonaws.com/amazon-ssm-${region}/latest/linux_amd64/amazon-ssm-agent.rpm"
    local cloudwatch_agent_package="amazon-cloudwatch-agent.x86_64"

    echo "Region: ${region}"
    echo "SSM Agent URL: ${ssm_agent_url}"
    echo "CloudWatch Agent Package: ${cloudwatch_agent_package}"

    echo "Installing SSM Agent from ${ssm_agent_url}"
    if ! sudo yum install -y "${ssm_agent_url}"; then
        echo "Error installing SSM Agent"
        exit 1
    fi

    echo "Installing CloudWatch Agent"
    if ! sudo yum install -y "${cloudwatch_agent_package}"; then
        echo "Error installing CloudWatch Agent"
        exit 1
    fi
}
# Function to create deployment folders
create_folders() {
    local folders=("$@")
    for folder in "${folders[@]}"; do
        echo "Creating folder ${folder}"
        if ! mkdir -p "${folder}"; then
            echo "Error creating folder ${folder}"
            exit 1
        fi
    done
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
        exit 1
    fi
}

# Function to download files
download_file() {
    local url=$1
    local dest=$2

    echo "Downloading ${url} to ${dest}"
    if ! wget -O "${dest}" "${url}"; then
        echo "Error downloading ${url}"
        exit 1
    fi
    chmod 755 "${dest}"
}

# Function to verify and extract scripts
verify_and_extract() {
    local source=$1
    local dest=$2
    local signature=$3
    local pub_key=$4
    local resource_id=$5
    local deployment_name=$6

    # echo "Verifying and extracting ${source}"
    # if ! /home/ec2-user/cfn/scripts/verify-signature.sh -f "${source}" -s "${signature}" -p "${pub_key}" -r "${resource_id}" -n "${deployment_name}"; then
    #     echo "Error verifying ${source}"
    #     exit 1
    # fi

    if ! /home/ec2-user/cfn/scripts/unzip-archive.sh -s "${source}" -d "${dest}"; then
        echo "Error extracting ${source}"
        exit 1
    fi
}

# Function to validate VPC
validate_vpc() {
    local subnet_id=$1
    local region=$2
    local deployment_name=$3
    local resource_id=$4

    echo "Validating VPC"

    if /home/ec2-user/cfn/scripts/validation/validate-vpc.sh "${subnet_id}" "${region}" "${deployment_name}" "${resource_id}"; then
        echo "VPC validation completed successfully."
    else
        echo "Error occurred during VPC validation."
        exit 1
    fi
}

# Function to validate FSx connectivity
validate_fsx_connectivity() {
    local perform_fsx_check=$1
    local fsx_file_system_id=$2
    local region=$3
    local deployment_name=$4
    local resource_id=$5

    echo "Validating FSx connectivity"

    if /home/ec2-user/cfn/scripts/validation/validate-fsx.sh -e "${perform_fsx_check}" -f "${fsx_file_system_id}" -r "${region}" -n "${deployment_name}" -p "${deployment_name}" -s "${resource_id}"; then
        echo "FSx connectivity validation completed successfully."
    else
        echo "Error occurred during FSx connectivity validation."
        exit 1
    fi
}
# Main script execution
main() {
    local instance_id
    instance_id=$(get_instance_id)

    trap 'tag_instance "${instance_id}" "user_data" "failed"' ERR

    install_agents "${aws_region}" || exit 1
    create_folders "/home/ec2-user/cfn/scripts" "/var/log/netapp_wf" || exit 1
    configure_cloudwatch "${aws_region}" "${deployment_name}" || exit 1

    download_file ""
    download_file ""
    download_file ""
    download_file ""
    download_file ""
    verify_and_extract "/home/ec2-user/cfn/signig_files.zip" "/home/ec2-user/cfn" "/home/ec2-user/cfn/signig_files/validation.zip.sig" "/home/ec2-user/cfn/signig_files/validation.zip.pub" "ValidationNode1" "${deployment_name}" || exit 1
    verify_and_extract "/home/ec2-user/cfn/scripts/validation.zip" "/home/ec2-user/cfn/scripts" "/home/ec2-user/cfn/signig_files/validation.zip.sig" "/home/ec2-user/cfn/signig_files/validation.zip.pub" "ValidationNode1" "${deployment_name}" || exit 1
    verify_and_extract "/home/ec2-user/cfn/fsx_certs.zip" "/home/ec2-user/cfn" "/home/ec2-user/cfn/signig_files/fsx_certs.zip.sig" "/home/ec2-user/cfn/signig_files/fsx_certs.zip.pub" "ValidationNode1" "${deployment_name}" || exit 1

    validate_vpc "${subnet_id}" "${aws_region}" "${deployment_name}" "ValidationNode1" || exit 1
    validate_fsx_connectivity "${perform_fsx_check}" "${fsx_file_system_id}" "${aws_region}" "${deployment_name}" "ValidationNode1" || exit 1

    tag_instance "${instance_id}" "user_data" "completed"
}

main "$@"¸