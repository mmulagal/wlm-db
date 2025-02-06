#!/bin/bash

# Define variables
aws_region=$1
deployment_name=$2
fsx_file_system_id=$3
fsx_svm_id=$4
sql_svm_name=$5
fsx_aggr_name=$6
fsx_data_volume_name=$7
fsx_log_volume_name=$8
fsx_svm_uuid=$9
sql_version=${10}
sql_service_account_password=${11}
sql_server_name=${12}
log_feature_enabled=${13} # Set to false if CloudWatch Logs feature is disabled


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

# Function to download a file
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

# Function to verify and extract a zip file
verify_and_extract() {
    local source=$1
    local dest=$2
    local signature=$3
    local pub_key=$4
    local resource_id=$5
    local deployment_name=$6

    echo "Verifying and extracting ${source}"
    if ! /home/ec2-user/cfn/scripts/verify-signature.sh -f "${source}" -s "${signature}" -p "${pub_key}" -r "${resource_id}" -n "${deployment_name}"; then
        echo "Error verifying ${source}"
        return 1
    fi

    if ! /home/ec2-user/cfn/scripts/unzip-archive.sh -s "${source}" -d "${dest}"; then
        echo "Error extracting ${source}"
        return 1
    fi
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

# Function to create deployment folders
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

# Function to fetch resources
fetch_resources() {
    download_file "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/pgsql/scripts/verify-signature.sh?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20250203%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20250203T103440Z&X-Amz-Expires=604800&X-Amz-Signature=af981074d7801b9bd4822da61ff158c6d086ed5fbcac0a7814b73036694bb62a&X-Amz-SignedHeaders=host&x-id=GetObject" "/home/ec2-user/cfn/scripts/verify-signature.sh" || return 1
    download_file "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/pgsql/scripts/unzip-archive.sh?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20250203%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20250203T103440Z&X-Amz-Expires=604800&X-Amz-Signature=94f23b11171bce555ddd5a5ba2a76a0afc4241d39aa4bf5c47959dd5390b8f9d&X-Amz-SignedHeaders=host&x-id=GetObject" "/home/ec2-user/cfn/scripts/unzip-archive.sh" || return 1
    download_file "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/pgsql/signig_files.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20250203%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20250203T103440Z&X-Amz-Expires=604800&X-Amz-Signature=443bbe64cd8768b6912e05c627e52f4a960cf8eaedf012e9f5df05f20331798d&X-Amz-SignedHeaders=host&x-id=GetObject" " /home/ec2-user/cfn/signig_files.zip" || return 1
    download_file "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/pgsql/scripts/common.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20250203%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20250203T103440Z&X-Amz-Expires=604800&X-Amz-Signature=4fdce189712ac20823f843fdfd5b9ac80f68c706053bfe3262c36c785f76edd6&X-Amz-SignedHeaders=host&x-id=GetObject" "/home/ec2-user/cfn/scripts/common.zip" || return 1
    download_file "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/pgsql/scripts/setup.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20250203%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20250203T103440Z&X-Amz-Expires=604800&X-Amz-Signature=fae94b8126194f200f28dc51c4369906dea28475e0e0007d9422d32cc9f10131&X-Amz-SignedHeaders=host&x-id=GetObject" "/home/ec2-user/cfn/scripts/setup.zip" || return 1
    download_file "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/fsx_certs.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20250203%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20250203T103440Z&X-Amz-Expires=604800&X-Amz-Signature=508736c57d698a326c37a88f4ea7ca4fd1345836e014c927dcdecab0347f2ece&X-Amz-SignedHeaders=host&x-id=GetObject" "/home/ec2-user/cfn/fsx_certs.zip" || return 1
    download_file "https://staging-artifacts-ap-southeast-1-workloads-netapp-com.s3.ap-southeast-1.amazonaws.com/wlmdb/pgsql/packages/pgvector.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIA2OPDPEVT4HHFDECD%2F20250203%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20250203T103440Z&X-Amz-Expires=604800&X-Amz-Signature=10571148854250dcbcc342683477188d0091a565df4c9741735717e526c97efe&X-Amz-SignedHeaders=host&x-id=GetObject" "/home/ec2-user/cfn/pgvector.zip" || return 1
}


# Function to verify and unpack scripts
verify_and_unpack_scripts() {
    sudo su
    verify_and_extract "/home/ec2-user/cfn/signig_files.zip" "/home/ec2-user/cfn" "/home/ec2-user/cfn/signig_files/validation.zip.sig" "/home/ec2-user/cfn/signig_files/validation.zip.pub" "ValidationNode1" "${deployment_name}" || return 1
    verify_and_extract "/home/ec2-user/cfn/scripts/common.zip" "/home/ec2-user/cfn/scripts" "/home/ec2-user/cfn/signig_files/common.zip.sig" "/home/ec2-user/cfn/signig_files/common.zip.pub" "ValidationNode1" "${deployment_name}" || return 1
    verify_and_extract "/home/ec2-user/cfn/scripts/setup.zip" "/home/ec2-user/cfn/scripts" "/home/ec2-user/cfn/signig_files/setup.zip.sig" "/home/ec2-user/cfn/signig_files/setup.zip.pub" "ValidationNode1" "${deployment_name}" || return 1
    /home/ec2-user/cfn/scripts/unzip-archive.sh -s /home/ec2-user/cfn/fsx_certs.zip -d /home/ec2-user/cfn || return 1
    /home/ec2-user/cfn/scripts/unzip-archive.sh -s /home/ec2-user/cfn/pgvector.zip -d /home/ec2-user/cfn || return 1
}

# Function to configure ONTAP
configure_ontap() {
    local fsx_file_system_id=$1
    local aws_region=$2
    local fsx_svm_id=$3
    local sql_svm_name=$4
    local fsx_aggr_name=$5
    local fsx_data_volume_name=$6
    local fsx_log_volume_name=$7
    local fsx_svm_uuid=$8
    local deployment_name=$9

    /home/ec2-user/cfn/scripts/setup/configure-ontap.sh -f ${fsx_file_system_id} -r ${aws_region} -s ${fsx_svm_id} -n ${sql_svm_name} -a ${fsx_aggr_name} -d ${fsx_data_volume_name} -l ${fsx_log_volume_name} -v ${fsx_svm_uuid} -p ${deployment_name} || return 1
}

# Function to configure PostgreSQL
configure_pgsql() {
    local fsx_data_volume_name=$1
    local fsx_log_volume_name=$2
    local sql_version=$3
    local sql_service_account_password=$4

    /home/ec2-user/cfn/scripts/setup/configure-pgsql.sh -d ${fsx_data_volume_name} -l ${fsx_log_volume_name} -v ${sql_version} -w ${sql_service_account_password} || return 1
}

# Function to rename host
rename_host() {
    local sql_server_name=$1

    /home/ec2-user/cfn/scripts/common/rename-host.sh ${sql_server_name} || return 1
}

# Function to restart host
restart_host() {
    sudo reboot || return 1
}

# Main function
main() {
    local instance_id
    instance_id=$(get_instance_id)
    # Error handling
    trap 'tag_instance "${instance_id}" "user_data" "failed"' ERR

    install_agents "${aws_region}" || return 1
    create_deployment_folders "/home/ec2-user/cfn/scripts" "/var/log/netapp_wf" || return 1
    configure_cloudwatch || return 1
    fetch_resources || return 1
    verify_and_unpack_scripts || return 1
    configure_ontap "${fsx_file_system_id}" "${aws_region}" "${fsx_svm_id}" "${sql_svm_name}" "${fsx_aggr_name}" "${fsx_data_volume_name}" "${fsx_log_volume_name}" "${fsx_svm_uuid}" "${deployment_name}" || return 1
    configure_pgsql "${fsx_data_volume_name}" "${fsx_log_volume_name}" "${sql_version}" "${sql_service_account_password}" || return 1
    rename_host "${sql_server_name}" || return 1
    restart_host || return 1
    tag_instance "${instance_id}" "user_data" "completed"
}

main "$@"