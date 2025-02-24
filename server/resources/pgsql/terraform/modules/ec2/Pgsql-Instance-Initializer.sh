#!/bin/bash

sudo su

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
        exit 1
    fi
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
    if ! sudo /home/ec2-user/cfn/scripts/verify-signature.sh -f "$file" -s "$signature" -p "$pubkey" -r "$resource" -n "$deployment_name" -t "true"; then
        echo "Error verifying signature for $file"
        return 1
    fi
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

    echo "Configuring ONTAP with fsx_file_system_id=${fsx_file_system_id}, aws_region=${aws_region}, fsx_svm_id=${fsx_svm_id}, sql_svm_name=${sql_svm_name}, fsx_aggr_name=${fsx_aggr_name}, fsx_data_volume_name=${fsx_data_volume_name}, fsx_log_volume_name=${fsx_log_volume_name}, fsx_svm_uuid=${fsx_svm_uuid}, deployment_name=${deployment_name}"

    if ! sudo /home/ec2-user/cfn/scripts/setup/configure-ontap.sh -f ${fsx_file_system_id} -r ${aws_region} -s ${fsx_svm_id} -n ${sql_svm_name} -a ${fsx_aggr_name} -d ${fsx_data_volume_name} -l ${fsx_log_volume_name} -v ${fsx_svm_uuid} -p ${deployment_name}; then
        echo "Error configuring ONTAP"
        return 1
    fi
}

# Function to configure PostgreSQL
configure_pgsql() {
    local fsx_data_volume_name=$1
    local fsx_log_volume_name=$2
    local sql_version=$3
    local sql_service_account_password=$4

    echo "Configuring PostgreSQL with fsx_data_volume_name=${fsx_data_volume_name}, fsx_log_volume_name=${fsx_log_volume_name}, sql_version=${sql_version}, sql_service_account_password=${sql_service_account_password}"

    if ! sudo /home/ec2-user/cfn/scripts/setup/configure-pgsql.sh -d ${fsx_data_volume_name} -l ${fsx_log_volume_name} -v ${sql_version} -w ${sql_service_account_password}; then
        echo "Error configuring PostgreSQL"
        return 1
    fi
}

# Function to rename host
rename_host() {
    local sql_server_name=$1

    echo "Renaming host with sql_server_name=${sql_server_name}"

    if ! sudo /home/ec2-user/cfn/scripts/common/rename-host.sh ${sql_server_name}; then
        echo "Error renaming host"
        return 1
    fi
}

# Function to restart host
restart_host() {
    sudo reboot || return 1
}

handle_error() {
    local instance_id=$1
    echo "Handling error for instance_id: ${instance_id}"
    tag_instance "${instance_id}" "user_data" "failed"
    exit 1
}

# Main function
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
    download_file "{{{ ScriptVerifySignature }}}" "/home/ec2-user/cfn/scripts/verify-signature.sh"
   
    download_file "{{{ ScriptUnzipArchive }}}" "/home/ec2-user/cfn/scripts/unzip-archive.sh"
    
    download_file "{{{ ArtifactsSignatures }}}" "/home/ec2-user/cfn/signig_files.zip"
    
    download_file "{{{ ScriptCommon }}}" "/home/ec2-user/cfn/scripts/common.zip"
    
    download_file "{{{ ScriptSetup }}}" "/home/ec2-user/cfn/scripts/setup.zip"
    
    download_file "{{{ FsxCertificates }}}" "/home/ec2-user/cfn/fsx_certs.zip"
    
    download_file "{{{ PGSQLPackages }}}" "/home/ec2-user/cfn/pgvector.zip"

    unzip_archive "/home/ec2-user/cfn/signig_files.zip" "/home/ec2-user/cfn"
    
    verify_signature "/home/ec2-user/cfn/scripts/common.zip" "/home/ec2-user/cfn/signig_files/common.zip.sig" "/home/ec2-user/cfn/signig_files/common.zip.pub" "SqlNode1" "${deployment_name}"
    verify_signature "/home/ec2-user/cfn/scripts/setup.zip" "/home/ec2-user/cfn/signig_files/setup.zip.sig" "/home/ec2-user/cfn/signig_files/setup.zip.pub" "SqlNode1" "${deployment_name}"
    
    unzip_archive "/home/ec2-user/cfn/scripts/common.zip" "/home/ec2-user/cfn/scripts"
    unzip_archive "/home/ec2-user/cfn/scripts/setup.zip" "/home/ec2-user/cfn/scripts"
    unzip_archive "/home/ec2-user/cfn/fsx_certs.zip" "/home/ec2-user/cfn"
    unzip_archive "/home/ec2-user/cfn/pgvector.zip" "/home/ec2-user/cfn"

    configure_ontap "${fsx_file_system_id}" "${aws_region}" "${fsx_svm_id}" "${sql_svm_name}" "${fsx_aggr_name}" "${fsx_data_volume_name}" "${fsx_log_volume_name}" "${fsx_svm_uuid}" "${deployment_name}"
    configure_pgsql "${fsx_data_volume_name}" "${fsx_log_volume_name}" "${sql_version}" "${sql_service_account_password}"
    rename_host "${sql_server_name}"
    tag_instance "${instance_id}" "user_data" "completed"
    restart_host
}

main "$@"